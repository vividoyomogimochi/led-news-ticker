export interface ThemeEntry {
  id: string;
  label: string;
  params: Record<string, string>;
}

export const state = {
  activeTab: 'theme',
  selectedSource: null as ThemeEntry | null,
  selectedDisplay: null as ThemeEntry | null,
  mode: null as string | null,
};
