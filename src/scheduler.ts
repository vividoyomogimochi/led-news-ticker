import type { Source, Segment } from "./sources"

const SEP_SEGMENT: Segment = { text: "  ●  ", type: "sep" }

export class Scheduler {
  private sources: Source[] = []
  private queue: Segment[] = []
  private onUpdate: ((segments: Segment[]) => void) | null = null

  register(source: Source): void {
    this.sources.push(source)
    source.subscribe((segment) => {
      this.enqueue(segment)
    })
  }

  unregisterAll(): void {
    for (const source of this.sources) {
      source.unsubscribe()
    }
    this.sources = []
    this.queue = []
  }

  setOnUpdate(cb: (segments: Segment[]) => void): void {
    this.onUpdate = cb
  }

  private enqueue(segment: Segment): void {
    // Insert with separator
    if (this.queue.length > 0) {
      this.queue.push(SEP_SEGMENT)
    }
    this.queue.push(segment)
    this.onUpdate?.(this.getSegments())
  }

  getSegments(): Segment[] {
    return [...this.queue]
  }
}
