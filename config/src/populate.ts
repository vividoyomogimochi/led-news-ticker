import { COLOR_KEYS, HEX_RE } from './constants';
import { setSourceType } from './source-type';

export function populateFromQueryParams(): void {
  const p = new URLSearchParams(location.search);
  const type = p.get('type');
  if (!type) return;

  const isWs = type === 'ws';
  setSourceType(isWs ? 'ws' : 'rss');

  if (!isWs) {
    if (p.has('url')) (document.getElementById('cust-rss-url') as HTMLInputElement).value = p.get('url')!;
    if (p.has('interval')) {
      const ms = Number(p.get('interval'));
      if (ms > 0) (document.getElementById('cust-rss-interval') as HTMLInputElement).value = String(Math.round(ms / 60000));
    }
  } else {
    if (p.has('url')) (document.getElementById('cust-ws-url') as HTMLInputElement).value = p.get('url')!;
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
