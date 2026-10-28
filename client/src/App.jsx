import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast.jsx';
import { AppShell } from './components/AppShell.jsx';
import { RequireAuth, RedirectIfAuthed } from './components/guards.jsx';
import { useAuth } from './stores/auth.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';

const KitchenSink = lazy(() => import('./pages/KitchenSink.jsx'));
const Learn = lazy(() => import('./pages/Learn.jsx'));
const KanjiDetail = lazy(() => import('./pages/KanjiDetail.jsx'));
const Licenses = lazy(() => import('./pages/Licenses.jsx'));
const Review = lazy(() => import('./pages/Review.jsx'));

const isDev = import.meta.env.DEV;

export default function App() {
  useEffect(() => {
    useAuth.getState().hydrate();
  }, []);

  return (
    <ToastProvider>
      <BrowserRouter>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Suspense fallback={null}>
          <Routes>
            <Route
              path="/login"
              element={
                <RedirectIfAuthed>
                  <Login />
                </RedirectIfAuthed>
              }
            />
            <Route
              path="/register"
              element={
                <RedirectIfAuthed>
                  <Register />
                </RedirectIfAuthed>
              }
            />
            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/kanji/:character" element={<KanjiDetail />} />
              <Route path="/licenses" element={<Licenses />} />
            </Route>
            {/* /review is full-screen (§7.2): gated, but outside the shell —
                global chrome is replaced by the session's own top bar. */}
            <Route
              path="/review"
              element={
                <RequireAuth>
                  <Review />
                </RequireAuth>
              }
            />
            {isDev ? <Route path="/kitchen-sink" element={<KitchenSink />} /> : null}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}
