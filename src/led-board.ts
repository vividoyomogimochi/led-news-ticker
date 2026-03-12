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

const FONT = `bold ${ROWS - 2}px "Yu Gothic UI","Yu Gothic","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif`;

interface Bitmap {
  data: Int8Array[];
  totalW: number;
}

function buildBitmap(segments: Segment[], boardW: number): Bitmap {
  // Measure widths
  const mc = document.createElement('canvas');
  const mctx = mc.getContext('2d')!;
  mctx.font = FONT;
  const segs = segments.map((s) => ({
    ...s,
    w: Math.ceil(mctx.measureText(s.text).width),
  }));
  const textW = segs.reduce((a, s) => a + s.w, 0);

  // Draw text on offscreen canvas
  const totalW = boardW + textW;
  const src = document.createElement('canvas');
  src.width = totalW;
  src.height = ROWS;
  const sctx = src.getContext('2d')!;
  sctx.fillStyle = '#000';
  sctx.fillRect(0, 0, totalW, ROWS);
  sctx.font = FONT;
  sctx.textBaseline = 'middle';
  sctx.fillStyle = '#fff';

  let drawX = boardW;
  for (const seg of segs) {
    sctx.fillText(seg.text, drawX, ROWS / 2);
    drawX += seg.w;
  }

  // Build type-per-column table
  const typeAt = new Uint8Array(totalW);
  let tx = boardW;
  for (const seg of segs) {
    const t = seg.type === 'yellow' ? 1 : seg.type === 'sep' ? 2 : 0;
    for (let i = 0; i < seg.w && tx + i < totalW; i++) typeAt[tx + i] = t;
    tx += seg.w;
  }

  // Binarize pixels
  const imgd = sctx.getImageData(0, 0, totalW, ROWS).data;
  const THRESHOLD = 180;
  const data = new Array<Int8Array>(totalW);
  for (let col = 0; col < totalW; col++) {
    const col_data = new Int8Array(ROWS);
    const t = typeAt[col];
    for (let row = 0; row < ROWS; row++) {
      const idx = (row * totalW + col) * 4;
      col_data[row] = imgd[idx] > THRESHOLD ? t : -1;
    }
    data[col] = col_data;
  }

  return { data, totalW };
}

export class LedBoard {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private boardW: number;
  private bitmap: Bitmap | null = null;
  private pendingBitmap: Bitmap | null = null;
  private offset = 0;
  private frameCount = 0;
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
      const newBitmap = buildBitmap(this.currentSegments, this.boardW);
      this.bitmap = newBitmap;
      this.offset = this.boardW - Math.ceil(this.boardW / STEP);
      this.pendingBitmap = null;
      this.frameCount = 0;
    }
  }

  setSegments(segments: Segment[]): void {
    if (segments.length === 0) return;
    this.currentSegments = segments;
    const newBitmap = buildBitmap(segments, this.boardW);
    if (this.bitmap === null) {
      // No current content — start immediately, text entering from right edge
      this.bitmap = newBitmap;
      this.offset = this.boardW - Math.ceil(this.boardW / STEP);
      this.frameCount = 0;
    } else {
      // Let the current scroll cycle finish, then switch
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
    const { ctx, canvas } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.boardW, canvas.height);

    if (!this.bitmap) return;

    const { data, totalW } = this.bitmap;
    const VISIBLE = Math.ceil(this.boardW / STEP);

    for (let i = 0; i < VISIBLE; i++) {
      const srcCol = (this.offset + i) % totalW;
      const px = i * STEP;

      for (let row = 0; row < ROWS; row++) {
        const py = GAP_PX + row * STEP;
        const cx = px + DOT_PX / 2;
        const cy = py + DOT_PX / 2;
        const v = data[srcCol][row];

        if (v >= 0) {
          const key = v === 1 ? 'yellow' : v === 2 ? 'sep' : 'normal';
          ctx.fillStyle = COLORS[key].glow;
          ctx.beginPath();
          ctx.arc(cx, cy, DOT_PX * 1.0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = COLORS[key].dot;
          ctx.beginPath();
          ctx.arc(cx, cy, DOT_PX * 0.44, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = COLORS.off;
          ctx.beginPath();
          ctx.arc(cx, cy, DOT_PX * 0.33, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    this.frameCount++;
    if (this.frameCount >= FPS_DIV) {
      this.frameCount = 0;
      this.offset = (this.offset + 1) % totalW;
      if (this.offset === 0) {
        // Cycle complete — apply pending bitmap if any
        if (this.pendingBitmap !== null) {
          this.bitmap = this.pendingBitmap;
          this.pendingBitmap = null;
        }
        this.offset = this.boardW - Math.ceil(this.boardW / STEP);
      }
    }
  }
}
