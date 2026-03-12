import { describe, expect, it } from 'vitest';

import type { Segment } from './sources';
import { StreamingBitmap } from './led-board';

// LED dot grid = array of columns, each column is Int8Array of ROWS values
// value >= 0: dot is on (0=normal, 1=yellow, 2=sep), -1: off
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
    const bitmap = new StreamingBitmap(segments, boardW);

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
    const bitmap = new StreamingBitmap(segments, boardW);

    const first = bitmap.getColumn(boardW);
    const second = bitmap.getColumn(boardW);
    expect(second).toBe(first);
  });

  it('text area contains at least some lit dots', () => {
    const segments: Segment[] = [{ text: 'LED', type: 'normal' }];
    const bitmap = new StreamingBitmap(segments, boardW);

    // text starts at column boardW
    let litDots = 0;
    for (let col = boardW; col < bitmap.totalW; col++) {
      for (const v of bitmap.getColumn(col)) {
        if (v >= 0) litDots++;
      }
    }

    expect(litDots).toBeGreaterThan(0);
  });

  it('yellow segments produce type code 1 in lit dots', () => {
    const segments: Segment[] = [{ text: 'ALERT', type: 'yellow' }];
    const bitmap = new StreamingBitmap(segments, boardW);

    let foundYellow = false;
    for (let col = 0; col < bitmap.totalW && !foundYellow; col++) {
      for (const v of bitmap.getColumn(col)) {
        if (v === 1) { foundYellow = true; break; }
      }
    }

    expect(foundYellow).toBe(true);
  });

  it('blank area before text has no lit dots', () => {
    const segments: Segment[] = [{ text: 'GAP', type: 'normal' }];
    const bitmap = new StreamingBitmap(segments, boardW);

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
