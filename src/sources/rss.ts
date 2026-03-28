import type { Source, Segment } from './types';

interface RssSourceOptions {
  id: string;
  url: string;
  /** fetch interval in milliseconds (default: 5 minutes) */
  intervalMs?: number;
  /** CORS proxy prefix, e.g. "https://allorigins.win/raw?url=" */
  corsProxy?: string;
  segmentType?: Segment['type'];
}

export class RssSource implements Source {
  readonly id: string;
  private url: string;
  private intervalMs: number;
  private corsProxy: string;
  private segmentType: Segment['type'];
  private timer: ReturnType<typeof setInterval> | null = null;
  private onSegment: ((segment: Segment) => void) | null = null;

  constructor(options: RssSourceOptions) {
    this.id = options.id;
    this.url = options.url;
    this.intervalMs = options.intervalMs ?? 5 * 60 * 1000;
    this.corsProxy = options.corsProxy ?? '';
    this.segmentType = options.segmentType ?? 'normal';
  }

  subscribe(onSegment: (segment: Segment) => void): void {
    this.onSegment = onSegment;
    this.fetch();
    this.timer = setInterval(() => this.fetch(), this.intervalMs);
  }

  unsubscribe(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.onSegment = null;
  }

  private async fetch(): Promise<void> {
    if (!this.onSegment) return;
    try {
      const fetchUrl = this.corsProxy
        ? this.corsProxy + encodeURIComponent(this.url)
        : this.url;
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const items = parseRssItems(text);
      for (const item of items) {
        this.onSegment({ text: item, type: this.segmentType });
      }
    } catch (err) {
      console.warn(`[RssSource:${this.id}] fetch failed:`, err);
    }
  }
}

function parseRssItems(xml: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const items = doc.querySelectorAll('item')
  const entries = doc.querySelectorAll('entry');
  const results: string[] = [];
  [...items, ...entries].forEach((item) => {
    const title = item.querySelector('title')?.textContent?.trim();
    if (title) results.push(title);
  });
  return results;
}
