import { ICON_PLAY, ICON_STOP } from './constants';

let currentAudio: HTMLAudioElement | null = null;
let currentAudioTimer: ReturnType<typeof setTimeout> | null = null;
let currentAudioFade: ReturnType<typeof setInterval> | null = null;
let currentOverlayIcon: HTMLElement | null = null;

export function stopCurrentAudio(): void {
  if (currentAudioTimer) { clearTimeout(currentAudioTimer); currentAudioTimer = null; }
  if (currentAudioFade) { clearInterval(currentAudioFade); currentAudioFade = null; }
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if (currentOverlayIcon) { currentOverlayIcon.innerHTML = ICON_PLAY; currentOverlayIcon = null; }
  document.querySelectorAll('.theme-card.playing').forEach((c) => c.classList.remove('playing'));
}

export function playPreview(audioUrl: string, card: HTMLElement, iconEl: HTMLElement | null): void {
  stopCurrentAudio();
  const audio = new Audio(audioUrl);
  audio.volume = 0.5;
  audio.play().catch(() => {});
  currentAudio = audio;
  currentOverlayIcon = iconEl;
  if (iconEl) iconEl.innerHTML = ICON_STOP;
  card.classList.add('playing');

  currentAudioTimer = setTimeout(() => {
    currentAudioTimer = null;
    let vol = audio.volume;
    const step = vol / 20;
    currentAudioFade = setInterval(() => {
      vol = Math.max(0, vol - step);
      if (currentAudio) currentAudio.volume = vol;
      if (vol <= 0) {
        clearInterval(currentAudioFade!);
        currentAudioFade = null;
        if (currentAudio) { currentAudio.pause(); currentAudio = null; }
        if (currentOverlayIcon) { currentOverlayIcon.innerHTML = ICON_PLAY; currentOverlayIcon = null; }
        card.classList.remove('playing');
      }
    }, 50);
  }, 3000);
}
