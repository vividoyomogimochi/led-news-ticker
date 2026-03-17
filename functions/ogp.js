/**
 * Cloudflare Pages Function: /ogp
 *
 * Generates an OGP PNG image for ticker URLs.
 *
 * Query parameters (same as the ticker):
 *   bg          Background image URL (same-origin path only, e.g. /images/foo.jpg)
 *   audio       If present (non-empty), shows a play button overlay
 *   normalColor LED normal text color (#RRGGBB, default #e0e0e0)
 *   accentColor LED accent text color (#RRGGBB, default #ffdd33)
 *   sepColor    LED separator color (#RRGGBB, default #cc2200)
 *
 * CF Workers restriction: WebAssembly.instantiate() is not allowed dynamically.
 * The WASM module must be imported statically so wrangler compiles it at bundle time.
 */

import { initWasm, Resvg } from '@resvg/resvg-wasm';
import wasmModule from '@resvg/resvg-wasm/index_bg.wasm';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// ── WASM init ─────────────────────────────────────────────────────────────────

let wasmReady = false;

async function ensureWasm() {
  if (wasmReady) return;
  await initWasm(wasmModule);
  wasmReady = true;
}

// ── Font atlas ────────────────────────────────────────────────────────────────
// Binary format (little-endian, matches build-font-atlas.mjs output):
//   uint32  glyph count
//   per glyph: uint32 codepoint, uint8 width, width × uint16 column bits
//   column bit i = row i is ON  (ROWS = 13)

let cachedGlyphs = null;

function parseFontAtlas(buf) {
  const view = new DataView(buf);
  const glyphs = new Map();
  let offset = 0;
  const n = view.getUint32(offset, true);
  offset += 4;
  for (let i = 0; i < n; i++) {
    const cp = view.getUint32(offset, true);
    offset += 4;
    const width = view.getUint8(offset);
    offset += 1;
    const columns = [];
    for (let c = 0; c < width; c++) {
      columns.push(view.getUint16(offset, true));
      offset += 2;
    }
    glyphs.set(cp, { width, columns });
  }
  return glyphs;
}

