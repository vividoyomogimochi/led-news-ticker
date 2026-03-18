/**
 * Pack URLSearchParams into a compact, URL-safe string.
 *
 * Format: "1" + base64url(deflate-raw(JSON with short keys))
 *   "1" = version byte (uncompressed JSON fallback uses "0")
 *
 * Colors are stored without '#' prefix.
 */

const KEY_MAP: Record<string, string> = {
  type: 't',
  url: 'u',
  interval: 'i',
  bg: 'b',
  audio: 'a',
  normalColor: 'nc',
  accentColor: 'ac',
  sepColor: 'sc',
  offColor: 'oc',
  segmentType: 'st',
};

const COLOR_KEYS_SET = new Set(['normalColor', 'accentColor', 'sepColor', 'offColor']);

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function packParams(params: URLSearchParams): Promise<string> {
  const obj: Record<string, string | number> = {};
  for (const [k, v] of params) {
    const short = KEY_MAP[k] ?? k;
    if (COLOR_KEYS_SET.has(k)) {
      obj[short] = v.replace(/^#/, '');
    } else if (k === 'interval') {
      obj[short] = Number(v);
    } else {
      obj[short] = v;
    }
  }
  const json = JSON.stringify(obj);
  const encoded = new TextEncoder().encode(json);

  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(encoded);
    writer.close();
    const chunks: Uint8Array[] = [];
    const reader = cs.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const compressed = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      compressed.set(c, offset);
      offset += c.length;
    }
    return '1' + toBase64Url(compressed);
  }

  // Fallback: uncompressed
  return '0' + toBase64Url(encoded);
}
