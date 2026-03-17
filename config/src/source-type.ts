import { state } from './state';

let wsInfoEl: HTMLElement | null = null;

export function getSourceType(): string {
  return (document.querySelector('input[name="source-type"]:checked') as HTMLInputElement).value;
}

export function setSourceType(type: string): void {
  (document.querySelector(`input[name="source-type"][value="${type}"]`) as HTMLInputElement).checked = true;
  const isWs = type === 'ws';
  document.getElementById('cust-rss-fields')!.style.display = isWs ? 'none' : '';
  document.getElementById('cust-ws-fields')!.style.display = isWs ? '' : 'none';
}

export function syncDataInfo(): void {
  if (wsInfoEl) {
    wsInfoEl.style.display = (state.activeTab === 'customize' && getSourceType() === 'ws') ? '' : 'none';
  }
}

export function initSourceTypeSwitch(onUpdate: () => void): void {
  const wsInfoTemplate = document.getElementById('ws-data-info') as HTMLTemplateElement;
  const previewEl = document.getElementById('preview')!;
  wsInfoEl = wsInfoTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;
  wsInfoEl.style.display = 'none';
  previewEl.insertAdjacentElement('afterend', wsInfoEl);

  document.querySelectorAll('input[name="source-type"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const isWs = getSourceType() === 'ws';
      document.getElementById('cust-rss-fields')!.style.display = isWs ? 'none' : '';
      document.getElementById('cust-ws-fields')!.style.display = isWs ? '' : 'none';
      syncDataInfo();
      onUpdate();
    });
  });
}
