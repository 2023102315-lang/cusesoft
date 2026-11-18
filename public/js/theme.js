const THEME_KEY = 'cusesoft_theme_v1';

const SUN_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

const MOON_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.4 14.5A8.5 8.5 0 0 1 9.5 3.6a8.5 8.5 0 1 0 10.9 10.9Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function getTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore storage errors
  }
  return 'dark';
}

export function applyTheme(theme, { persist = false } = {}) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', next === 'light' ? '#f7f5fc' : '#07060d');
  }

  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore storage errors
    }
  }

  const btn = document.getElementById('themeBtn');
  if (btn) {
    const isLight = next === 'light';
    const label = isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro';
    btn.innerHTML = isLight ? MOON_ICON : SUN_ICON;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.setAttribute('aria-pressed', String(isLight));
  }

  return next;
}

export function initTheme() {
  applyTheme(getTheme());
  const btn = document.getElementById('themeBtn');
  if (!btn || btn.dataset.themeBound === '1') return;
  btn.dataset.themeBound = '1';
  btn.addEventListener('click', () => {
    const current = getTheme();
    applyTheme(current === 'light' ? 'dark' : 'light', { persist: true });
  });
}
