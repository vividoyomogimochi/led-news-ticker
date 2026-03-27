import type { Source, Segment } from './types';

interface SseSourceOptions {
  id: string;
  url: string;
  /** Extract a Segment from a received MessageEvent. Return null to skip. */
  parseMessage: (event: MessageEvent) => Segment | null;
  /** Auto-reconnect delay in milliseconds (default: 3 seconds) */
  reconnectMs?: number;
}

export class SseSource implements Source {
  readonly id: string;
  private url: string;
  private parseMessage: (event: MessageEvent) => Segment | null;
  private reconnectMs: number;
  private es: EventSource | null = null;
  private onSegment: ((segment: Segment) => void) | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;

  constructor(options: SseSourceOptions) {
    this.id = options.id;
    this.url = options.url;
    this.parseMessage = options.parseMessage;
    this.reconnectMs = options.reconnectMs ?? 3000;
  }

  subscribe(onSegment: (segment: Segment) => void): void {
    this.onSegment = onSegment;
    this.active = true;
    this.connect();
  }

  unsubscribe(): void {
    this.active = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.es?.close();
    this.es = null;
    this.onSegment = null;
  }

  private connect(): void {
    this.es = new EventSource(this.url);

    this.es.addEventListener('message', (event) => {
      if (!this.onSegment) return;
      const segment = this.parseMessage(event as MessageEvent);
      if (segment) this.onSegment(segment);
    });

    this.es.addEventListener('error', () => {
      console.warn(`[SseSource:${this.id}] error, reconnecting in ${this.reconnectMs}ms`);
      this.es?.close();
      this.es = null;
      if (!this.active) return;
      this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectMs);
    });
  }
}
