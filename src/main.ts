import { Scheduler } from './scheduler';
import { LedBoard } from './led-board';
import { colorEntryFromHex } from './led-colors';
import type { LedColorScheme } from './led-colors';
import { FontAtlas } from './font-atlas';
import { RssSource, WebSocketSource } from './sources';
import type { Segment, SegmentType } from './sources';

// ── Query params ──────────────────────────────────────────
const params = new URLSearchParams(location.search);
const sourceType = params.get('type') ?? 'rss';
const sourceUrl = params.get('url');
const segmentType = (params.get('segmentType') as SegmentType | null) ?? 'normal';

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
const scheduler = new Scheduler({ fallbackText: 'LED News Ticker Headline' });

if (sourceUrl && sourceType === 'ws') {
  scheduler.register(
    new WebSocketSource({
      id: 'query-ws',
      url: sourceUrl,
      parseMessage: (event: MessageEvent): Segment | null => {
        const data = event.data as string;
        try {
          const obj = JSON.parse(data) as { text?: string; type?: string };
          if (typeof obj.text === 'string') {
            return {
              text: obj.text,
              type: (obj.type as SegmentType) ?? segmentType,
            };
          }
        } catch {
          // plain text fallback
        }
        return typeof data === 'string' && data.trim()
          ? { text: data.trim(), type: segmentType }
          : null;
      },
    })
  );
} else if (sourceUrl && sourceType === 'rss') {
  const intervalMs = Number(params.get('interval')) || 5 * 60 * 1000;
  scheduler.register(
    new RssSource({
      id: 'query-rss',
      url: sourceUrl,
      intervalMs,
      corsProxy: '/proxy?url=',
      segmentType,
    })
  );
} else {
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
  board.setRequestNext(() => {
    // Skip messages containing characters the font cannot render
    for (let i = 0; i < 16; i++) {
      const seg = scheduler.dequeue();
      if (atlas.canRender(seg.text)) return seg;
    }
    return scheduler.fallbackSegment;
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
