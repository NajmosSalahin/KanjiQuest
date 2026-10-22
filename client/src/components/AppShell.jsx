import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Home,
  Leaf,
  LogOut,
  Menu,
  RotateCcw,
  Settings,
  User,
  X,
} from 'lucide-react';
import { Avatar } from './ui/Avatar.jsx';
import { Skeleton } from './ui/Skeleton.jsx';
import { useAuth } from '../stores/auth.js';
import { cn } from '../lib/cn.js';

/** Global chrome — prompt.md §7 "Global chrome" + the approved mockups. */

const NAV_LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/learn', label: 'Learn' },
  { to: '/review', label: 'Review' },
  { to: '/quiz', label: 'Quiz' },
  { to: '/stats', label: 'Stats' },
];

const TAB_LINKS = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/learn', label: 'Learn', Icon: BookOpen },
  { to: '/review', label: 'Review', Icon: RotateCcw },
  { to: '/stats', label: 'Stats', Icon: BarChart3 },
  { to: '/profile', label: 'Profile', Icon: User },
];

const navLinkClass = ({ isActive }) =>
  cn(
    'border-b-2 pb-2 text-sm font-medium transition-colors duration-fast ease-out',
    isActive
      ? 'border-vermillion text-ink-primary'
      : 'border-transparent text-ink-secondary hover:text-ink-primary'
  );

const menuItemClass =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-secondary transition-colors duration-fast ease-out hover:bg-subtle hover:text-ink-primary';

function Wordmark() {
  return (
    <span className="flex items-baseline gap-2">
      <span className="font-display text-[20px] font-semibold text-ink-primary">Kanji Garden</span>
      <span className="font-jp-serif text-xs text-ink-muted">植物</span>
    </span>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function onSignOut() {
    setOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="rounded-full"
      >
        <Avatar
          size={32}
          name={user?.displayName}
          src={user?.avatarUrl}
          className="hidden md:flex"
        />
        <Avatar size={28} name={user?.displayName} src={user?.avatarUrl} className="md:hidden" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-44 rounded-card border border-line-subtle bg-surface py-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            onClick={() => {
              setOpen(false);
              navigate('/profile');
            }}
          >
            <User size={16} aria-hidden="true" /> Profile
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            onClick={() => {
              setOpen(false);
              navigate('/settings');
            }}
          >
            <Settings size={16} aria-hidden="true" /> Settings
          </button>
          <div className="my-1 border-t border-line-subtle" />
          <button type="button" role="menuitem" className={menuItemClass} onClick={onSignOut}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const gamification = useAuth((s) => s.gamification);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line-subtle bg-canvas">
        <div className="relative mx-auto flex h-14 max-w-app items-center justify-between gap-6 px-4 md:h-16 md:justify-start md:px-6 lg:px-8">
          <Link to="/" aria-label="Kanji Garden home">
            <Wordmark />
          </Link>

          <nav aria-label="Sections" className="hidden flex-1 justify-center gap-7 md:flex">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/'} className={navLinkClass}>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <span className="hidden h-7 items-center gap-1.5 rounded-full border border-line-subtle bg-surface px-3 font-mono text-sm text-ink-primary md:inline-flex">
              <Leaf size={14} aria-hidden="true" />
              {gamification?.currentStreak ?? 0}
              <span className="sr-only">day streak</span>
            </span>
            <span className="hidden font-mono text-sm text-ink-secondary md:block">
              {(gamification?.totalXP ?? 0).toLocaleString('en-US')}
              <span className="sr-only">XP</span>
            </span>
            <ProfileMenu />
            <button
              type="button"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
              className="rounded-control p-1 text-ink-primary md:hidden"
            >
              {menuOpen ? (
                <X size={24} aria-hidden="true" />
              ) : (
                <Menu size={24} aria-hidden="true" />
              )}
            </button>
          </div>

          {menuOpen ? (
            <div className="absolute right-4 top-full z-50 mt-2 w-52 rounded-card border border-line-subtle bg-surface py-1 shadow-md md:hidden">
              {NAV_LINKS.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(menuItemClass, isActive ? 'text-ink-primary' : '')
                  }
                >
                  {label}
                </NavLink>
              ))}
              <div className="my-1 border-t border-line-subtle" />
              <button
                type="button"
                className={menuItemClass}
                onClick={async () => {
                  setMenuOpen(false);
                  await logout();
                  navigate('/login', { replace: true });
                }}
              >
                <LogOut size={16} aria-hidden="true" /> Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main id="main" className="mx-auto max-w-app px-4 pb-24 pt-6 md:px-6 md:py-8 lg:px-8">
        <Outlet />

        {/* Data attribution (§5.8) */}
        <footer className="mt-10 border-t border-line-subtle pt-4 text-center">
          <Link
            to="/licenses"
            className="text-xs text-ink-muted underline-offset-4 transition-colors duration-fast ease-out hover:text-ink-secondary hover:underline"
          >
            Data sources and licenses.
          </Link>
        </footer>
      </main>

      {/* Mobile bottom tab bar (§7 chrome) */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line-subtle bg-surface md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex">
          {TAB_LINKS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors duration-fast ease-out',
                  isActive ? 'text-vermillion' : 'text-ink-muted'
                )
              }
            >
              <Icon size={24} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Shown while GET /users/me resolves — skeletons, never "Loading..." (§2.12). */
export function ShellSkeleton() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line-subtle bg-canvas">
        <div className="mx-auto flex h-14 max-w-app items-center justify-between px-4 md:h-16 md:px-6 lg:px-8">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-8" style={{ borderRadius: '9999px' }} />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-app px-4 pb-24 pt-6 md:px-6 md:py-8 lg:px-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-6 h-44 w-full" />
      </main>
    </div>
  );
}
