import { Scheduler } from "./scheduler"
import { LedBoard } from "./led-board"
import { SampleSource } from "./sources"
// import { RssSource } from "./sources"

// ── Sources ──────────────────────────────────────────────
const scheduler = new Scheduler()

scheduler.register(new SampleSource())

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
const canvas = document.getElementById("ledCanvas") as HTMLCanvasElement
const board = new LedBoard(canvas)
board.start()

scheduler.setOnUpdate((segments) => {
  board.setSegments(segments)
})

// ── Clock ─────────────────────────────────────────────────
const clockEl = document.getElementById("clock")!
function updateClock() {
  const now = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  clockEl.textContent = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`
}
updateClock()
setInterval(updateClock, 1000)
