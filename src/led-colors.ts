export interface LedColorEntry { dot: string; glow: string }

export interface LedColorScheme {
  normal: LedColorEntry;
  accent: LedColorEntry;
  sep: LedColorEntry;
  off: string;
}

export const DEFAULT_COLORS: LedColorScheme = {
  normal: { dot: '#e0e0e0', glow: 'rgba(200,200,200,0.35)' },
  accent: { dot: '#ffdd33', glow: 'rgba(255,200,0,0.35)' },
  sep: { dot: '#cc2200', glow: 'rgba(180,20,0,0.35)' },
  off: '#1e1e1e',
};

/** Parse a hex color (#rrggbb) into an rgba glow string */
function hexToGlow(hex: string, alpha = 0.35): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function colorEntryFromHex(hex: string): LedColorEntry {
  return { dot: hex, glow: hexToGlow(hex) };
}
