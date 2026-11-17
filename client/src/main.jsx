import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import { initTheme } from './lib/theme.js';
import { usePWA } from './stores/pwa.js';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/global.css';

initTheme();

// D25: prompt-only service worker updates. Nothing reloads until the learner
// chooses "Refresh" in the update action.
function registerServiceWorker() {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      usePWA.getState().setNeedRefresh(true);
    },
    onOfflineReady() {
      usePWA.getState().setOfflineReady(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Free-tier deploys can sit open for a long time; check hourly for a
      // waiting build without interrupting the current page.
      setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
    onRegisterError(error) {
      console.warn('Service worker registration failed', error);
    },
  });
  usePWA.getState().setApplyUpdate(() => updateSW(true));
}

// D28: the Workbox precache is ~1.4 MB. Registering it during first paint
// competes with the route chunks and fonts and dominates mobile TBT, so wait
// until the page has painted and settled. Offline caching and update checks
// still start automatically a few seconds later.
const SERVICE_WORKER_DELAY_MS = 4000;
function scheduleServiceWorker() {
  window.setTimeout(() => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(registerServiceWorker, { timeout: 2000 });
    } else {
      registerServiceWorker();
    }
  }, SERVICE_WORKER_DELAY_MS);
}
if (document.readyState === 'complete') scheduleServiceWorker();
else window.addEventListener('load', scheduleServiceWorker, { once: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
