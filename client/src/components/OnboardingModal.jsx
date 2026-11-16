import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { useAuth } from '../stores/auth.js';
import { Button } from './ui/Button.jsx';
import { Modal } from './ui/Modal.jsx';

/**
 * §6.1 onboarding — three steps after registration. The chosen level is
 * preloaded into the SRS by POST /users/me/onboarding (D20), so finishing and
 * skipping both leave the dashboard usable immediately.
 */

const STEPS = [
  { title: 'Which level are you studying for?', hint: 'Step 1 of 3 · Level' },
  { title: 'How many reviews per day?', hint: 'Step 2 of 3 · Pace' },
  { title: 'When should I remind you?', hint: 'Step 3 of 3 · Reminders' },
];

const LEVELS = [
  { value: 5, label: 'N5', description: 'Beginner — 79 kanji' },
  { value: 4, label: 'N4', description: 'Elementary — 166 kanji' },
  { value: 3, label: 'N3', description: 'Intermediate — 367 kanji' },
  { value: null, label: 'Not sure yet', description: 'Start with N5 and change later.' },
];

const PACES = [
  { value: 10, label: '10 reviews', description: 'Relaxed — a small daily habit.' },
  { value: 20, label: '20 reviews', description: 'Steady — the recommended pace.' },
  { value: 40, label: '40 reviews', description: 'Intense — for exam season.' },
];

const REMINDERS = [
  { value: '09:00', label: '9:00 AM', description: 'A morning review with tea.' },
  { value: '20:00', label: '8:00 PM', description: 'Wind down with a few cards.' },
  { value: null, label: 'Not now', description: 'No reminders — you can add one in Settings.' },
];

function Choice({ selected, label, description, onClick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex w-full items-start justify-between gap-3 rounded-control border p-3 text-left transition-colors duration-fast ease-out',
        selected
          ? 'border-vermillion bg-subtle'
          : 'border-line-subtle bg-surface hover:border-line-strong'
      )}
    >
      <span>
        <span className="block text-sm font-medium text-ink-primary">{label}</span>
        <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>
      </span>
      <span
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-vermillion bg-vermillion text-on-accent' : 'border-line-strong'
        )}
        aria-hidden="true"
      >
        {selected ? <Check size={11} strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

export function OnboardingModal({ open }) {
  const queryClient = useQueryClient();
  const mergeUser = useAuth((state) => state.mergeUser);
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState(null);
  const [pace, setPace] = useState(20);
  const [reminder, setReminder] = useState(null);

  const mutation = useMutation({
    mutationFn: (body) => api('/users/me/onboarding', { method: 'POST', body }),
    onSuccess: (data) => {
      mergeUser(data.user);
      // The preload changes due counts, stats, quests, and leaderboard XP.
      queryClient.invalidateQueries();
    },
  });

  function submit(skipped) {
    if (mutation.isPending) return;
    mutation.mutate(
      skipped
        ? { skipped: true }
        : {
            level,
            dailyReviewLimit: pace,
            reminderTime: reminder,
            reminderEnabled: reminder !== null,
          }
    );
  }

  const options =
    step === 0
      ? LEVELS.map((entry) => ({
          key: String(entry.value),
          label: entry.label,
          description: entry.description,
          selected: level === entry.value,
          onClick: () => setLevel(entry.value),
        }))
      : step === 1
        ? PACES.map((entry) => ({
            key: String(entry.value),
            label: entry.label,
            description: entry.description,
            selected: pace === entry.value,
            onClick: () => setPace(entry.value),
          }))
        : REMINDERS.map((entry) => ({
            key: String(entry.value),
            label: entry.label,
            description: entry.description,
            selected: reminder === entry.value,
            onClick: () => setReminder(entry.value),
          }));

  return (
    <Modal
      open={open}
      onOpenChange={() => {
        // Non-dismissible: the garden needs a level and pace before it can
        // show a useful queue. Only finish/skip close this modal.
      }}
      title={STEPS[step].title}
      description={STEPS[step].hint}
      hideClose
    >
      <div className="flex gap-1.5" aria-hidden="true">
        {STEPS.map((entry, index) => (
          <span
            key={entry.hint}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              index <= step ? 'bg-vermillion' : 'bg-line-subtle'
            )}
          />
        ))}
      </div>

      <div role="radiogroup" aria-label={STEPS[step].title} className="mt-4 space-y-2">
        {options.map((option) => (
          <Choice
            key={option.key}
            selected={option.selected}
            label={option.label}
            description={option.description}
            onClick={option.onClick}
          />
        ))}
      </div>

      {mutation.isError ? (
        <p role="alert" className="mt-4 text-sm text-crimson">
          {mutation.error.message}
        </p>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep((value) => value - 1)}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button
          onClick={() => (step === 2 ? submit(false) : setStep((value) => value + 1))}
          disabled={mutation.isPending}
        >
          {step === 2 ? (mutation.isPending ? 'Planting…' : 'Start my garden') : 'Continue'}
        </Button>
      </div>

      <div className="mt-3 text-right">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={mutation.isPending}
          className="text-xs font-medium text-ink-muted underline-offset-4 transition-colors duration-fast ease-out hover:text-ink-secondary hover:underline disabled:opacity-60"
        >
          Skip for now — use defaults
        </button>
      </div>
    </Modal>
  );
}
