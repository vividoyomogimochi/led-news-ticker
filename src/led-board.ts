import type { Segment } from './sources';
import type { FontAtlas } from './font-atlas';

const DOT_PX = 5;
const GAP_PX = 1;
const STEP = DOT_PX + GAP_PX;
const ROWS = 13;
const SCROLL_MS = 1000 / 15; // 15px/sec (same as 60fps × FPS_DIV=4)

const COLORS = {
  normal: { dot: '#e0e0e0', glow: 'rgba(200,200,200,0.35)' },
  yellow: { dot: '#ffdd33', glow: 'rgba(255,200,0,0.35)' },
  sep: { dot: '#cc2200', glow: 'rgba(180,20,0,0.35)' },
  off: '#1e1e1e',
} as const;

interface CharEntry {
  codepoint: number;
  typeCode: number;
  startX: number;
  width: number;
}

export class StreamingBitmap {
  readonly totalW: number;
  private chars: CharEntry[];
  private atlas: FontAtlas;
  private columnCache: Map<number, Int8Array> = new Map();

  constructor(segments: Segment[], boardW: number, atlas: FontAtlas) {
    this.atlas = atlas;

    let x = boardW;
    this.chars = [];

    for (const seg of segments) {
      const typeCode = seg.type === 'yellow' ? 1 : seg.type === 'sep' ? 2 : 0;
      for (const ch of seg.text) {
        const cp = ch.codePointAt(0)!;
        const glyph = atlas.getGlyph(cp);
        const w = glyph ? glyph.width : 0;
        if (w > 0) {
          this.chars.push({ codepoint: cp, typeCode, startX: x, width: w });
          x += w;
        }
      }
    }

    this.totalW = x;
  }

  getColumn(col: number): Int8Array {
    const cached = this.columnCache.get(col);
    if (cached) return cached;

    const colData = new Int8Array(ROWS).fill(-1);

    // Binary search to find which character contains this column
    const entry = this.findChar(col);
    if (entry) {
      const localCol = col - entry.startX;
      const bits = this.atlas.getColumnBits(entry.codepoint, localCol);
      for (let row = 0; row < ROWS; row++) {
        if ((bits >> row) & 1) {
          colData[row] = entry.typeCode;
        }
      }
    }

    this.columnCache.set(col, colData);
    return colData;
  }

  private findChar(col: number): CharEntry | null {
    const chars = this.chars;
    let lo = 0;
    let hi = chars.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const entry = chars[mid];
      if (col < entry.startX) {
        hi = mid - 1;
      } else if (col >= entry.startX + entry.width) {
        lo = mid + 1;
      } else {
        return entry;
      }
    }
    return null;
  }
}

export class LedBoard {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private boardW: number;
  private atlas: FontAtlas;
  private bitmap: StreamingBitmap | null = null;
  private pendingBitmap: StreamingBitmap | null = null;
  private offset = 0;
  private lastDrawTime = 0;
  private rafId: number | null = null;
  private currentSegments: Segment[] = [];
  private resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, atlas: FontAtlas, width?: number) {
    this.canvas = canvas;
    this.atlas = atlas;
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
      this.bitmap = new StreamingBitmap(this.currentSegments, this.boardW, this.atlas);
      this.offset = this.boardW - Math.ceil(this.boardW / STEP);
      this.pendingBitmap = null;
    }
  }

  setSegments(segments: Segment[]): void {
    if (segments.length === 0) return;
    this.currentSegments = segments;
    const newBitmap = new StreamingBitmap(segments, this.boardW, this.atlas);
    if (this.bitmap === null) {
      this.bitmap = newBitmap;
      this.offset = this.boardW - Math.ceil(this.boardW / STEP);
    } else {
      this.pendingBitmap = newBitmap;
    }
  }

  start(): void {
    const loop = (timestamp: number) => {
      this.draw(timestamp);
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

  private draw(timestamp: number): void {
    if (timestamp - this.lastDrawTime < SCROLL_MS) return;
    this.lastDrawTime = timestamp;

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
