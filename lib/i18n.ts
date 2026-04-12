export type Lang = 'ja' | 'en';

const dictionaries: Record<Lang, Record<string, string>> = {
  ja: {
    // Config: theme tab
    'theme.empty.loading': '読み込み中...',
    'theme.empty.noSources': 'ソースが登録されていません',
    'theme.empty.noDisplays': 'ディスプレイが登録されていません',
    'theme.empty.loadFailed': '読み込みに失敗しました',
    'theme.btn.open': 'ティッカーを開く →',
    'theme.btn.customize': 'カスタマイズ →',
    'theme.section.source': 'ソース',
    'theme.section.display': 'ディスプレイ',

    // Config: customize tab
    'customize.field.sourceType': 'ソース種別',
    'customize.field.rssUrl': 'フィード URL',
    'customize.field.rssInterval': '取得間隔',
    'customize.field.rssIntervalUnit': '分',
    'customize.field.rssProxy': 'CORSプロキシを使用する',
    'customize.field.rssProxyHint': 'フィードが CORS に対応している場合はオフにできます',
    'customize.field.wsUrl': 'WebSocket URL',
    'customize.field.sseUrl': 'SSE URL',
    'customize.field.bg': '壁紙 URL',
    'customize.field.bgHint': 'ページの背景に適用されます',
    'customize.field.audio': 'BGM URL',
    'customize.field.audioHint': 'ループ再生されます',
    'customize.colors.title': 'LED カラー（任意）',
    'customize.colors.normal': '通常',
    'customize.colors.accent': 'アクセント',
    'customize.colors.sep': '区切り',
    'customize.colors.hint': '空欄でデフォルト色を使用',
    'customize.btn.addSource': '+ ソースを追加',
    'customize.btn.openTicker': 'ティッカーを開く →',

    // Data format info templates
    'dataInfo.ws.title': '受信データ形式（WebSocket）',
    'dataInfo.sse.title': '受信データ形式（SSE）',
    'dataInfo.json': 'JSON（推奨）',
    'dataInfo.plain': 'プレーンテキスト',
    'dataInfo.jsonHint': '<code>type</code> は省略可。<br />値: <code>normal</code> / <code>accent</code>',
    'dataInfo.plainHint': 'JSON でない文字列はそのまま表示。',
    'dataInfo.example.wsJson': '{ "text": "表示テキスト", "type": "normal" }',
    'dataInfo.example.wsPlain': '表示テキスト',
    'dataInfo.example.sseJson': 'data: { "text": "表示テキスト", "type": "normal" }',
    'dataInfo.example.ssePlain': 'data: 表示テキスト',

    // Contact
    'contact.label': 'お問い合わせ:',

    // Frame
    'frame.aria.share': 'シェア',
    'frame.aria.settings': '設定を開く',
    'frame.aria.playAudio': '音楽を再生',
    'frame.audioOverlay': 'クリックして音楽を再生',
  },
  en: {
    // Config: theme tab
    'theme.empty.loading': 'Loading...',
    'theme.empty.noSources': 'No sources registered',
    'theme.empty.noDisplays': 'No displays registered',
    'theme.empty.loadFailed': 'Failed to load',
    'theme.btn.open': 'Open ticker →',
    'theme.btn.customize': 'Customize →',
    'theme.section.source': 'Source',
    'theme.section.display': 'Display',

    // Config: customize tab
    'customize.field.sourceType': 'Source type',
    'customize.field.rssUrl': 'Feed URL',
    'customize.field.rssInterval': 'Fetch interval',
    'customize.field.rssIntervalUnit': 'min',
    'customize.field.rssProxy': 'Use CORS proxy',
    'customize.field.rssProxyHint': 'Disable if the feed supports CORS',
    'customize.field.wsUrl': 'WebSocket URL',
    'customize.field.sseUrl': 'SSE URL',
    'customize.field.bg': 'Wallpaper URL',
    'customize.field.bgHint': 'Applied as the page background',
    'customize.field.audio': 'BGM URL',
    'customize.field.audioHint': 'Plays in a loop',
    'customize.colors.title': 'LED Colors (optional)',
    'customize.colors.normal': 'Normal',
    'customize.colors.accent': 'Accent',
    'customize.colors.sep': 'Separator',
    'customize.colors.hint': 'Leave blank to use default colors',
    'customize.btn.addSource': '+ Add source',
    'customize.btn.openTicker': 'Open ticker →',

    // Data format info templates
    'dataInfo.ws.title': 'Received data format (WebSocket)',
    'dataInfo.sse.title': 'Received data format (SSE)',
    'dataInfo.json': 'JSON (recommended)',
    'dataInfo.plain': 'Plain text',
    'dataInfo.jsonHint': '<code>type</code> is optional. <br />Values: <code>normal</code> / <code>accent</code>',
    'dataInfo.plainHint': 'Non-JSON strings are displayed as-is.',
    'dataInfo.example.wsJson': '{ "text": "Your text", "type": "normal" }',
    'dataInfo.example.wsPlain': 'Your text',
    'dataInfo.example.sseJson': 'data: { "text": "Your text", "type": "normal" }',
    'dataInfo.example.ssePlain': 'data: Your text',

    // Contact
    'contact.label': 'Contact:',

    // Frame
    'frame.aria.share': 'Share',
    'frame.aria.settings': 'Open settings',
    'frame.aria.playAudio': 'Play music',
    'frame.audioOverlay': 'Click to play music',
  },
};

const STORAGE_KEY = 'lang';
let currentLang: Lang = 'ja';

function isLang(value: string | null): value is Lang {
  return value === 'ja' || value === 'en';
}

export function detectLang(): Lang {
  try {
    const fromQuery = new URL(location.href).searchParams.get(STORAGE_KEY);
    if (isLang(fromQuery)) {
      localStorage.setItem(STORAGE_KEY, fromQuery);
      return fromQuery;
    }
    const fromStorage = localStorage.getItem(STORAGE_KEY);
    if (isLang(fromStorage)) return fromStorage;
  } catch {
    // localStorage / URL access may fail in some sandboxes
  }
  const navLang = (navigator.language || '').toLowerCase();
  if (navLang.startsWith('en')) return 'en';
  return 'ja';
}

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang): void {
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }
  document.documentElement.lang = lang;
  applyTranslations();
}

export function t(key: string): string {
  return dictionaries[currentLang][key] ?? dictionaries.ja[key] ?? key;
}

export function applyTranslations(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n!);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-html]')) {
    el.innerHTML = t(el.dataset.i18nHtml!);
  }
  for (const el of root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder!);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nAria!));
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle!);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-show]')) {
    el.hidden = el.dataset.i18nShow !== currentLang;
  }
}

export function initLang(): void {
  currentLang = detectLang();
  document.documentElement.lang = currentLang;
}
