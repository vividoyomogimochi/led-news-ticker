import { COLOR_KEYS, HEX_RE } from './constants';
import { setSourceType } from './source-type';
import { addSourceBlock } from './multi-source';
import { state } from './state';

export function populateFromQueryParams(): void {
  const p = new URLSearchParams(location.search);
  state.mode = p.get('mode');
  const type = p.get('type');
  if (!type) return;

  setSourceType(type === 'ws' ? 'ws' : type === 'sse' ? 'sse' : 'rss');

  if (type === 'rss') {
    if (p.has('url')) (document.getElementById('cust-rss-url') as HTMLInputElement).value = p.get('url')!;
    if (p.has('interval')) {
      const ms = Number(p.get('interval'));
      if (ms > 0) (document.getElementById('cust-rss-interval') as HTMLInputElement).value = String(Math.round(ms / 60000));
    }
    if (p.get('noproxy') === '1') (document.getElementById('cust-rss-proxy') as HTMLInputElement).checked = false;
  } else if (type === 'ws') {
    if (p.has('url')) (document.getElementById('cust-ws-url') as HTMLInputElement).value = p.get('url')!;
  } else if (type === 'sse') {
    if (p.has('url')) (document.getElementById('cust-sse-url') as HTMLInputElement).value = p.get('url')!;
  }

  // Restore additional sources (type2/url2, type3/url3, ...)
  for (let i = 2; ; i++) {
    const s = String(i);
    const extraUrl = p.get('url' + s);
    if (!extraUrl) break;
    const extraType = p.get('type' + s) ?? 'rss';
    const intervalMs = Number(p.get('interval' + s));
    addSourceBlock({
      type: extraType,
      url: extraUrl,
      interval: intervalMs > 0 ? Math.round(intervalMs / 60000) : undefined,
      noproxy: p.get('noproxy' + s) === '1',
    });
  }

  if (p.has('bg')) (document.getElementById('cust-bg') as HTMLInputElement).value = p.get('bg')!;
  if (p.has('audio')) (document.getElementById('cust-audio') as HTMLInputElement).value = p.get('audio')!;

  for (const key of COLOR_KEYS) {
    const val = p.get(key);
    if (val && HEX_RE.test(val)) {
      (document.getElementById('cust-' + key) as HTMLInputElement).value = val;
      (document.getElementById('cust-' + key + '-hex') as HTMLInputElement).value = val;
    }
  }

  (document.querySelector('.tab-btn[data-tab="customize"]') as HTMLElement).click();
}
