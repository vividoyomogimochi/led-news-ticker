import type { Source, Segment } from './sources';

interface TimedSegment {
  segment: Segment;
  expiresAt: number;
}

interface SchedulerOptions {
  ttlMs?: number;
}

const MAX_QUEUE_PER_SOURCE = 64;

export class Scheduler {
  private sources: Source[] = [];
  /** Per-source sub-queues, keyed by source index. */
  private queues: TimedSegment[][] = [];
  /** Round-robin cursor – index into this.queues. */
  private robin = 0;
  private ttlMs: number;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(options?: SchedulerOptions) {
    this.ttlMs = options?.ttlMs ?? 5 * 60 * 1000;
    this.cleanupTimer = setInterval(() => this.cleanup(), 1000);
  }

  register(source: Source): void {
    const idx = this.sources.length;
    this.sources.push(source);
    this.queues.push([]);
    source.subscribe((segment) => {
      this.enqueue(idx, segment);
    });
  }

  unregisterAll(): void {
    for (const source of this.sources) {
      source.unsubscribe();
    }
    this.sources = [];
    this.queues = [];
    this.robin = 0;
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.unregisterAll();
  }

  /** Pop the next non-expired segment using round-robin across sources. */
  dequeue(): Segment | null {
    const n = this.queues.length;
    if (n === 0) return null;

    // Try each source starting from the current robin position.
    for (let attempt = 0; attempt < n; attempt++) {
      const idx = (this.robin + attempt) % n;
      const q = this.queues[idx];
      while (q.length > 0) {
        const entry = q.shift()!;
        if (Date.now() < entry.expiresAt) {
          this.robin = (idx + 1) % n;
          return entry.segment;
        }
      }
    }
    return null;
  }

  private cleanup(): void {
    const now = Date.now();
    for (let i = 0; i < this.queues.length; i++) {
      this.queues[i] = this.queues[i].filter((e) => now < e.expiresAt);
    }
  }

  private enqueue(idx: number, segment: Segment): void {
    const q = this.queues[idx];
    if (q.length >= MAX_QUEUE_PER_SOURCE) {
      q.shift();
    }
    q.push({ segment, expiresAt: Date.now() + this.ttlMs });
  }
}
