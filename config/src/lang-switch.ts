import { applyTranslations, getLang, setLang } from '../../lib/i18n';
import type { Lang } from '../../lib/i18n';
import { syncDataInfo } from './source-type';
import { updatePreview } from './preview';
import { applyLangDefaultSource } from './theme';

function refreshActive(): void {
  const lang = getLang();
  for (const btn of document.querySelectorAll<HTMLButtonElement>('#lang-switch .lang-btn')) {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  }
}

export function initLangSwitch(): void {
  const switcher = document.getElementById('lang-switch');
  if (!switcher) return;

  refreshActive();

  for (const btn of switcher.querySelectorAll<HTMLButtonElement>('.lang-btn')) {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang as Lang | undefined;
      if (!lang || lang === getLang()) return;
      setLang(lang);
      applyTranslations();
      refreshActive();
      // Re-render dynamic content that uses cached strings
      syncDataInfo();
      applyLangDefaultSource();
      updatePreview();
    });
  }
}
