import type { Segment } from './sources';
import type { FontAtlas } from './font-atlas';

const DOT_PX = 5;
const GAP_PX = 1;
const STEP = DOT_PX + GAP_PX;
const ROWS = 13;
const SCROLL_MS = 1000 / 15; // 15px/sec (same as 60fps × FPS_DIV=4)

export interface LedColorEntry { dot: string; glow: string }

export interface LedColorScheme {
  normal: LedColorEntry;
  accent: LedColorEntry;
  sep: LedColorEntry;
  off: string;
}

export const DEFAULT_COLORS: LedColorScheme = {
  normal: { dot: '#e0e0e0', glow: 'rgba(200,200,200,0.35)' },
  accent: { dot: '#ffdd33', glow: 'rgba(255,200,0,0.35)' },
  sep: { dot: '#cc2200', glow: 'rgba(180,20,0,0.35)' },
  off: '#1e1e1e',
};

/** Parse a hex color (#rrggbb) into an rgba glow string */
function hexToGlow(hex: string, alpha = 0.35): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function colorEntryFromHex(hex: string): LedColorEntry {
  return { dot: hex, glow: hexToGlow(hex) };
}

interface CharEntry {
  codepoint: number;
  typeCode: number;
  startX: number;
  width: number;
}

export class StreamingBitmap {
  totalW: number;
  private chars: CharEntry[];
  private atlas: FontAtlas;
  private columnCache: Map<number, Int8Array> = new Map();

