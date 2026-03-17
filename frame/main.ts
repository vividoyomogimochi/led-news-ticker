// Forward query params to the ticker iframe
const iframe = document.querySelector('iframe');
if (iframe && location.search) {
  iframe.src = '/ticker/' + location.search;
}

// Apply background-image from query param
const _params = new URLSearchParams(location.search);
const _bg = _params.get('bg') || import.meta.env.VITE_DEFAULT_BG;
if (_bg) {
  document.body.style.backgroundImage = `url("${_bg.replace(/"/g, '%22')}")`;
}

// Background audio — no crossorigin attribute, so CORS is not enforced
const _audioUrl = _params.get('audio');
if (_audioUrl) {
  const audio = new Audio(_audioUrl);
  audio.loop = true;
  audio.volume = 0.5;
  audio.play().catch(() => {
    // Autoplay blocked — show overlay to prompt user interaction
    const overlay = document.getElementById('audio-overlay')!;
    const btn = document.getElementById('audio-overlay-btn')!;
    overlay.classList.add('visible');
    const resume = () => {
      audio.play().catch(() => {});
      overlay.classList.remove('visible');
      btn.removeEventListener('click', resume);
      document.removeEventListener('keydown', resume);
    };
    btn.addEventListener('click', resume);
    document.addEventListener('keydown', resume);
  });
}

// Settings button: show on corner hover/tap, hide on click elsewhere
(function () {
  const corner = document.getElementById('settings-corner')!;
  const btn = document.getElementById('settings-btn')!;

  // Default mode: no meaningful params other than 'type' are set
  const _p = new URLSearchParams(location.search);
  const _hasConfig = ['url', 'bg', 'audio', 'interval', 'segmentType', 'normalColor', 'accentColor', 'sepColor', 'offColor'].some(k => _p.has(k));
  if (!_hasConfig) {
    btn.classList.add('visible', 'hint');
    const hintTimer = setTimeout(() => {
      btn.classList.remove('visible', 'hint');
    }, 30000);
    btn.addEventListener('click', () => clearTimeout(hintTimer), { once: true });
  }

  corner.addEventListener('touchstart', (e) => {
    if (!btn.classList.contains('visible')) {
      btn.classList.add('visible');
      btn.classList.remove('hint');
      e.preventDefault(); // suppress the follow-up click so navigation doesn't fire immediately
      e.stopPropagation();
    }
  }, { passive: false });

  corner.addEventListener('click', (e) => { e.stopPropagation(); });

  document.addEventListener('click', () => {
    btn.classList.remove('visible', 'hint');
  });
})();

const frameContainer = document.querySelector('.frame-container') as HTMLElement | null;
window.addEventListener('message', (e) => {
  if (e.data?.type === 'ticker-height') {
    if (iframe) iframe.style.height = e.data.height + 'px';
    if (frameContainer) frameContainer.style.visibility = 'visible';
  }
});
