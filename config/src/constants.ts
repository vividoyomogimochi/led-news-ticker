export const COLOR_DEFAULTS: Record<string, string> = {
  normalColor: '#e0e0e0',
  accentColor: '#ffdd33',
  sepColor: '#cc2200',
};

export const COLOR_KEYS = ['normalColor', 'accentColor', 'sepColor'] as const;

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const ICON_PLAY =
  '<svg width="36" height="36" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><polygon points="4,2 16,9 4,16" fill="#ffaa00"/></svg>';

export const ICON_STOP =
  '<svg width="36" height="36" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="12" height="12" fill="#ffaa00"/></svg>';
