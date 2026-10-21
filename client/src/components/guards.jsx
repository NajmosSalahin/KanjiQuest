import { Navigate } from 'react-router-dom';
import { useAuth } from '../stores/auth.js';
import { ShellSkeleton } from './AppShell.jsx';

/** Auth gate: loading -> skeleton shell, guest -> /login. */
export function RequireAuth({ children }) {
  const status = useAuth((s) => s.status);
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
