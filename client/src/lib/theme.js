/**
 * Theme preference (§6.13): auto/light/dark. The last applied preference is
 * cached in localStorage so a reload paints the right theme before /users/me
 * resolves; the server remains the source of truth once the session hydrates.
 */

const STORAGE_KEY = 'kg_theme';

export function resolveTheme(preference = 'auto') {
  if (preference === 'light' || preference === 'dark') return preference;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(preference = 'auto') {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolveTheme(preference);
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // storage can be unavailable in private mode; the DOM theme still applies
  }
}

export function initTheme() {
  let preference = 'auto';
  try {
    preference = window.localStorage.getItem(STORAGE_KEY) ?? 'auto';
  } catch {
    // ignore
  }
  applyTheme(preference);
}

/** Subscribe to OS theme changes while the preference is "auto". */
export function watchSystemTheme(onChange) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => onChange();
  if (media.addEventListener) media.addEventListener('change', listener);
  else media.addListener(listener);
  return () => {
    if (media.removeEventListener) media.removeEventListener('change', listener);
    else media.removeListener(listener);
  };
}
