import { Scheduler } from './scheduler';
import { LedBoard } from './led-board';
import { RssSource, WebSocketSource } from './sources';
import type { Segment, SegmentType } from './sources';

// ── Query params ──────────────────────────────────────────
const params = new URLSearchParams(location.search);
const sourceType = params.get('type') ?? 'rss';
const sourceUrl = params.get('url');
const segmentType = (params.get('segmentType') as SegmentType | null) ?? 'normal';

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
  // Default: NHK RSS (needs CORS proxy in production)
  scheduler.register(
    new RssSource({
      id: 'nhk-world',
      url: 'https://www.nhk.or.jp/rss/news/cat0.xml',
      intervalMs: 5 * 60 * 1000,
      corsProxy: '/proxy?url=',
      segmentType: 'normal',
    })
  );
}

// ── LED Board ─────────────────────────────────────────────
const canvas = document.getElementById('ledCanvas') as HTMLCanvasElement;
const board = new LedBoard(canvas);

document.fonts.load('12px "PixelMplus12"').then(() => {
  board.start();
  scheduler.setOnUpdate((segments) => {
    board.setSegments(segments);
  });
  board.setSegments(scheduler.getSegments());
});
