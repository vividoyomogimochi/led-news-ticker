/**
 * Runtime loader for the pre-built PixelMplus12 bitmap font atlas.
 *
 * The atlas is a binary file generated at build time by
 * scripts/build-font-atlas.mjs using node-canvas (Cairo).
 * Because every glyph is pre-rendered, the result is identical
 * across all browser engines.
 */

const ROWS = 13;

export interface Glyph {
  width: number;
  /** One Uint16 per column – bit i set means row i is ON */
  columns: Uint16Array;
}

export class FontAtlas {
  private glyphs: Map<number, Glyph>;

  private constructor(glyphs: Map<number, Glyph>) {
    this.glyphs = glyphs;
  }

  static async load(url: string): Promise<FontAtlas> {
    const res = await fetch(url);
    const arrayBuf = await res.arrayBuffer();
    const view = new DataView(arrayBuf);

    const glyphs = new Map<number, Glyph>();
    let offset = 0;

    const n = view.getUint32(offset, true);
    offset += 4;

    for (let i = 0; i < n; i++) {
      const cp = view.getUint32(offset, true);
      offset += 4;
      const width = view.getUint8(offset);
      offset += 1;
      const columns = new Uint16Array(width);
      for (let c = 0; c < width; c++) {
        columns[c] = view.getUint16(offset, true);
        offset += 2;
      }
      glyphs.set(cp, { width, columns });
    }

    return new FontAtlas(glyphs);
  }

  /** For tests: build from raw glyph map */
  static fromMap(glyphs: Map<number, Glyph>): FontAtlas {
    return new FontAtlas(glyphs);
  }

  getGlyph(codepoint: number): Glyph | undefined {
    return this.glyphs.get(codepoint);
  }

  /** Sum of advance widths for each character in the string */
  measureText(text: string): number {
    let w = 0;
    for (const ch of text) {
      const g = this.glyphs.get(ch.codePointAt(0)!);
      if (g) w += g.width;
    }
    return w;
  }

  /**
   * Get a column's row data for a character at a local column offset.
   * Returns a bitmask (uint16) where bit i = row i.
   * Returns 0 (all off) if the character or column is not found.
   */
  getColumnBits(codepoint: number, localCol: number): number {
    const g = this.glyphs.get(codepoint);
    if (!g || localCol < 0 || localCol >= g.width) return 0;
    return g.columns[localCol];
  }

  /** Return true if every renderable character in the string has a glyph. */
  canRender(text: string): boolean {
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      // Skip ASCII control characters and whitespace – they don't need glyphs
      if (cp <= 0x20) continue;
      if (!this.glyphs.has(cp)) return false;
    }
    return true;
  }

  get rows(): number {
    return ROWS;
  }
}
