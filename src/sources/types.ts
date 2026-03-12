export type SegmentType = 'normal' | 'yellow' | 'sep';

export interface Segment {
  text: string;
  type: SegmentType;
}

export interface Source {
  readonly id: string;
  subscribe(onSegment: (segment: Segment) => void): void;
  unsubscribe(): void;
}