  constructor(segments: Segment[], leadingGap: number, atlas: FontAtlas) {
    this.atlas = atlas;

    let x = leadingGap;
    this.chars = [];

    for (const seg of segments) {
      const typeCode = seg.type === 'accent' ? 1 : seg.type === 'sep' ? 2 : 0;
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

  /** Append segments to the end of the bitmap. Returns the column where the new content starts. */
  append(segments: Segment[]): number {
    const startCol = this.totalW;
    let x = this.totalW;
    for (const seg of segments) {
      const typeCode = seg.type === 'accent' ? 1 : seg.type === 'sep' ? 2 : 0;
      for (const ch of seg.text) {
        const cp = ch.codePointAt(0)!;
        const glyph = this.atlas.getGlyph(cp);
        const w = glyph ? glyph.width : 0;
        if (w > 0) {
          this.chars.push({ codepoint: cp, typeCode, startX: x, width: w });
          x += w;
        }
      }
    }
    this.totalW = x;
    return startCol;
  }

  /** Remove chars fully before the given column to free memory. */
  trimBefore(col: number): void {
    let firstKeep = this.chars.length;
    for (let i = 0; i < this.chars.length; i++) {
      if (this.chars[i].startX + this.chars[i].width > col) {
        firstKeep = i;
        break;
      }
    }
    if (firstKeep > 0) {
      this.chars = this.chars.slice(firstKeep);
      for (const key of this.columnCache.keys()) {
        if (key < col) this.columnCache.delete(key);
      }
    }
  }

  getColumn(col: number): Int8Array {
    if (col >= this.totalW) {
      return new Int8Array(ROWS).fill(-1);
    }

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

const SEP_SEGMENT: Segment = { text: '  ●  ', type: 'sep' };

export class LedBoard {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private boardW: number;
  private atlas: FontAtlas;
  private colors: LedColorScheme;
  private bitmap: StreamingBitmap | null = null;
  private offset = 0;
  private lastDrawTime = 0;
  private rafId: number | null = null;
  private resizeObserver: ResizeObserver;
  private requestNext: (() => Segment) | null = null;
  private triggerCol = 0;
  private triggered = false;

  constructor(canvas: HTMLCanvasElement, atlas: FontAtlas, options?: { width?: number; colors?: Partial<LedColorScheme> }) {
    this.canvas = canvas;
    this.atlas = atlas;
    this.colors = { ...DEFAULT_COLORS, ...options?.colors };
    this.boardW = options?.width ?? canvas.parentElement?.clientWidth ?? 700;
    this.canvas.width = this.boardW;
    this.canvas.height = ROWS * STEP + GAP_PX * 2;
    this.ctx = canvas.getContext('2d')!;

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
  }

  setRequestNext(cb: () => Segment): void {
    this.requestNext = cb;
  }

  /** Pop the first message and build the initial bitmap with leading gap. */
  private initFirst(): void {
    if (!this.requestNext) return;
    const segment = this.requestNext();
    this.bitmap = new StreamingBitmap([segment], this.boardW, this.atlas);
    this.triggerCol = this.bitmap.totalW;
    this.bitmap.append([SEP_SEGMENT]);
    this.offset = this.boardW - Math.ceil(this.boardW / STEP);
    this.triggered = false;
  }

  /** Append the next message + separator to the current bitmap. */
  private appendNext(): void {
    if (!this.requestNext || !this.bitmap) return;
    const segment = this.requestNext();
    this.bitmap.append([segment]);
    this.triggerCol = this.bitmap.totalW;
    this.bitmap.append([SEP_SEGMENT]);
    this.triggered = false;
  }

  private onResize(): void {
    const newW = this.canvas.parentElement?.clientWidth ?? this.boardW;
    if (newW === this.boardW || newW === 0) return;
    this.boardW = newW;
    this.canvas.width = newW;
    this.initFirst();
  }

  start(): void {
    this.initFirst();
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

    const VISIBLE = Math.ceil(this.boardW / STEP);

    // When the separator enters the viewport from the right, pop next message
    if (!this.triggered && this.offset + VISIBLE >= this.triggerCol) {
      this.triggered = true;
      this.appendNext();
    }

    type DotKind = 'normal' | 'accent' | 'sep' | 'off';
    const paths: Record<DotKind, { cx: number; cy: number }[]> = {
      normal: [], accent: [], sep: [], off: [],
    };

    for (let i = 0; i < VISIBLE; i++) {
      const srcCol = this.offset + i;
      const px = i * STEP;

      const col = this.bitmap.getColumn(srcCol);
      for (let row = 0; row < ROWS; row++) {
        const py = GAP_PX + row * STEP;
        const cx = px + DOT_PX / 2;
        const cy = py + DOT_PX / 2;
        const v = col[row];

        if (v >= 0) {
          const key: DotKind = v === 1 ? 'accent' : v === 2 ? 'sep' : 'normal';
          paths[key].push({ cx, cy });
        } else {
          paths.off.push({ cx, cy });
        }
      }
    }

    const TWO_PI = Math.PI * 2;
    const colors = this.colors;
    for (const key of ['normal', 'accent', 'sep'] as const) {
      const dots = paths[key];
      if (dots.length === 0) continue;
      ctx.fillStyle = colors[key].glow;
      ctx.beginPath();
      for (const { cx, cy } of dots) { ctx.moveTo(cx + DOT_PX * 1.0, cy); ctx.arc(cx, cy, DOT_PX * 1.0, 0, TWO_PI); }
      ctx.fill();
      ctx.fillStyle = colors[key].dot;
      ctx.beginPath();
      for (const { cx, cy } of dots) { ctx.moveTo(cx + DOT_PX * 0.44, cy); ctx.arc(cx, cy, DOT_PX * 0.44, 0, TWO_PI); }
      ctx.fill();
    }
    if (paths.off.length > 0) {
      ctx.fillStyle = colors.off;
      ctx.beginPath();
      for (const { cx, cy } of paths.off) { ctx.moveTo(cx + DOT_PX * 0.33, cy); ctx.arc(cx, cy, DOT_PX * 0.33, 0, TWO_PI); }
      ctx.fill();
    }

    this.offset += 1;

    // Compact old content that's scrolled well past the left edge
    if (this.offset > this.boardW * 4) {
      this.bitmap.trimBefore(this.offset - this.boardW * 2);
    }
  }
}
