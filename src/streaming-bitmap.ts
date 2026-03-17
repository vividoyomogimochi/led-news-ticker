import type { Segment } from './sources';
import type { FontAtlas } from './font-atlas';

export const ROWS = 13;

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
