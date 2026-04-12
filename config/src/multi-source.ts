/**
 * Manages additional source blocks (source 2, 3, 4, ...) in the Customize tab.
 * The primary source (no suffix) keeps the existing DOM; this module handles
 * dynamically added/removed numbered sources.
 */
import { applyTranslations } from '../../lib/i18n';

export interface ExtraSourceParams {
  type: string;
  url: string;
  interval?: number;
  noproxy?: boolean;
}

let nextId = 2;
const container = () => document.getElementById('extra-sources')!;

let onChange: () => void = () => {};

/** Remove all extra source blocks. */
export function clearExtraSources(): void {
  container().innerHTML = '';
}

/** Renumber SOURCE labels based on current DOM order. */
function renumberLabels(): void {
  const blocks = container().querySelectorAll<HTMLElement>('.extra-source');
  let n = 2;
  for (const block of blocks) {
    const label = block.querySelector('.extra-source-label');
    if (label) label.textContent = 'SOURCE ' + n;
    n++;
  }
}

export function initMultiSource(onUpdate: () => void): void {
  onChange = onUpdate;
  document.getElementById('add-source-btn')!.addEventListener('click', () => {
    addSourceBlock();
    onChange();
  });
}

export function addSourceBlock(preset?: Partial<ExtraSourceParams>): number {
  const id = nextId++;
  const block = document.createElement('div');
  block.className = 'extra-source';
  block.dataset.sourceId = String(id);

  const type = preset?.type ?? 'rss';

  block.innerHTML = `
    <div class="extra-source-header">
      <span class="extra-source-label">SOURCE ${id}</span>
      <button type="button" class="extra-source-remove" data-remove="${id}">&times;</button>
    </div>
    <div class="field">
      <label data-i18n="customize.field.sourceType"></label>
      <div class="source-type-row">
        <label class="radio-label">
          <input type="radio" name="source-type-${id}" value="rss" ${type === 'rss' ? 'checked' : ''} />
          RSS
        </label>
        <label class="radio-label">
          <input type="radio" name="source-type-${id}" value="ws" ${type === 'ws' ? 'checked' : ''} />
          WebSocket
        </label>
        <label class="radio-label">
          <input type="radio" name="source-type-${id}" value="sse" ${type === 'sse' ? 'checked' : ''} />
          SSE
        </label>
      </div>
    </div>
    <div class="extra-rss-fields-${id}" style="${type === 'rss' ? '' : 'display:none'}">
      <div class="field">
        <label for="extra-rss-url-${id}" data-i18n="customize.field.rssUrl"></label>
        <input id="extra-rss-url-${id}" type="url" placeholder="https://example.com/feed.xml" value="${preset?.type === 'rss' && preset?.url ? preset.url : ''}" />
      </div>
      <div class="field">
        <label for="extra-rss-interval-${id}" data-i18n="customize.field.rssInterval"></label>
        <div class="row">
          <input id="extra-rss-interval-${id}" type="number" min="1" value="${preset?.interval ?? 5}" />
          <span class="unit" data-i18n="customize.field.rssIntervalUnit"></span>
        </div>
      </div>
      <div class="field">
        <label class="checkbox-label">
          <input id="extra-rss-proxy-${id}" type="checkbox" ${preset?.noproxy ? '' : 'checked'} />
          <span data-i18n="customize.field.rssProxy"></span>
        </label>
      </div>
    </div>
    <div class="extra-ws-fields-${id}" style="${type === 'ws' ? '' : 'display:none'}">
      <div class="field">
        <label for="extra-ws-url-${id}" data-i18n="customize.field.wsUrl"></label>
        <input id="extra-ws-url-${id}" type="url" placeholder="ws://localhost:8080" value="${preset?.type === 'ws' && preset?.url ? preset.url : ''}" />
      </div>
    </div>
    <div class="extra-sse-fields-${id}" style="${type === 'sse' ? '' : 'display:none'}">
      <div class="field">
        <label for="extra-sse-url-${id}" data-i18n="customize.field.sseUrl"></label>
        <input id="extra-sse-url-${id}" type="url" placeholder="http://localhost:8080/events" value="${preset?.type === 'sse' && preset?.url ? preset.url : ''}" />
      </div>
    </div>
  `;
  applyTranslations(block);

  // Source type switching
  block.querySelectorAll<HTMLInputElement>(`input[name="source-type-${id}"]`).forEach((radio) => {
    radio.addEventListener('change', () => {
      const t = radio.value;
      (block.querySelector(`.extra-rss-fields-${id}`) as HTMLElement).style.display = t === 'rss' ? '' : 'none';
      (block.querySelector(`.extra-ws-fields-${id}`) as HTMLElement).style.display = t === 'ws' ? '' : 'none';
      (block.querySelector(`.extra-sse-fields-${id}`) as HTMLElement).style.display = t === 'sse' ? '' : 'none';
      onChange();
    });
  });

  // Remove button
  block.querySelector(`[data-remove="${id}"]`)!.addEventListener('click', () => {
    block.remove();
    renumberLabels();
    onChange();
  });

  // Propagate input changes to preview
  block.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', onChange);
    input.addEventListener('change', onChange);
  });

  container().appendChild(block);
  renumberLabels();
  return id;
}

/** Collect params from all extra source blocks. */
export function collectExtraSourceParams(p: URLSearchParams): void {
  const blocks = container().querySelectorAll<HTMLElement>('.extra-source');
  let suffix = 2;
  for (const block of blocks) {
    const type = (block.querySelector<HTMLInputElement>(`input[name^="source-type-"]:checked`))?.value ?? 'rss';
    const url = block.querySelector<HTMLInputElement>(`[id^="extra-${type === 'ws' ? 'ws' : type === 'sse' ? 'sse' : 'rss'}-url-"]`)?.value.trim();
    if (!url) { suffix++; continue; }

    p.set('type' + suffix, type);
    p.set('url' + suffix, url);

    if (type === 'rss') {
      const interval = Number(block.querySelector<HTMLInputElement>(`[id^="extra-rss-interval-"]`)?.value) || 5;
      if (interval !== 5) p.set('interval' + suffix, String(interval * 60 * 1000));
      const useProxy = block.querySelector<HTMLInputElement>(`[id^="extra-rss-proxy-"]`)?.checked;
      if (!useProxy) p.set('noproxy' + suffix, '1');
    }
    suffix++;
  }
}
