import type { Segment } from './sources';

const DOT_PX = 5;
const GAP_PX = 1;
const STEP = DOT_PX + GAP_PX;
const ROWS = 13;
const FPS_DIV = 4;

const COLORS = {
  normal: { dot: '#e0e0e0', glow: 'rgba(200,200,200,0.35)' },
  yellow: { dot: '#ffdd33', glow: 'rgba(255,200,0,0.35)' },
  sep: { dot: '#cc2200', glow: 'rgba(180,20,0,0.35)' },
  off: '#1e1e1e',
} as const;

const FONT = `${ROWS - 1}px "PixelMplus12",sans-serif`;
const CHUNK_SIZE = 1024;
const THRESHOLD = 180;

interface SegLayout {
  text: string;
  typeCode: number;
  startX: number;
  w: number;
}

export class StreamingBitmap {
  readonly totalW: number;
  private segs: SegLayout[];
  private typeAt: Uint8Array;
  private chunks: (Int8Array[] | null)[];

  constructor(segments: Segment[], boardW: number) {
    const mc = document.createElement('canvas');
    const mctx = mc.getContext('2d')!;
    mctx.font = FONT;

    let x = boardW;
    this.segs = segments.map((s) => {
      const w = Math.ceil(mctx.measureText(s.text).width);
      const seg: SegLayout = {
        text: s.text,
        typeCode: s.type === 'yellow' ? 1 : s.type === 'sep' ? 2 : 0,
        startX: x,
        w,
      };
      x += w;
      return seg;
    });

    this.totalW = x;

    this.typeAt = new Uint8Array(this.totalW);
    for (const seg of this.segs) {
      for (let i = 0; i < seg.w && seg.startX + i < this.totalW; i++) {
        this.typeAt[seg.startX + i] = seg.typeCode;
      }
    }

    this.chunks = new Array(Math.ceil(this.totalW / CHUNK_SIZE)).fill(null);
  }

  getColumn(col: number): Int8Array {
    const chunkIdx = Math.floor(col / CHUNK_SIZE);
    if (this.chunks[chunkIdx] === null) {
      this.chunks[chunkIdx] = this.renderChunk(chunkIdx);
    }
    return this.chunks[chunkIdx]![col - chunkIdx * CHUNK_SIZE];
  }

  private renderChunk(chunkIdx: number): Int8Array[] {
    const startCol = chunkIdx * CHUNK_SIZE;
    const chunkW = Math.min(CHUNK_SIZE, this.totalW - startCol);

    const PAD = 4;
    const renderH = ROWS + PAD * 2;
    const canvas = document.createElement('canvas');
    canvas.width = chunkW;
    canvas.height = renderH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, chunkW, renderH);
    ctx.font = FONT;
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#fff';

    for (const seg of this.segs) {
      const drawX = seg.startX - startCol;
      if (drawX + seg.w > 0 && drawX < chunkW) {
        ctx.fillText(seg.text, drawX, PAD + ROWS);
      }
    }

    const imgd = ctx.getImageData(0, 0, chunkW, renderH).data;
    const data: Int8Array[] = new Array(chunkW);
    for (let col = 0; col < chunkW; col++) {
      const t = this.typeAt[startCol + col];
      const colData = new Int8Array(ROWS);
      for (let row = 0; row < ROWS; row++) {
        const idx = ((PAD + row) * chunkW + col) * 4;
        colData[row] = imgd[idx] > THRESHOLD ? t : -1;
      }
      data[col] = colData;
    }
    return data;
  }
}

