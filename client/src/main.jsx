import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import { initTheme } from './lib/theme.js';
import { usePWA } from './stores/pwa.js';
import './styles/tokens.css';
import './styles/global.css';

initTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

// D25: prompt-only service worker updates. Nothing reloads until the learner
// chooses "Refresh" in the update action.
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
