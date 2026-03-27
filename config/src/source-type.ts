import { state } from './state';

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
  const srcType = getSourceType();
  const isCustomize = state.activeTab === 'customize';
  if (wsInfoEl) wsInfoEl.style.display = (isCustomize && srcType === 'ws') ? '' : 'none';
  if (sseInfoEl) sseInfoEl.style.display = (isCustomize && srcType === 'sse') ? '' : 'none';
}

export function initSourceTypeSwitch(onUpdate: () => void): void {
  const previewEl = document.getElementById('preview')!;

  const wsInfoTemplate = document.getElementById('ws-data-info') as HTMLTemplateElement;
  wsInfoEl = wsInfoTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;
  wsInfoEl.style.display = 'none';
  previewEl.insertAdjacentElement('afterend', wsInfoEl);

  const sseInfoTemplate = document.getElementById('sse-data-info') as HTMLTemplateElement;
  sseInfoEl = sseInfoTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;
  sseInfoEl.style.display = 'none';
  wsInfoEl.insertAdjacentElement('afterend', sseInfoEl);

  document.querySelectorAll('input[name="source-type"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      applySourceTypeVisibility(getSourceType());
      syncDataInfo();
      onUpdate();
    });
  });
}
