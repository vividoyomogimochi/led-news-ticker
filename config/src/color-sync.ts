import { COLOR_KEYS, COLOR_DEFAULTS, HEX_RE } from './constants';

export function initColorSync(onUpdate: () => void): void {
  for (const key of COLOR_KEYS) {
    const picker = document.getElementById('cust-' + key) as HTMLInputElement;
    const hex = document.getElementById('cust-' + key + '-hex') as HTMLInputElement;
    picker.addEventListener('input', () => {
      hex.value = picker.value === COLOR_DEFAULTS[key] ? '' : picker.value;
      onUpdate();
    });
    hex.addEventListener('input', () => {
      if (HEX_RE.test(hex.value)) picker.value = hex.value;
      onUpdate();
    });
  }
}
