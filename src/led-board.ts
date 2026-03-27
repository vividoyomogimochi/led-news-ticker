import type { Segment } from './sources';
import type { FontAtlas } from './font-atlas';
import { StreamingBitmap, ROWS } from './streaming-bitmap';
import type { LedColorScheme } from './led-colors';
import { DEFAULT_COLORS } from './led-colors';

const DOT_PX = 5;
const GAP_PX = 1;
const STEP = DOT_PX + GAP_PX;
const SCROLL_MS = 1000 / 15; // 15px/sec (same as 60fps × FPS_DIV=4)

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
  private requestNext: (() => Segment | null) | null = null;
  private triggerCol = 0;
  private triggered = false;
  private stalled = false;

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

  setRequestNext(cb: () => Segment | null): void {
    this.requestNext = cb;
  }

  /** Pop the first message and build the initial bitmap with leading gap. */
  private initFirst(): void {
    if (!this.requestNext) return;
    const segment = this.requestNext();
    if (!segment) {
      // Nothing available yet – stay blank and retry on next frame
      this.bitmap = null;
      return;
    }
    this.bitmap = new StreamingBitmap([segment], this.boardW, this.atlas);
    this.triggerCol = this.bitmap.totalW;
    this.offset = this.boardW - Math.ceil(this.boardW / STEP);
    this.triggered = false;
  }

  /** Append the next message + separator to the current bitmap. */
  private appendNext(): void {
    if (!this.requestNext || !this.bitmap) return;
    const segment = this.requestNext();
    if (!segment) {
      // Nothing available – stall scrolling at the bitmap edge
      this.stalled = true;
      return;
    }
    if (this.stalled) {
      // Insert a screen-wide gap so the new content enters from the right edge
      const VISIBLE = Math.ceil(this.boardW / STEP);
      const gap = this.offset + VISIBLE - this.bitmap.totalW;
      if (gap > 0) this.bitmap.appendGap(gap);
    } else {
      // Separate from previous content
      this.bitmap.append([SEP_SEGMENT]);
    }
    this.stalled = false;
    this.bitmap.append([segment]);
    this.triggerCol = this.bitmap.totalW;
    this.triggered = false;
  }

  private onResize(): void {
    const newW = this.canvas.parentElement?.clientWidth ?? this.boardW;
    if (newW === this.boardW || newW === 0) return;
    this.boardW = newW;
    this.canvas.width = newW;
    // Keep current bitmap and scroll position – only the viewport width changes.
    // If no bitmap exists yet, try to initialise one.
    if (!this.bitmap) this.initFirst();
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

  /** Render all LEDs in the off state (no active content). */
  private drawAllOff(): void {
    const { ctx } = this;
    const VISIBLE = Math.ceil(this.boardW / STEP);
    const TWO_PI = Math.PI * 2;
    ctx.fillStyle = this.colors.off;
    ctx.beginPath();
    for (let i = 0; i < VISIBLE; i++) {
      const px = i * STEP;
      for (let row = 0; row < ROWS; row++) {
        const cx = px + DOT_PX / 2;
        const cy = GAP_PX + row * STEP + DOT_PX / 2;
        ctx.moveTo(cx + DOT_PX * 0.33, cy);
        ctx.arc(cx, cy, DOT_PX * 0.33, 0, TWO_PI);
      }
    }
    ctx.fill();
  }

  private draw(timestamp: number): void {
    if (timestamp - this.lastDrawTime < SCROLL_MS) return;
    this.lastDrawTime = timestamp;

    const { ctx, canvas } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.boardW, canvas.height);

    if (!this.bitmap) {
      this.drawAllOff();
      this.initFirst();
      return;
    }

    const VISIBLE = Math.ceil(this.boardW / STEP);

    // When stalled (no data available), keep retrying without advancing scroll
    if (this.stalled) {
      this.appendNext();
    }

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

    // Keep scrolling unless stalled AND all content has left the viewport
    if (!this.stalled || this.offset < this.bitmap.totalW) {
      this.offset += 1;
    }

    // Compact old content that's scrolled well past the left edge
    if (this.offset > this.boardW * 4) {
      this.bitmap.trimBefore(this.offset - this.boardW * 2);
    }
  }
}
