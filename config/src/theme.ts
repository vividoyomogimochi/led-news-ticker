import { state } from './state';
import type { ThemeEntry } from './state';
import { COLOR_KEYS, COLOR_DEFAULTS, HEX_RE } from './constants';
import { buildParams, buildThemeParams, updatePreview } from './preview';
import { setSourceType } from './source-type';
import { clearExtraSources } from './multi-source';
import { stopCurrentAudio } from './audio-preview';
import { makeThemeCard } from './theme-card';
import { getLang, t } from '../../lib/i18n';
import type { Lang } from '../../lib/i18n';

let themesLoaded = false;
let loadedSources: ThemeEntry[] = [];
let defaultSourceIds: Partial<Record<Lang, string>> = {};

function pickDefaultSource(lang: Lang): ThemeEntry | null {
  const id = defaultSourceIds[lang];
  return (id && loadedSources.find((s) => s.id === id)) || loadedSources[0] || null;
}

export function applyLangDefaultSource(): void {
  if (!loadedSources.length) return;
  const sourceSelect = document.getElementById('theme-source-select') as HTMLSelectElement | null;
  if (!sourceSelect) return;
  const next = pickDefaultSource(getLang());
  if (!next) return;
  sourceSelect.value = next.id;
  state.selectedSource = next;
  updatePreview();
}

export async function loadThemes(): Promise<void> {
  if (themesLoaded) return;
  themesLoaded = true;

  const sourceSelect = document.getElementById('theme-source-select') as HTMLSelectElement;
  const displayGrid = document.getElementById('theme-display-grid')!;
  try {
    const res = await fetch('/themes.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    const sources: ThemeEntry[] = data.sources || [];
    const displays: ThemeEntry[] = data.displays || [];
    loadedSources = sources;
    defaultSourceIds = (data.defaultSources as Partial<Record<Lang, string>>) || {};

    sourceSelect.innerHTML = '';
    displayGrid.innerHTML = '';

    if (sources.length) {
      for (const theme of sources) {
        const opt = document.createElement('option');
        opt.value = theme.id;
        opt.textContent = theme.label;
        sourceSelect.appendChild(opt);
      }
      const initial = pickDefaultSource(getLang());
      state.selectedSource = initial;
      if (initial) sourceSelect.value = initial.id;
      sourceSelect.addEventListener('change', () => {
        state.selectedSource = sources.find((s) => s.id === sourceSelect.value) || null;
        updatePreview();
      });
    } else {
      const opt = document.createElement('option');
      opt.dataset.i18n = 'theme.empty.noSources';
      opt.textContent = t('theme.empty.noSources');
      opt.disabled = true;
      sourceSelect.appendChild(opt);
    }

    if (displays.length) {
      for (const theme of displays) {
        displayGrid.appendChild(makeThemeCard(theme, 'theme-display-grid', () => state.selectedDisplay, (v) => { state.selectedDisplay = v; }));
      }
      state.selectedDisplay = displays[0];
      displayGrid.firstElementChild!.classList.add('selected');
    } else {
      const empty = document.createElement('p');
      empty.className = 'theme-empty';
      empty.dataset.i18n = 'theme.empty.noDisplays';
      empty.textContent = t('theme.empty.noDisplays');
      displayGrid.replaceChildren(empty);
    }
    updatePreview();
  } catch {
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.dataset.i18n = 'theme.empty.loadFailed';
    opt.textContent = t('theme.empty.loadFailed');
    sourceSelect.replaceChildren(opt);
    displayGrid.innerHTML = '';
  }
}

export { stopCurrentAudio };

function targetPath(): string {
  return state.mode === 'ticker' ? '/ticker/' : '/';
}

export function initThemeButtons(): void {
  document.getElementById('theme-open-btn')!.addEventListener('click', () => {
    const qs = buildThemeParams().toString();
    location.href = targetPath() + (qs ? '?' + qs : '');
  });

  document.getElementById('theme-customize-btn')!.addEventListener('click', () => {
    clearExtraSources();

    const srcType = state.selectedSource?.params?.type;
    const isWs = srcType === 'ws';

    setSourceType(isWs ? 'ws' : 'rss');

    if (state.selectedSource) {
      const sp = state.selectedSource.params;
      if (!isWs) {
        (document.getElementById('cust-rss-url') as HTMLInputElement).value = sp.url || '';
        if (sp.interval) (document.getElementById('cust-rss-interval') as HTMLInputElement).value = String(Math.round(Number(sp.interval) / 60000));
        (document.getElementById('cust-rss-proxy') as HTMLInputElement).checked = sp.noproxy !== '1';
      } else {
        (document.getElementById('cust-ws-url') as HTMLInputElement).value = sp.url || '';
      }
    }

    if (state.selectedDisplay) {
      const dp = state.selectedDisplay.params;
      (document.getElementById('cust-bg') as HTMLInputElement).value = dp.bg || '';
      (document.getElementById('cust-audio') as HTMLInputElement).value = dp.audio || '';
    }

    const allParams = { ...state.selectedSource?.params, ...state.selectedDisplay?.params };
    for (const key of COLOR_KEYS) {
      const val = allParams[key] || '';
      const picker = document.getElementById('cust-' + key) as HTMLInputElement;
      const hex = document.getElementById('cust-' + key + '-hex') as HTMLInputElement;
      if (val && HEX_RE.test(val)) {
        picker.value = val;
        hex.value = val;
      } else {
        picker.value = COLOR_DEFAULTS[key];
        hex.value = '';
      }
    }

    (document.querySelector('.tab-btn[data-tab="customize"]') as HTMLElement).click();
  });

  document.getElementById('panel-customize')!.addEventListener('input', updatePreview);

  document.getElementById('panel-customize')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const qs = buildParams().toString();
    location.href = targetPath() + (qs ? '?' + qs : '');
  });
}
