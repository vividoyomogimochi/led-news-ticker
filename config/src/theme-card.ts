import type { ThemeEntry } from './state';
import { ICON_PLAY } from './constants';
import { stopCurrentAudio, playPreview } from './audio-preview';
import { updatePreview } from './preview';

export function makeThemeCard(
  theme: ThemeEntry,
  gridId: string,
  getSelected: () => ThemeEntry | null,
  setSelected: (v: ThemeEntry) => void,
): HTMLElement {
  const audioUrl = theme.params?.audio;

  const card = document.createElement('div');
  card.className = 'theme-card';

  const thumb = document.createElement('div');
  thumb.className = 'theme-card-thumb';
  const img = document.createElement('img');
  img.src = '/themes/' + theme.id + '.png';
  img.alt = '';
  img.loading = 'lazy';
  thumb.appendChild(img);

  let overlayIcon: HTMLElement | null = null;
  if (audioUrl) {
    const overlay = document.createElement('div');
    overlay.className = 'theme-card-overlay';
    overlayIcon = document.createElement('span');
    overlayIcon.innerHTML = ICON_PLAY;
    overlay.appendChild(overlayIcon);
    thumb.appendChild(overlay);
  }

  const body = document.createElement('div');
  body.className = 'theme-card-body';
  const label = document.createElement('span');
  label.className = 'theme-card-label';
  label.textContent = theme.label;
  body.appendChild(label);

  card.appendChild(thumb);
  card.appendChild(body);

  card.addEventListener('click', () => {
    const wasSelected = getSelected() === theme;
    const isPlaying = card.classList.contains('playing');

    if (wasSelected && isPlaying) {
      stopCurrentAudio();
      return;
    }

    document.querySelectorAll('#' + gridId + ' .theme-card').forEach((c) => c.classList.remove('selected'));
    stopCurrentAudio();
    card.classList.add('selected');
    setSelected(theme);
    if (audioUrl) playPreview(audioUrl, card, overlayIcon);
    updatePreview();
  });

  return card;
}
