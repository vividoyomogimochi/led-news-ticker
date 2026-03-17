import { describe, expect, it, beforeAll } from 'vitest';
import { registerFont, createCanvas } from 'canvas';

import type { Segment } from './sources';
import { StreamingBitmap } from './led-board';
import { FontAtlas } from './font-atlas';
import type { Glyph } from './font-atlas';

const FONT_PATH = './public/fonts/PixelMplus12-Regular.ttf';
const ROWS = 13;
const FONT = `${ROWS - 1}px "PixelMplus12"`;
const PAD = 4;
const RENDER_H = ROWS + PAD * 2;
const THRESHOLD = 180;

let atlas: FontAtlas;

/** Build a test atlas from node-canvas (Cairo) – same as build script logic */
function buildTestAtlas(): FontAtlas {
  const canvas = createCanvas(128, RENDER_H);
  const ctx = canvas.getContext('2d');

  const glyphs = new Map<number, Glyph>();

  // Render all ASCII printable + test chars
  const chars = new Set<string>();
  for (let cp = 0x20; cp <= 0x7e; cp++) chars.add(String.fromCodePoint(cp));
  // Add specific chars used in tests
  for (const ch of 'HELLO WORLD CACHE LED ALERT GAP NEWS ● INFO') chars.add(ch);

  for (const ch of chars) {
    const cp = ch.codePointAt(0)!;
    ctx.font = FONT;
    const w = Math.ceil(ctx.measureText(ch).width);
    if (w <= 0) continue;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 128, RENDER_H);
    ctx.font = FONT;
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#fff';
    ctx.fillText(ch, 0, PAD + ROWS);

    const imgd = ctx.getImageData(0, 0, 128, RENDER_H).data;
    const columns = new Uint16Array(w);
    for (let col = 0; col < w; col++) {
      let bits = 0;
      for (let row = 0; row < ROWS; row++) {
        const idx = ((PAD + row) * 128 + col) * 4;
        if (imgd[idx] > THRESHOLD) {
          bits |= 1 << row;
        }
      }
      columns[col] = bits;
    }

    glyphs.set(cp, { width: w, columns });
  }

  return FontAtlas.fromMap(glyphs);
}

beforeAll(() => {
  registerFont(FONT_PATH, { family: 'PixelMplus12' });
  atlas = buildTestAtlas();
});

// LED dot grid = array of columns, each column is Int8Array of ROWS values
// value >= 0: dot is on (0=normal, 1=accent, 2=sep), -1: off
type LedFrame = Int8Array[];

function captureFrame(
  bitmap: StreamingBitmap,
  offset: number,
  numCols: number,
): LedFrame {
  return Array.from({ length: numCols }, (_, i) =>
    bitmap.getColumn((offset + i) % bitmap.totalW),
  );
}

function framesEqual(a: LedFrame, b: LedFrame): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (let j = 0; j < a[i].length; j++) {
      if (a[i][j] !== b[i][j]) return false;
    }
  }
  return true;
}

describe('StreamingBitmap LED dot frames', () => {
  const boardW = 200;
  const numCols = 20;

  it('consecutive offsets produce changing LED dot grids', () => {
    const segments: Segment[] = [{ text: 'HELLO WORLD', type: 'normal' }];
    const bitmap = new StreamingBitmap(segments, boardW, atlas);

    const frames = Array.from({ length: bitmap.totalW }, (_, offset) =>
      captureFrame(bitmap, offset, numCols),
    );

    let changes = 0;
    for (let i = 1; i < frames.length; i++) {
      if (!framesEqual(frames[i - 1], frames[i])) changes++;
    }

    expect(changes).toBeGreaterThan(0);
  });

  it('same column returns the same cached object on repeated calls', () => {
    const segments: Segment[] = [{ text: 'CACHE', type: 'normal' }];
    const bitmap = new StreamingBitmap(segments, boardW, atlas);

    const first = bitmap.getColumn(boardW);
    const second = bitmap.getColumn(boardW);
    expect(second).toBe(first);
  });

  it('text area contains at least some lit dots', () => {
    const segments: Segment[] = [{ text: 'LED', type: 'normal' }];
    const bitmap = new StreamingBitmap(segments, boardW, atlas);

    // text starts at column boardW
    let litDots = 0;
    for (let col = boardW; col < bitmap.totalW; col++) {
      for (const v of bitmap.getColumn(col)) {
        if (v >= 0) litDots++;
      }
    }

    expect(litDots).toBeGreaterThan(0);
  });

  it('accent segments produce type code 1 in lit dots', () => {
    const segments: Segment[] = [{ text: 'ALERT', type: 'accent' }];
    const bitmap = new StreamingBitmap(segments, boardW, atlas);

    let foundAccent = false;
    for (let col = 0; col < bitmap.totalW && !foundAccent; col++) {
      for (const v of bitmap.getColumn(col)) {
        if (v === 1) { foundAccent = true; break; }
      }
    }

    expect(foundAccent).toBe(true);
  });

  it('blank area before text has no lit dots', () => {
    const segments: Segment[] = [{ text: 'GAP', type: 'normal' }];
    const bitmap = new StreamingBitmap(segments, boardW, atlas);

    // columns 0..boardW-1 are the leading blank area
    let litDots = 0;
    for (let col = 0; col < boardW; col++) {
      for (const v of bitmap.getColumn(col)) {
        if (v >= 0) litDots++;
      }
    }

    expect(litDots).toBe(0);
  });
});
