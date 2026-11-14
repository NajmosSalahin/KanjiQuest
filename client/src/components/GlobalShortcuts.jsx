import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './ui/Modal.jsx';
import { Button } from './ui/Button.jsx';

/** §6.16 global shortcuts. Review and quiz keep their own local maps. */

const GROUPS = [
  {
    title: 'Everywhere',
    items: [
      { keys: '?', label: 'Open this shortcut list' },
      { keys: '/', label: 'Focus kanji search' },
      { keys: 'g d', label: 'Dashboard' },
      { keys: 'g l', label: 'Learn' },
      { keys: 'g r', label: 'Review' },
      { keys: 'g s', label: 'Stats' },
      { keys: 'g p', label: 'Profile' },
      { keys: 'Esc', label: 'Close a dialog' },
    ],
  },
  {
    title: 'Review session',
    items: [
      { keys: '1 – 4', label: 'Again / Hard / Good / Easy' },
      { keys: 'Space', label: 'Reveal the answer' },
      { keys: 'u', label: 'Undo the last rating (4s)' },
      { keys: 's', label: 'Skip this card' },
      { keys: 'x', label: 'Suspend for 7 days' },
    ],
  },
  {
    title: 'Quiz session',
    items: [
      { keys: '1 – 4', label: 'Choose an answer' },
      { keys: 'Space', label: 'Continue' },
      { keys: '?', label: 'Toggle quiz help' },
    ],
  },
];

function Key({ children }) {
  return (
    <kbd className="rounded border border-line-subtle bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-ink-primary">
      {children}
    </kbd>
  );
}

export function ShortcutsModal({ open, onOpenChange }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Keyboard shortcuts"
      description="Move around the garden without leaving the keyboard."
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {group.title}
            </h3>
            <dl className="mt-2 space-y-1.5">
              {group.items.map((item) => (
                <div
                  key={`${group.title}-${item.keys}-${item.label}`}
                  className="flex items-center justify-between gap-3"
                >
                  <dt>
                    <Key>{item.keys}</Key>
                  </dt>
                  <dd className="text-right text-xs text-ink-secondary">{item.label}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}

const GOTO = {
  d: '/',
  l: '/learn',
  r: '/review',
  s: '/stats',
  p: '/profile',
};

function isTypingTarget(target) {
  return Boolean(
    target?.closest?.(
      'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="searchbox"]'
    )
  );
}

export function useGlobalShortcuts({ enabled = true, onOpenHelp }) {
  const navigate = useNavigate();
  const chordRef = useRef({ key: null, at: 0 });

  useEffect(() => {
    if (!enabled) return undefined;

    function onKeyDown(event) {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      // Radix dialogs own the keyboard while they are open.
      if (document.querySelector('[role="dialog"]')) return;

      if (event.key === '?') {
        event.preventDefault();
        onOpenHelp();
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        navigate('/learn?focus=search');
        return;
      }

      const key = event.key.toLowerCase();
      if (chordRef.current.key === 'g' && Date.now() - chordRef.current.at < 1200) {
        const destination = GOTO[key];
        chordRef.current = { key: null, at: 0 };
        if (destination) {
          event.preventDefault();
          navigate(destination);
        }
        return;
      }

      if (key === 'g') {
        chordRef.current = { key: 'g', at: Date.now() };
        return;
      }

      chordRef.current = { key: null, at: 0 };
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, navigate, onOpenHelp]);
}
