import { initColorSync } from './color-sync';
import { initSourceTypeSwitch, syncDataInfo } from './source-type';
import { initTabs } from './tabs';
import { updatePreview } from './preview';
import { loadThemes, initThemeButtons } from './theme';
import { populateFromQueryParams } from './populate';
import { initHelp } from './help';

initColorSync(updatePreview);
initSourceTypeSwitch(updatePreview);
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
