import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../stores/auth.js';
import { loadJapaneseFonts } from '../lib/japaneseFonts.js';
import { ShellSkeleton } from './ShellSkeleton.jsx';

/** Auth gate: loading -> skeleton shell, guest -> /login. */
export function RequireAuth({ children }) {
  const status = useAuth((s) => s.status);

  // D28: the full JP sheets only matter once gated kanji content renders.
  useEffect(() => {
    if (status === 'authed') loadJapaneseFonts();
  }, [status]);

  if (status === 'loading') return <ShellSkeleton />;
  if (status === 'guest') return <Navigate to="/login" replace />;
  return children;
}

/** Login/register redirect away when already signed in. */
export function RedirectIfAuthed({ children }) {
  const status = useAuth((s) => s.status);
  if (status === 'loading') return <ShellSkeleton />;
  if (status === 'authed') return <Navigate to="/" replace />;
  return children;
}
