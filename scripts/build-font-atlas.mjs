/**
 * Build-time font atlas generator for PixelMplus12.
 *
 * Renders every glyph at 12px using node-canvas (Cairo) and outputs a
 * compact binary file that the browser can load at runtime, bypassing
 * the per-engine Canvas fillText differences entirely.
 *
 * Binary format:
 *   uint32  N  – number of glyphs
 *   N entries (sorted by codepoint):
 *     uint32  codepoint
 *     uint8   width  (advance width in pixels)
 *     width × uint16 column bitmaps (bit i set = row i is ON)
 *
 * Usage: node scripts/build-font-atlas.mjs
 */

import { createCanvas, registerFont } from 'canvas';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_PATH = resolve(__dirname, '../public/fonts/PixelMplus12-Regular.ttf');
const OUT_PATH = resolve(__dirname, '../public/fonts/PixelMplus12-atlas.bin');

registerFont(FONT_PATH, { family: 'PixelMplus12' });

const ROWS = 13;
const FONT = `${ROWS - 1}px "PixelMplus12"`;
const PAD = 4;
const RENDER_H = ROWS + PAD * 2;
const THRESHOLD = 0; // With antialias=none, values are 0 or 255 only

// Unicode ranges to include
const RANGES = [
  [0x0020, 0x007e], // ASCII printable
  [0x00a1, 0x00ff], // Latin-1 Supplement
  [0x2010, 0x2027], // General Punctuation (subset)
  [0x2030, 0x205e], // General Punctuation (subset)
  [0x2190, 0x21ff], // Arrows
  [0x2500, 0x257f], // Box Drawing
  [0x25a0, 0x25ff], // Geometric Shapes
  [0x2600, 0x26ff], // Miscellaneous Symbols
  [0x3000, 0x303f], // CJK Symbols and Punctuation
  [0x3040, 0x309f], // Hiragana
  [0x30a0, 0x30ff], // Katakana
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xff00, 0xffef], // Halfwidth and Fullwidth Forms
];

const canvas = createCanvas(128, RENDER_H);
const ctx = canvas.getContext('2d');
ctx.antialias = 'none'; // Pixel font: disable AA for clean binary output

// Render the .notdef glyph to detect unsupported characters
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, 128, RENDER_H);
ctx.font = FONT;
ctx.textBaseline = 'bottom';
ctx.fillStyle = '#fff';
ctx.fillText('\uffff', 0, PAD + ROWS); // unlikely to have a real glyph
const notdefData = ctx.getImageData(0, 0, 128, RENDER_H).data.slice();

function isNotdef(imgData, w) {
  // Compare rendered glyph against .notdef
  for (let col = 0; col < Math.min(w, 128); col++) {
    for (let row = 0; row < RENDER_H; row++) {
      const idx = (row * 128 + col) * 4;
      if (imgData[idx] !== notdefData[idx]) return false;
    }
  }
  return true;
}

/** @type {Map<number, { width: number, columns: number[] }>} */
const glyphs = new Map();

for (const [start, end] of RANGES) {
  for (let cp = start; cp <= end; cp++) {
    const ch = String.fromCodePoint(cp);

    ctx.font = FONT;
    const w = Math.ceil(ctx.measureText(ch).width);
    if (w <= 0 || w > 127) continue;

    // Render
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 128, RENDER_H);
    ctx.font = FONT;
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#fff';
    ctx.fillText(ch, 0, PAD + ROWS);

    const imgd = ctx.getImageData(0, 0, 128, RENDER_H).data;

    // Skip .notdef glyphs
    if (isNotdef(imgd, w)) continue;

    // Extract column bitmaps
    const columns = [];
    for (let col = 0; col < w; col++) {
      let bits = 0;
      for (let row = 0; row < ROWS; row++) {
        const idx = ((PAD - 1 + row) * 128 + col) * 4;
        if (imgd[idx] > THRESHOLD) {
          bits |= 1 << row;
        }
      }
      columns.push(bits);
    }

    glyphs.set(cp, { width: w, columns });
  }
}

// Sort by codepoint
const sorted = [...glyphs.entries()].sort((a, b) => a[0] - b[0]);

// Calculate binary size
// 4 bytes (N) + per glyph: 4 (cp) + 1 (w) + w*2 (columns)
let totalSize = 4;
for (const [, g] of sorted) {
  totalSize += 4 + 1 + g.width * 2;
}

const buf = Buffer.alloc(totalSize);
let offset = 0;

buf.writeUInt32LE(sorted.length, offset);
offset += 4;

for (const [cp, g] of sorted) {
  buf.writeUInt32LE(cp, offset);
  offset += 4;
  buf.writeUInt8(g.width, offset);
  offset += 1;
  for (const col of g.columns) {
    buf.writeUInt16LE(col, offset);
    offset += 2;
  }
}

writeFileSync(OUT_PATH, buf);

console.log(`Font atlas generated: ${sorted.length} glyphs, ${totalSize} bytes`);
console.log(`Output: ${OUT_PATH}`);
