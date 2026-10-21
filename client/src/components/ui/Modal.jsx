import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * Modal — Radix Dialog (focus trap + Escape, §12). 12px radius, shadow-md,
 * no glassmorphism (§2.2). `container` lets themed wrappers (kitchen sink)
 * keep the dialog inside their scope.
 */
export function Modal({ open, onOpenChange, title, description, children, footer, container }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(26,23,19,0.4)]" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-[440px] -translate-x-1/2 -translate-y-1/2',
            'rounded-modal border border-line-subtle bg-surface p-6 shadow-md'
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="font-display text-xl font-semibold text-ink-primary">
              {title}
            </Dialog.Title>
            <Dialog.Close
              className="rounded-control p-1 text-ink-muted transition-colors duration-fast ease-out hover:bg-subtle hover:text-ink-primary"
              aria-label="Close"
            >
              <X size={16} aria-hidden="true" />
            </Dialog.Close>
          </div>
          {description ? (
            <Dialog.Description className="mt-2 text-sm text-ink-secondary">
              {description}
            </Dialog.Description>
          ) : null}
          {children ? <div className="mt-4 text-sm text-ink-secondary">{children}</div> : null}
          {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
