import { state } from './state';
import { applyTranslations } from '../../lib/i18n';

let wsInfoEl: HTMLElement | null = null;
let sseInfoEl: HTMLElement | null = null;

export function getSourceType(): string {
  return (document.querySelector('input[name="source-type"]:checked') as HTMLInputElement).value;
}

export function setSourceType(type: string): void {
  (document.querySelector(`input[name="source-type"][value="${type}"]`) as HTMLInputElement).checked = true;
  applySourceTypeVisibility(type);
}

function applySourceTypeVisibility(type: string): void {
  document.getElementById('cust-rss-fields')!.style.display = type === 'rss' ? '' : 'none';
  document.getElementById('cust-ws-fields')!.style.display = type === 'ws' ? '' : 'none';
  document.getElementById('cust-sse-fields')!.style.display = type === 'sse' ? '' : 'none';
}

export function syncDataInfo(): void {
  const isCustomize = state.activeTab === 'customize';
  let hasWs = false;
  let hasSse = false;

  if (isCustomize) {
    const primary = getSourceType();
    hasWs = primary === 'ws';
    hasSse = primary === 'sse';

    // Check extra source blocks too
    const extras = document.getElementById('extra-sources');
    if (extras) {
      for (const radio of extras.querySelectorAll<HTMLInputElement>('input[name^="source-type-"]:checked')) {
        if (radio.value === 'ws') hasWs = true;
        if (radio.value === 'sse') hasSse = true;
      }
    }
  }

  if (wsInfoEl) wsInfoEl.style.display = hasWs ? '' : 'none';
  if (sseInfoEl) sseInfoEl.style.display = hasSse ? '' : 'none';
}

export function initSourceTypeSwitch(onUpdate: () => void): void {
  const previewEl = document.getElementById('preview')!;

  const wsInfoTemplate = document.getElementById('ws-data-info') as HTMLTemplateElement;
  wsInfoEl = wsInfoTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;
  wsInfoEl.style.display = 'none';
  previewEl.insertAdjacentElement('afterend', wsInfoEl);
  applyTranslations(wsInfoEl);

  const sseInfoTemplate = document.getElementById('sse-data-info') as HTMLTemplateElement;
  sseInfoEl = sseInfoTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;
  sseInfoEl.style.display = 'none';
  wsInfoEl.insertAdjacentElement('afterend', sseInfoEl);
  applyTranslations(sseInfoEl);

  document.querySelectorAll('input[name="source-type"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      applySourceTypeVisibility(getSourceType());
      syncDataInfo();
      onUpdate();
    });
  });
}
