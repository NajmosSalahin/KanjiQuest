/**
 * Full Japanese font sheets (Noto Sans JP + Noto Serif JP) are large and are
 * only needed once kanji content renders. Auth pages use the tiny self-hosted
 * wordmark subset in styles/fonts.css; gated pages request these faces after
 * the session is known so first paint never waits on them.
 */

const HREF =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400..500&family=Noto+Serif+JP:wght@400..500&display=swap';

let requested = false;

function preconnect(origin, crossorigin) {
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = origin;
  if (crossorigin) link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

export function loadJapaneseFonts() {
  if (requested || typeof document === 'undefined') return;
  requested = true;
  preconnect('https://fonts.googleapis.com');
  preconnect('https://fonts.gstatic.com', true);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = HREF;
  document.head.appendChild(link);
}
