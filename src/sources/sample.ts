import type { Source, Segment } from "./types"

const DEFAULT_ITEMS: Segment[] = [
  { text: "【速報】 国内最大級の桜前線、今週末に東京へ到達見込み", type: "yellow" },
  { text: "春の交通安全週間が本日より開始　警察庁が注意を呼びかけ", type: "normal" },
  { text: "【気象情報】 関東地方は週明けから気温低下の予報　最高気温12度まで下がる見通し", type: "yellow" },
  { text: "都内の鉄道各社、ダイヤ改正を来月より実施　終電時刻に変更", type: "normal" },
  { text: "国際宇宙ステーションで新実験が開始　日本人飛行士も参加", type: "normal" },
]

interface SampleSourceOptions {
  id?: string
  items?: Segment[]
  /** interval between each segment in milliseconds (default: 3 seconds) */
  intervalMs?: number
}

export class SampleSource implements Source {
  readonly id: string
  private items: Segment[]
  private intervalMs: number
  private timer: ReturnType<typeof setInterval> | null = null
  private index = 0

  constructor(options: SampleSourceOptions = {}) {
    this.id = options.id ?? "sample"
    this.items = options.items ?? DEFAULT_ITEMS
    this.intervalMs = options.intervalMs ?? 3000
  }

  subscribe(onSegment: (segment: Segment) => void): void {
    // emit all items immediately on start
    for (const item of this.items) {
      onSegment(item)
    }
    // then keep cycling
    this.timer = setInterval(() => {
      onSegment(this.items[this.index % this.items.length])
      this.index++
    }, this.intervalMs)
  }

  unsubscribe(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
