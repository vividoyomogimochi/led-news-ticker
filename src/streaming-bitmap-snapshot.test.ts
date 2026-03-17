/**
 * LED dot VRT (snapshot tests)
 *
 * フレームを 13行×N列の ASCII アートに変換してスナップショット比較する。
 * 同じ入力からは必ず同じドット配列が生成されることを保証する。
 *
 * 文字:
 *   # = 点灯 (normal)
 *   A = 点灯 (accent)
 *   R = 点灯 (sep/red)
 *   . = 消灯
 *
 * スナップショット更新: pnpm vitest run --update-snapshots
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { registerFont, createCanvas } from 'canvas';

import type { Segment } from './sources';
import { StreamingBitmap } from './streaming-bitmap';
import { FontAtlas } from './font-atlas';
import type { Glyph } from './font-atlas';

const FONT_PATH = './public/fonts/PixelMplus12-Regular.ttf';
const ROWS = 13;
const FONT = `${ROWS - 1}px "PixelMplus12"`;
const PAD = 4;
const RENDER_H = ROWS + PAD * 2;
const THRESHOLD = 180;

type LedFrame = Int8Array[];

let atlas: FontAtlas;

function buildTestAtlas(): FontAtlas {
  const canvas = createCanvas(128, RENDER_H);
  const ctx = canvas.getContext('2d');

  const glyphs = new Map<number, Glyph>();
  const chars = new Set<string>();
  for (let cp = 0x20; cp <= 0x7e; cp++) chars.add(String.fromCodePoint(cp));
  for (const ch of 'HELLO NEWS ALERT INFO LED ● ') chars.add(ch);

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

function captureFrame(
  bitmap: StreamingBitmap,
  offset: number,
  numCols: number,
): LedFrame {
  return Array.from({ length: numCols }, (_, i) =>
    bitmap.getColumn((offset + i) % bitmap.totalW),
  );
}

/** LED ドットグリッドを人間が読める ASCII アートに変換する */
function frameToAscii(frame: LedFrame): string {
  const lines: string[] = [];
  for (let row = 0; row < ROWS; row++) {
    let line = '';
    for (const col of frame) {
      const v = col[row];
      if (v === 1) line += 'A';
      else if (v === 2) line += 'R';
      else if (v >= 0) line += '#';
      else line += '.';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

beforeAll(() => {
  registerFont(FONT_PATH, { family: 'PixelMplus12' });
  atlas = buildTestAtlas();
});

describe('StreamingBitmap LED dot snapshots', () => {
  const boardW = 200;

  it('normal text renders consistently at text start', () => {
    const segments: Segment[] = [{ text: 'HELLO', type: 'normal' }];
    const bitmap = new StreamingBitmap(segments, boardW, atlas);
    // テキストは boardW 列目から始まる
    const frame = captureFrame(bitmap, boardW, 40);
    expect(frameToAscii(frame)).toMatchSnapshot();
  });

  it('accent text renders with A dots', () => {
    const segments: Segment[] = [{ text: 'NEWS', type: 'accent' }];
    const bitmap = new StreamingBitmap(segments, boardW, atlas);
    const frame = captureFrame(bitmap, boardW, 40);
    expect(frameToAscii(frame)).toMatchSnapshot();
  });

  it('sep text renders with R dots', () => {
    const segments: Segment[] = [{ text: ' ● ', type: 'sep' }];
    const bitmap = new StreamingBitmap(segments, boardW, atlas);
    const frame = captureFrame(bitmap, boardW, 20);
    expect(frameToAscii(frame)).toMatchSnapshot();
  });

  it('mixed segments render in correct order', () => {
    const segments: Segment[] = [
      { text: 'ALERT', type: 'accent' },
      { text: ' ● ', type: 'sep' },
      { text: 'INFO', type: 'normal' },
    ];
    const bitmap = new StreamingBitmap(segments, boardW, atlas);
    const frame = captureFrame(bitmap, boardW, 80);
    expect(frameToAscii(frame)).toMatchSnapshot();
  });

  it('leading blank area is all dots-off', () => {
    const segments: Segment[] = [{ text: 'LED', type: 'normal' }];
    const bitmap = new StreamingBitmap(segments, boardW, atlas);
    const frame = captureFrame(bitmap, 0, Math.min(boardW, 20));
    expect(frameToAscii(frame)).toMatchSnapshot();
  });
});
