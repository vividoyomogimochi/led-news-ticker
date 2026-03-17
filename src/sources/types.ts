export type SegmentType = 'normal' | 'accent' | 'sep';

export interface Segment {
  text: string;
  type: SegmentType;
}

export interface Source {
  readonly id: string;
  subscribe(onSegment: (segment: Segment) => void): void;
  unsubscribe(): void;
}
