import type { Source, Segment } from "./types"

interface WebSocketSourceOptions {
  id: string
  url: string
  /** Extract a Segment from a received message. Return null to skip. */
  parseMessage: (event: MessageEvent) => Segment | null
  /** Auto-reconnect delay in milliseconds (default: 3 seconds) */
  reconnectMs?: number
}

export class WebSocketSource implements Source {
  readonly id: string
  private url: string
  private parseMessage: (event: MessageEvent) => Segment | null
  private reconnectMs: number
  private ws: WebSocket | null = null
  private onSegment: ((segment: Segment) => void) | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private active = false

  constructor(options: WebSocketSourceOptions) {
    this.id = options.id
    this.url = options.url
    this.parseMessage = options.parseMessage
    this.reconnectMs = options.reconnectMs ?? 3000
  }

  subscribe(onSegment: (segment: Segment) => void): void {
    this.onSegment = onSegment
    this.active = true
    this.connect()
  }

  unsubscribe(): void {
    this.active = false
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.onSegment = null
  }

  private connect(): void {
    this.ws = new WebSocket(this.url)

    this.ws.addEventListener("message", (event) => {
      if (!this.onSegment) return
      const segment = this.parseMessage(event)
      if (segment) this.onSegment(segment)
    })

    this.ws.addEventListener("close", () => {
      if (!this.active) return
      console.warn(`[WebSocketSource:${this.id}] closed, reconnecting in ${this.reconnectMs}ms`)
      this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectMs)
    })

    this.ws.addEventListener("error", (err) => {
      console.warn(`[WebSocketSource:${this.id}] error:`, err)
    })
  }
}
