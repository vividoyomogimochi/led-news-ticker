/**
 * LED dot VRT (snapshot tests)
 *
 * フレームを 13行×N列の ASCII アートに変換してスナップショット比較する。
 * 同じ入力からは必ず同じドット配列が生成されることを保証する。
 *
 * 文字:
 *   # = 点灯 (normal)
 *   Y = 点灯 (yellow)
 *   R = 点灯 (sep/red)
 *   . = 消灯
 *
 * スナップショット更新: pnpm vitest run --update-snapshots
 */

import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { registerFont } from 'canvas';

import type { Segment } from './sources';
import { StreamingBitmap } from './led-board';

const FONT_PATH = path.resolve(
  import.meta.dirname,
  '../public/fonts/PixelMplus12-Regular.ttf',
);
const ROWS = 13;

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

/** LED ドットグリッドを人間が読める ASCII アートに変換する */
function frameToAscii(frame: LedFrame): string {
  const lines: string[] = [];
  for (let row = 0; row < ROWS; row++) {
    let line = '';
    for (const col of frame) {
      const v = col[row];
      if (v === 1) line += 'Y';
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
});

describe('StreamingBitmap LED dot snapshots', () => {
  const boardW = 200;

  it('normal text renders consistently at text start', () => {
    const segments: Segment[] = [{ text: 'HELLO', type: 'normal' }];
    const bitmap = new StreamingBitmap(segments, boardW);
    // テキストは boardW 列目から始まる
    const frame = captureFrame(bitmap, boardW, 40);
    expect(frameToAscii(frame)).toMatchSnapshot();
  });

  it('yellow text renders with Y dots', () => {
    const segments: Segment[] = [{ text: 'NEWS', type: 'yellow' }];
    const bitmap = new StreamingBitmap(segments, boardW);
    const frame = captureFrame(bitmap, boardW, 40);
    expect(frameToAscii(frame)).toMatchSnapshot();
  });

  it('sep text renders with R dots', () => {
    const segments: Segment[] = [{ text: ' ● ', type: 'sep' }];
    const bitmap = new StreamingBitmap(segments, boardW);
    const frame = captureFrame(bitmap, boardW, 20);
    expect(frameToAscii(frame)).toMatchSnapshot();
  });

  it('mixed segments render in correct order', () => {
    const segments: Segment[] = [
      { text: 'ALERT', type: 'yellow' },
      { text: ' ● ', type: 'sep' },
      { text: 'INFO', type: 'normal' },
    ];
    const bitmap = new StreamingBitmap(segments, boardW);
    const frame = captureFrame(bitmap, boardW, 80);
    expect(frameToAscii(frame)).toMatchSnapshot();
  });

  it('leading blank area is all dots-off', () => {
    const segments: Segment[] = [{ text: 'LED', type: 'normal' }];
    const bitmap = new StreamingBitmap(segments, boardW);
    const frame = captureFrame(bitmap, 0, Math.min(boardW, 20));
    expect(frameToAscii(frame)).toMatchSnapshot();
  });
});
