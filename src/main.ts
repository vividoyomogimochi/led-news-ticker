import { Scheduler } from './scheduler';
import { LedBoard } from './led-board';
import { colorEntryFromHex } from './led-colors';
import type { LedColorScheme } from './led-colors';
import { FontAtlas } from './font-atlas';
import { RssSource, WebSocketSource, SseSource } from './sources';
import type { Segment, SegmentType } from './sources';

// ── Query params ──────────────────────────────────────────
const params = new URLSearchParams(location.search);

// ── Color overrides from query ────────────────────────────
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const colorOverrides: Partial<LedColorScheme> = {};
for (const role of ['normal', 'accent', 'sep'] as const) {
  const hex = params.get(`${role}Color`);
  if (hex && HEX_RE.test(hex)) {
    colorOverrides[role] = colorEntryFromHex(hex);
  }
}
const offHex = params.get('offColor');
if (offHex && HEX_RE.test(offHex)) {
  colorOverrides.off = offHex;
}

// ── Sources ──────────────────────────────────────────────
const scheduler = new Scheduler();

function makeStreamParser(defaultType: SegmentType) {
  return (event: MessageEvent): Segment | null => {
    const data = event.data as string;
    try {
      const obj = JSON.parse(data) as { text?: string; type?: string };
      if (typeof obj.text === 'string') {
        return {
          text: obj.text,
          type: (obj.type as SegmentType) ?? defaultType,
        };
      }
    } catch {
      // plain text fallback
    }
    return typeof data === 'string' && data.trim()
      ? { text: data.trim(), type: defaultType }
      : null;
  };
}

function registerSource(suffix: string): boolean {
  const srcType = params.get('type' + suffix) ?? 'rss';
  const srcUrl = params.get('url' + suffix);
  const noProxy = params.get('noproxy' + suffix) === '1';
  const segType = (params.get('segmentType' + suffix) as SegmentType | null) ?? 'normal';
  if (!srcUrl) return false;

  if (srcType === 'ws') {
    scheduler.register(
      new WebSocketSource({
        id: 'query-ws' + suffix,
        url: srcUrl,
        parseMessage: makeStreamParser(segType),
      })
    );
  } else if (srcType === 'sse') {
    scheduler.register(
      new SseSource({
        id: 'query-sse' + suffix,
        url: srcUrl,
        parseMessage: makeStreamParser(segType),
      })
    );
  } else {
    const intervalMs = Number(params.get('interval' + suffix)) || 5 * 60 * 1000;
    scheduler.register(
      new RssSource({
        id: 'query-rss' + suffix,
        url: srcUrl,
        intervalMs,
        corsProxy: noProxy ? '' : '/proxy?url=',
        segmentType: segType,
      })
    );
  }
  return true;
}

// Register primary source (no suffix) and numbered sources (2, 3, 4, ...)
let hasSource = registerSource('');
for (let i = 2; ; i++) {
  if (!registerSource(String(i))) break;
  hasSource = true;
}

if (!hasSource) {
  scheduler.register(
    new RssSource({
      id: 'nhk-world',
      url: 'https://kyoko-np.net/index.xml',
      intervalMs: 5 * 60 * 1000,
      corsProxy: '/proxy?url=',
      segmentType: 'normal',
    })
  );
}

// ── LED Board ─────────────────────────────────────────────
const canvas = document.getElementById('ledCanvas') as HTMLCanvasElement;

FontAtlas.load('/fonts/led-ticker-font-atlas.bin').then((atlas) => {
  const board = new LedBoard(canvas, atlas, { colors: colorOverrides });
  const isStreaming = ['', ...Array.from({ length: 9 }, (_, i) => String(i + 2))].some((s) => {
    const t = params.get('type' + s);
    return t === 'ws' || t === 'sse';
  });
  const fallback: Segment = { text: 'LED News Ticker Headline', type: 'normal' };
  board.setRequestNext(() => {
    // Skip messages containing characters the font cannot render
    for (let i = 0; i < 16; i++) {
      const seg = scheduler.dequeue();
      if (!seg) return isStreaming ? null : fallback;
      if (atlas.canRender(seg.text)) return seg;
    }
    return isStreaming ? null : fallback;
  });
  board.start();

  // Notify parent frame of height after canvas is properly sized
  if (window.parent !== window) {
    const ro = new ResizeObserver(() => {
      window.parent.postMessage({ type: 'ticker-height', height: document.body.scrollHeight }, '*');
    });
    ro.observe(document.body);
  }
});