export class LedBoard {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private boardW: number;
  private bitmap: StreamingBitmap | null = null;
  private pendingBitmap: StreamingBitmap | null = null;
  private offset = 0;
  private frameCount = FPS_DIV - 1;
  private rafId: number | null = null;
  private currentSegments: Segment[] = [];
  private resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, width?: number) {
    this.canvas = canvas;
    this.boardW = width ?? canvas.parentElement?.clientWidth ?? 700;
    this.canvas.width = this.boardW;
    this.canvas.height = ROWS * STEP + GAP_PX * 2;
    this.ctx = canvas.getContext('2d')!;

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
  }

  private onResize(): void {
    const newW = this.canvas.parentElement?.clientWidth ?? this.boardW;
    if (newW === this.boardW || newW === 0) return;
    this.boardW = newW;
    this.canvas.width = newW;
    if (this.currentSegments.length > 0) {
      this.bitmap = new StreamingBitmap(this.currentSegments, this.boardW);
      this.offset = this.boardW - Math.ceil(this.boardW / STEP);
      this.pendingBitmap = null;
      this.frameCount = 0;
    }
  }

  setSegments(segments: Segment[]): void {
    if (segments.length === 0) return;
    this.currentSegments = segments;
    const newBitmap = new StreamingBitmap(segments, this.boardW);
    if (this.bitmap === null) {
      this.bitmap = newBitmap;
      this.offset = this.boardW - Math.ceil(this.boardW / STEP);
      this.frameCount = 0;
    } else {
      this.pendingBitmap = newBitmap;
    }
  }

  start(): void {
    const loop = () => {
      this.draw();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.resizeObserver.disconnect();
  }

  private draw(): void {
    this.frameCount++;
    if (this.frameCount < FPS_DIV) return;
    this.frameCount = 0;

    const { ctx, canvas } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.boardW, canvas.height);

    if (!this.bitmap) return;

    const { totalW } = this.bitmap;
    const VISIBLE = Math.ceil(this.boardW / STEP);

    type DotKind = 'normal' | 'yellow' | 'sep' | 'off';
    const paths: Record<DotKind, { cx: number; cy: number }[]> = {
      normal: [], yellow: [], sep: [], off: [],
    };

    for (let i = 0; i < VISIBLE; i++) {
      const srcCol = (this.offset + i) % totalW;
      const px = i * STEP;

      const col = this.bitmap.getColumn(srcCol);
      for (let row = 0; row < ROWS; row++) {
        const py = GAP_PX + row * STEP;
        const cx = px + DOT_PX / 2;
        const cy = py + DOT_PX / 2;
        const v = col[row];

        if (v >= 0) {
          const key: DotKind = v === 1 ? 'yellow' : v === 2 ? 'sep' : 'normal';
          paths[key].push({ cx, cy });
        } else {
          paths.off.push({ cx, cy });
        }
      }
    }

    const TWO_PI = Math.PI * 2;
    for (const key of ['normal', 'yellow', 'sep'] as const) {
      const dots = paths[key];
      if (dots.length === 0) continue;
      ctx.fillStyle = COLORS[key].glow;
      ctx.beginPath();
      for (const { cx, cy } of dots) { ctx.moveTo(cx + DOT_PX * 1.0, cy); ctx.arc(cx, cy, DOT_PX * 1.0, 0, TWO_PI); }
      ctx.fill();
      ctx.fillStyle = COLORS[key].dot;
      ctx.beginPath();
      for (const { cx, cy } of dots) { ctx.moveTo(cx + DOT_PX * 0.44, cy); ctx.arc(cx, cy, DOT_PX * 0.44, 0, TWO_PI); }
      ctx.fill();
    }
    if (paths.off.length > 0) {
      ctx.fillStyle = COLORS.off;
      ctx.beginPath();
      for (const { cx, cy } of paths.off) { ctx.moveTo(cx + DOT_PX * 0.33, cy); ctx.arc(cx, cy, DOT_PX * 0.33, 0, TWO_PI); }
      ctx.fill();
    }

    this.offset = (this.offset + 1) % totalW;
    if (this.offset === 0) {
      if (this.pendingBitmap !== null) {
        this.bitmap = this.pendingBitmap;
        this.pendingBitmap = null;
      }
      this.offset = this.boardW - Math.ceil(this.boardW / STEP);
    }
  }
}
