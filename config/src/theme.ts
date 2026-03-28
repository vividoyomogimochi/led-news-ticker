import { state } from './state';
import type { ThemeEntry } from './state';
import { COLOR_KEYS, COLOR_DEFAULTS, HEX_RE } from './constants';
import { buildParams, buildThemeParams, updatePreview } from './preview';
import { setSourceType } from './source-type';
import { stopCurrentAudio } from './audio-preview';
import { makeThemeCard } from './theme-card';

let themesLoaded = false;

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

    sourceSelect.innerHTML = '';
    displayGrid.innerHTML = '';

    if (sources.length) {
      for (const theme of sources) {
        const opt = document.createElement('option');
        opt.value = theme.id;
        opt.textContent = theme.label;
        sourceSelect.appendChild(opt);
      }
      state.selectedSource = sources[0];
      sourceSelect.addEventListener('change', () => {
        state.selectedSource = sources.find((s) => s.id === sourceSelect.value) || null;
        updatePreview();
      });
    } else {
      const opt = document.createElement('option');
      opt.textContent = 'ソースが登録されていません';
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
      displayGrid.innerHTML = '<p class="theme-empty">ディスプレイが登録されていません</p>';
    }
    updatePreview();
  } catch {
    sourceSelect.innerHTML = '<option disabled>読み込みに失敗しました</option>';
    displayGrid.innerHTML = '';
  }
}

export { stopCurrentAudio };

export function initThemeButtons(): void {
  document.getElementById('theme-open-btn')!.addEventListener('click', () => {
    const qs = buildThemeParams().toString();
    location.href = '/' + (qs ? '?' + qs : '');
  });

  document.getElementById('theme-customize-btn')!.addEventListener('click', () => {
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
    location.href = '/' + (qs ? '?' + qs : '');
  });
}