async function getGlyphs(assets, requestUrl) {
  if (cachedGlyphs) return cachedGlyphs;
  try {
    const atlasUrl = new URL('/fonts/led-ticker-font-atlas.bin', requestUrl).href;
    const res = assets
      ? await assets.fetch(new Request(atlasUrl))
      : await fetch(atlasUrl);
    if (!res.ok) return null;
    cachedGlyphs = parseFontAtlas(await res.arrayBuffer());
  } catch {
    return null;
  }
  return cachedGlyphs;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeColor(value, fallback) {
  return value && HEX_RE.test(value) ? value : fallback;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

async function fetchBgAsDataUrl(bgUrl, originUrl, assets) {
  let parsed;
  try {
    parsed = new URL(bgUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  // Same-origin assets must be fetched via the ASSETS binding (CF Workers cannot
  // make loopback HTTP requests to themselves, even in local wrangler dev).
  const isSameOrigin = parsed.origin === new URL(originUrl).origin;

  try {
    let res;
    if (isSameOrigin && assets) {
      res = await assets.fetch(new Request(parsed.href));
    } else {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 4000);
      res = await fetch(parsed.href, {
        signal: controller.signal,
        headers: { 'User-Agent': 'led-news-ticker/1.0' },
      });
    }
    if (!res.ok) return null;
    const ct = res.headers.get('Content-Type') ?? 'image/jpeg';
    const buf = await res.arrayBuffer();
    return `data:${ct};base64,${arrayBufferToBase64(buf)}`;
  } catch {
    return null;
  }
}

// ── LED text rendering ────────────────────────────────────────────────────────

const ROWS = 13;

function measureText(text, glyphs, step) {
  let w = 0;
  for (const ch of text) {
    const g = glyphs.get(ch.codePointAt(0));
    w += g ? (g.width + 1) * step : step * 4;
  }
  return w;
}

// Renders text in a single color. Returns rects and the ending X position.
function renderText(text, glyphs, startX, startY, dot, step, color) {
  const rects = [];
  let x = startX;
  for (const ch of text) {
    const g = glyphs.get(ch.codePointAt(0));
    if (!g) {
      x += step * 4;
      continue;
    }
    for (let col = 0; col < g.width; col++) {
      const bits = g.columns[col];
      for (let row = 0; row < ROWS; row++) {
        if ((bits >> row) & 1) {
          rects.push(
            `<rect x="${x + col * step}" y="${startY + row * step}" width="${dot}" height="${dot}" fill="${color}"/>`,
          );
        }
      }
    }
    x += (g.width + 1) * step;
  }
  return { rects, endX: x };
}

// Renders colored segments centered in the bar.
// Each segment may have an optional `gap` (extra px added before it).
function renderSegments(segments, glyphs, startY, dot, step, totalW) {
  const totalTextW = segments.reduce(
    (w, s) => w + (s.gap ?? 0) + measureText(s.text, glyphs, step),
    0,
  );
  let x = Math.round((totalW - totalTextW) / 2);
  const rects = [];
  for (const { text, color, gap } of segments) {
    x += gap ?? 0;
    const result = renderText(text, glyphs, x, startY, dot, step, color);
    rects.push(...result.rects);
    x = result.endX;
  }
  return rects;
}

// ── SVG builder ───────────────────────────────────────────────────────────────

function buildSvg({ bgDataUrl, hasAudio, normalColor, accentColor, sepColor, glyphs }) {
  const W = 1200;
  const H = 630;

  // LED bar dimensions (matches the ticker's ATLAS_ROWS=13, scaled for OGP)
  const DOT = 5;
  const STEP = 6;
  const PAD_Y = 10;
  const barH = ROWS * STEP + PAD_Y * 2;
  const barY = 0;

  // Play button geometry (centered in the area below the LED bar)
  const btnCx = W / 2;
  const btnCy = barH + (H - barH) / 2;
  const btnR = 80;
  const triS = btnR * 1.2;

  const lines = [
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`,
    `<defs>`,
    `<pattern id="g" x="4" y="${barY + PAD_Y}" width="${STEP}" height="${STEP}" patternUnits="userSpaceOnUse">`,
    `<rect width="${DOT}" height="${DOT}" fill="${normalColor}" opacity="0.08"/>`,
    `</pattern>`,
    `<linearGradient id="vig" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="40%" stop-color="#000" stop-opacity="0"/>`,
    `<stop offset="100%" stop-color="#000" stop-opacity="0.55"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${W}" height="${H}" fill="#111"/>`,
  ];

  if (bgDataUrl) {
    lines.push(
      `<image href="${bgDataUrl}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`,
    );
  }

  lines.push(
    `<rect width="${W}" height="${H}" fill="url(#vig)"/>`,
    `<rect y="${barY}" width="${W}" height="${barH}" fill="rgba(0,0,0,0.88)"/>`,
    `<rect x="4" y="${barY + PAD_Y}" width="${W - 8}" height="${ROWS * STEP}" fill="url(#g)"/>`,
  );

  // Render colored segments centered in the LED bar
  if (glyphs) {
    const SEP_GAP = STEP * 2;
    const segments = [
      { text: 'LED', color: normalColor },
      { text: '\u25cf', color: sepColor, gap: SEP_GAP },
      { text: 'NEWS', color: accentColor, gap: SEP_GAP },
      { text: '\u25cf', color: sepColor, gap: SEP_GAP },
      { text: 'TICKER', color: normalColor, gap: SEP_GAP },
    ];
    lines.push(...renderSegments(segments, glyphs, barY + PAD_Y, DOT, STEP, W));
  }

  if (hasAudio) {
    lines.push(
      // Dark semi-transparent triangle with opaque white border
      `<polygon points="${btnCx - triS * 0.3},${btnCy - triS} ${btnCx - triS * 0.3},${btnCy + triS} ${btnCx + triS},${btnCy}" fill="rgba(40,40,40,0.72)" stroke="white" stroke-width="4" stroke-linejoin="round"/>`,
    );
  }

  lines.push(`</svg>`);
  return lines.join('');
}

// ── Request handler ───────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;

  try {
    await ensureWasm();
  } catch {
    return new Response('OGP image generation unavailable', { status: 503 });
  }

  const url = new URL(request.url);
  const p = url.searchParams;
  const normalColor = sanitizeColor(p.get('normalColor'), '#e0e0e0');
  const accentColor = sanitizeColor(p.get('accentColor'), '#ffdd33');
  const sepColor = sanitizeColor(p.get('sepColor'), '#cc2200');
  const hasAudio = !!p.get('audio');

  // Only generate a dynamic OGP image for same-origin bg paths (e.g. /images/foo.jpg).
  // External URLs get the static og.jpg fallback to avoid fetching arbitrary remote images.
  const bgParam = p.get('bg') ?? '';
  const bgIsLocal = bgParam.startsWith('/');
  if (bgParam && !bgIsLocal) {
    const ogUrl = new URL('/images/og.jpg', url.origin).href;
    const ogRes = env.ASSETS
      ? await env.ASSETS.fetch(new Request(ogUrl))
      : await fetch(ogUrl);
    return new Response(ogRes.body, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  }

  let bgDataUrl = null;
  if (bgIsLocal) {
    const bgAbsolute = new URL(bgParam, url.origin).href;
    bgDataUrl = await fetchBgAsDataUrl(bgAbsolute, url.href, env.ASSETS);
  }

  const glyphs = await getGlyphs(env.ASSETS, request.url);
  const svg = buildSvg({ bgDataUrl, hasAudio, normalColor, accentColor, sepColor, glyphs });

  let png;
  try {
    png = new Resvg(svg).render().asPng();
  } catch (e) {
    return new Response('Render error: ' + String(e), { status: 500 });
  }

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
