import type { Source, Segment } from './sources';

const SEP_SEGMENT: Segment = { text: '  ●  ', type: 'sep' };

interface TimedSegment {
  segment: Segment;
  expiresAt: number;
}

interface SchedulerOptions {
  ttlMs?: number;
  fallbackText?: string;
}

export class Scheduler {
  private sources: Source[] = [];
  private queue: TimedSegment[] = [];
  private onUpdate: ((segments: Segment[]) => void) | null = null;
  private ttlMs: number;
  private fallbackSegment: Segment;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(options?: SchedulerOptions) {
    this.ttlMs = options?.ttlMs ?? 5 * 60 * 1000;
    this.fallbackSegment = {
      text: options?.fallbackText ?? 'NO SIGNAL',
      type: 'normal',
    };
    this.cleanupTimer = setInterval(() => this.cleanup(), 1000);
  }

  register(source: Source): void {
    this.sources.push(source);
    source.subscribe((segment) => {
      this.enqueue(segment);
    });
  }

  unregisterAll(): void {
    for (const source of this.sources) {
      source.unsubscribe();
    }
    this.sources = [];
    this.queue = [];
    this.onUpdate?.(this.getSegments());
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.unregisterAll();
  }

  setOnUpdate(cb: (segments: Segment[]) => void): void {
    this.onUpdate = cb;
  }

  private cleanup(): void {
    const before = this.queue.length;
    this.queue = this.queue.filter((e) => Date.now() < e.expiresAt);
    if (this.queue.length !== before) {
      this.onUpdate?.(this.getSegments());
    }
  }

  private enqueue(segment: Segment): void {
    this.queue.push({ segment, expiresAt: Date.now() + this.ttlMs });
    this.onUpdate?.(this.getSegments());
  }

  getSegments(): Segment[] {
    const active = this.queue.map((e) => e.segment);
    if (active.length === 0) return [this.fallbackSegment];
    const result: Segment[] = [];
    for (let i = 0; i < active.length; i++) {
      if (i > 0) result.push(SEP_SEGMENT);
      result.push(active[i]);
    }
    return result;
  }
}
