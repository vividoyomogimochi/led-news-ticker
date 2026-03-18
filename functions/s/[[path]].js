/**
 * Decode a packed share URL and redirect to the full query-param URL.
 *
 * GET /s/<packed>  →  302 /?type=rss&url=...
 *
 * Format: "1" + base64url(deflate-raw(JSON)) or "0" + base64url(JSON)
 */

const SHORT_TO_LONG = {
  t: 'type',
  u: 'url',
  i: 'interval',
  b: 'bg',
  a: 'audio',
  nc: 'normalColor',
  ac: 'accentColor',
  sc: 'sepColor',
  oc: 'offColor',
  st: 'segmentType',
};

const COLOR_KEYS = new Set(['normalColor', 'accentColor', 'sepColor', 'offColor']);
const MAX_DECODED_SIZE = 2048;

function fromBase64Url(s) {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (padded.length % 4)) % 4;
  const bin = atob(padded + '='.repeat(pad));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_DECODED_SIZE) throw new Error('payload too large');
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.length;
  }
  return buf;
}

export async function onRequest(context) {
  const { request, params } = context;
  const packed = (params.path || []).join('/');
  if (!packed) {
    return new Response('Missing packed data', { status: 400 });
  }

  const version = packed[0];
  const payload = packed.slice(1);

  let jsonBytes;
  try {
    const raw = fromBase64Url(payload);
    if (version === '1') {
      jsonBytes = await inflate(raw);
    } else if (version === '0') {
      if (raw.length > MAX_DECODED_SIZE) throw new Error('payload too large');
      jsonBytes = raw;
    } else {
      return new Response('Unsupported version', { status: 400 });
    }
  } catch {
    return new Response('Invalid packed data', { status: 400 });
  }

  let obj;
  try {
    obj = JSON.parse(new TextDecoder().decode(jsonBytes));
  } catch {
    return new Response('Invalid JSON payload', { status: 400 });
  }

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return new Response('Invalid payload structure', { status: 400 });
  }

  const p = new URLSearchParams();
  for (const [short, val] of Object.entries(obj)) {
    const long = SHORT_TO_LONG[short] ?? short;
    if (COLOR_KEYS.has(long)) {
      p.set(long, '#' + String(val));
    } else {
      p.set(long, String(val));
    }
  }

  const url = new URL(request.url);
  const target = new URL('/', url.origin);
  target.search = p.toString();

  return Response.redirect(target.href, 302);
}
