import { Scheduler } from './scheduler';
import { LedBoard } from './led-board';
import { SampleSource } from './sources';
// import { RssSource } from "./sources"

// ── Sources ──────────────────────────────────────────────
const scheduler = new Scheduler();

scheduler.register(new SampleSource());

// Example: NHK RSS (needs CORS proxy in production)
// scheduler.register(
//   new RssSource({
//     id: "nhk-world",
//     url: "https://www.nhk.or.jp/rss/news/cat0.xml",
//     intervalMs: 5 * 60 * 1000,
//     corsProxy: "https://allorigins.win/raw?url=",
//     segmentType: "normal",
//   })
// )

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
