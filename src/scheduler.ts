import type { Source, Segment } from './sources';

interface TimedSegment {
  segment: Segment;
  expiresAt: number;
}

interface SchedulerOptions {
  ttlMs?: number;
  fallbackText?: string;
}

const MAX_QUEUE = 64;

export class Scheduler {
  private sources: Source[] = [];
  private queue: TimedSegment[] = [];
  private ttlMs: number;
  readonly fallbackSegment: Segment;
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
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.unregisterAll();
  }

  /** Pop the next non-expired segment, or return fallback if queue is empty. */
  dequeue(): Segment {
    while (this.queue.length > 0) {
      const entry = this.queue.shift()!;
      if (Date.now() < entry.expiresAt) {
        return entry.segment;
      }
    }
    return this.fallbackSegment;
  }

  private cleanup(): void {
    this.queue = this.queue.filter((e) => Date.now() < e.expiresAt);
  }

  private enqueue(segment: Segment): void {
    if (this.queue.length >= MAX_QUEUE) {
      this.queue.shift();
    }
    this.queue.push({ segment, expiresAt: Date.now() + this.ttlMs });
  }
}
