/**
 * Generates thumbnail images for themes defined in public/themes.json.
 * Thumbnails are saved to public/themes/{id}.png (320×180).
 * Already-existing files are skipped.
 *
 * Usage: node scripts/gen-theme-thumbnails.mjs
 */

import { createCanvas, loadImage } from 'canvas';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const themesDir = join(publicDir, 'themes');

mkdirSync(themesDir, { recursive: true });

const data = JSON.parse(readFileSync(join(publicDir, 'themes.json'), 'utf-8'));
const themes = data.displays || [];

// Load env vars from .env and .env.local
function loadEnv() {
  const vars = {};
  for (const file of ['.env', '.env.local']) {
    const p = join(rootDir, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m) vars[m[1].trim()] = m[2].trim();
    }
  }
  return vars;
}
const DEFAULT_BG = loadEnv().VITE_DEFAULT_BG || '/images/wall.jpg';

const W = 320;
const H = 180;

// ── Font atlas ───────────────────────────────────────────────────────────────
// Binary format (little-endian):
//   uint32  glyph count
//   per glyph: uint32 codepoint, uint8 width, width × uint16 column bits
//   column bit i = row i is ON  (ROWS = 13)

const ATLAS_ROWS = 13;

function loadFontAtlas(binPath) {
  const buf = readFileSync(binPath);
  const glyphs = new Map();
  let offset = 0;
  const n = buf.readUInt32LE(offset);
  offset += 4;
  for (let i = 0; i < n; i++) {
    const cp = buf.readUInt32LE(offset);
    offset += 4;
    const width = buf.readUInt8(offset);
    offset += 1;
    const columns = new Uint16Array(width);
    for (let c = 0; c < width; c++) {
      columns[c] = buf.readUInt16LE(offset);
      offset += 2;
    }
    glyphs.set(cp, { width, columns });
  }
  return glyphs;
}

const glyphs = loadFontAtlas(join(publicDir, 'fonts/led-ticker-font-atlas.bin'));

// ── LED bar renderer ─────────────────────────────────────────────────────────

const DOT = 3;
const STEP = 4; // DOT + 1px gap
const LED_PAD_Y = 5;
const LED_BAR_H = ATLAS_ROWS * STEP + LED_PAD_Y * 2;

/**
 * Parses a hex color string (#rrggbb or #rgb) into [r, g, b].
 */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Draws a LED ticker bar at the top of the canvas,
 * rendering the theme label with the actual font atlas.
 * @param {string} [normalColor] - hex color for lit dots (default: #ffaa00)
 */
function drawLedBar(ctx, label, normalColor) {
  const barY = 0;
  const color = normalColor ?? '#e0e0e0';
  const [r, g, b] = hexToRgb(color);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(0, barY, W, LED_BAR_H);

  // Bottom border separator
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.18)`;
  ctx.fillRect(0, barY + LED_BAR_H - 1, W, 1);

  const dotY = barY + LED_PAD_Y;
  const PAD_X = 4;

  // Background grid (dim dots)
  const totalCols = Math.floor((W - PAD_X) / STEP);
  for (let col = 0; col < totalCols; col++) {
    for (let row = 0; row < ATLAS_ROWS; row++) {
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.06)`;
      ctx.fillRect(PAD_X + col * STEP, dotY + row * STEP, DOT, DOT);
    }
  }

  // Render label text using glyph bitmaps
  let x = PAD_X;
  for (const ch of label) {
    const cp = ch.codePointAt(0);
    const g = glyphs.get(cp);
    if (!g) {
      x += STEP * 4;
      continue;
    }
    for (let col = 0; col < g.width; col++) {
      const bits = g.columns[col];
      for (let row = 0; row < ATLAS_ROWS; row++) {
        if ((bits >> row) & 1) {
          ctx.fillStyle = color;
          ctx.fillRect(x + col * STEP, dotY + row * STEP, DOT, DOT);
        }
      }
    }
    x += g.width * STEP;
    if (x >= W) break;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

for (const theme of themes) {
  const outPath = join(themesDir, theme.id + '.png');

  if (existsSync(outPath)) {
    console.log(`skip  ${theme.id}`);
    continue;
  }

  console.log(`gen   ${theme.id} ...`);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Base background
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, W, H);

  // Draw background image (explicit or default)
  const bgParam = theme.params?.bg ?? DEFAULT_BG;
  if (bgParam) {
    try {
      const imgPath = bgParam.startsWith('/') ? join(publicDir, bgParam) : bgParam;
      const img = await loadImage(imgPath);
      const scale = Math.max(W / img.width, H / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
    } catch (e) {
      console.warn(`  warn: could not load bg "${bgParam}": ${e.message}`);
    }
  }

  drawLedBar(ctx, theme.label, theme.params?.normalColor);

  writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log(`  saved → ${outPath}`);
}

console.log('done.');
