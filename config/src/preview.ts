import { state } from './state';
import { COLOR_KEYS, HEX_RE } from './constants';
import { getSourceType } from './source-type';
import { collectExtraSourceParams } from './multi-source';

function appendColorParams(p: URLSearchParams): void {
  for (const key of COLOR_KEYS) {
    const hex = (document.getElementById('cust-' + key + '-hex') as HTMLInputElement).value.trim();
    if (hex && HEX_RE.test(hex)) p.set(key, hex);
  }
}

export function buildParams(): URLSearchParams {
  const p = new URLSearchParams();
  if (state.activeTab === 'theme') return p;
  const srcType = getSourceType();
  const bg = (document.getElementById('cust-bg') as HTMLInputElement).value.trim();
  const audio = (document.getElementById('cust-audio') as HTMLInputElement).value.trim();
  if (srcType === 'rss') {
    const url = (document.getElementById('cust-rss-url') as HTMLInputElement).value.trim();
    const interval = Number((document.getElementById('cust-rss-interval') as HTMLInputElement).value) || 5;
    const useProxy = (document.getElementById('cust-rss-proxy') as HTMLInputElement).checked;
    p.set('type', 'rss');
    if (url) p.set('url', url);
    if (interval !== 5) p.set('interval', String(interval * 60 * 1000));
    if (!useProxy) p.set('noproxy', '1');
  } else if (srcType === 'ws') {
    const url = (document.getElementById('cust-ws-url') as HTMLInputElement).value.trim();
    p.set('type', 'ws');
    if (url) p.set('url', url);
  } else if (srcType === 'sse') {
    const url = (document.getElementById('cust-sse-url') as HTMLInputElement).value.trim();
    p.set('type', 'sse');
    if (url) p.set('url', url);
  }
  collectExtraSourceParams(p);
  if (bg) p.set('bg', bg);
  if (audio) p.set('audio', audio);
  appendColorParams(p);
  return p;
}

export function buildThemeParams(): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(state.selectedSource?.params || {})) p.set(k, String(v));
  for (const [k, v] of Object.entries(state.selectedDisplay?.params || {})) p.set(k, String(v));
  return p;
}

export function updatePreview(): void {
  const previewEl = document.getElementById('preview')!;
  previewEl.style.display = state.activeTab === 'help' ? 'none' : '';
  if (state.activeTab === 'theme') {
    const qs = buildThemeParams().toString();
    const href = '/' + (qs ? '?' + qs : '');
    previewEl.innerHTML = '<a href="' + href + '">' + href + '</a>';
    return;
  }
  const qs = buildParams().toString();
  const href = '/' + (qs ? '?' + qs : '');
  previewEl.innerHTML = '<a href="' + href + '">' + href + '</a>';
}
