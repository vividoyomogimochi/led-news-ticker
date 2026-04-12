import { initColorSync } from './color-sync';
import { initSourceTypeSwitch, syncDataInfo } from './source-type';
import { initMultiSource } from './multi-source';
import { initTabs } from './tabs';
import { updatePreview } from './preview';
import { loadThemes, initThemeButtons } from './theme';
import { populateFromQueryParams } from './populate';
import { initHelp } from './help';
import { initLangSwitch } from './lang-switch';
import { initLang, applyTranslations } from '../../lib/i18n';

initLang();
applyTranslations();
initLangSwitch();
initColorSync(updatePreview);
initSourceTypeSwitch(updatePreview);
initMultiSource(() => { updatePreview(); syncDataInfo(); });
initTabs((tab) => {
  updatePreview();
  syncDataInfo();
  if (tab === 'theme') loadThemes();
});
initThemeButtons();
populateFromQueryParams();
initHelp();
updatePreview();
loadThemes();
