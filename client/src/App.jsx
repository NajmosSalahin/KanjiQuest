import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast.jsx';

const KitchenSink = lazy(() => import('./pages/KitchenSink.jsx'));

const isDev = import.meta.env.DEV;

function Blank() {
  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Suspense fallback={null}>
          <Routes>
            {isDev ? <Route path="/kitchen-sink" element={<KitchenSink />} /> : null}
            <Route path="*" element={isDev ? <Navigate to="/kitchen-sink" replace /> : <Blank />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}
