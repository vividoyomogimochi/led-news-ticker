import { state } from './state';

export function initTabs(onTabChange: (tab: string) => void): void {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeTab = (btn as HTMLElement).dataset.tab!;
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + state.activeTab));
      onTabChange(state.activeTab);
    });
  });
}
