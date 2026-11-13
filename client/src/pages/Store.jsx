import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Coins, Snowflake, Sparkles, Zap } from 'lucide-react';
import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { useAuth } from '../stores/auth.js';
import { useToast } from '../components/ui/Toast.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';

/** Store — prompt.md §6.11 / §7.10. Catalogue state is server-authoritative. */

const FRAME_COLORS = {
  'frame-sakura': 'var(--accent-vermillion)',
  'frame-take': 'var(--success-matcha)',
  'frame-tsuki': 'var(--accent-indigo)',
};

function StoreIcon({ icon, className }) {
  const frameColor = FRAME_COLORS[icon];
  if (icon === 'freeze') {
    return (
      <span
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-control bg-subtle',
          className
        )}
      >
        <Snowflake size={40} strokeWidth={1.25} className="text-indigo" aria-hidden="true" />
      </span>
    );
  }
  if (icon === 'boost') {
    return (
      <span
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-control bg-subtle',
          className
        )}
      >
        <Zap size={40} strokeWidth={1.25} className="text-vermillion" aria-hidden="true" />
      </span>
    );
  }
  if (icon === 'title') {
    return (
      <span
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-control bg-subtle',
          className
        )}
      >
        <svg viewBox="0 0 64 64" className="h-10 w-10" fill="none" aria-hidden="true">
          <path d="M18 8h28v36l-14 12-14-12V8z" stroke="var(--ink-primary)" strokeWidth="2" />
          <path
            d="M25 18h14M25 25h14M25 32h9"
            stroke="var(--ink-muted)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="32" cy="49" r="2.5" fill="var(--accent-vermillion)" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={cn(
        'flex h-16 w-16 items-center justify-center rounded-control bg-subtle',
        className
      )}
    >
      <svg viewBox="0 0 64 64" className="h-11 w-11" fill="none" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r="23"
          stroke={frameColor ?? 'var(--ink-primary)'}
          strokeWidth="2.5"
        />
        {icon === 'frame-sakura' ? (
          <g fill={frameColor}>
            <circle cx="47" cy="15" r="2.4" />
            <circle cx="54" cy="21" r="2" />
            <circle cx="42" cy="21" r="1.8" />
          </g>
        ) : null}
        {icon === 'frame-take' ? (
          <path
            d="M32 4v8M32 52v8M4 32h8M52 32h8"
            stroke={frameColor}
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : null}
        {icon === 'frame-tsuki' ? (
          <path d="M44 12a11 11 0 100 16 10 10 0 019-16h-9z" fill={frameColor} />
        ) : null}
      </svg>
    </span>
  );
}

function priceLabel(item) {
  return `${item.price.toLocaleString('en-US')} coins`;
}

export default function Store() {
  const queryClient = useQueryClient();
  const { push: toast } = useToast();
  const mergeGamification = useAuth((state) => state.mergeGamification);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');

  const storeQuery = useQuery({
    queryKey: ['store', 'items'],
    queryFn: () => api('/store/items'),
  });

  const purchase = useMutation({
    mutationFn: (itemId) =>
      api('/gamification/store/purchase', { method: 'POST', body: { itemId } }),
    onSuccess: (data) => {
      mergeGamification({
        coins: data.coins,
        streakFreezes: data.streakFreezes,
        xpBoostExpiresAt: data.xpBoostExpiresAt,
      });
      queryClient.invalidateQueries({ queryKey: ['store'] });
      queryClient.invalidateQueries({ queryKey: ['gamification', 'profile'] });
      toast({ message: `Purchased ${data.item.name}.`, tone: 'success' });
      setPending(null);
      setError('');
    },
    onError: (err) => setError(err.message),
  });

  const equip = useMutation({
    mutationFn: ({ slot, itemId }) =>
      api('/gamification/store/equip', { method: 'POST', body: { slot, itemId } }),
    onSuccess: (data) => {
      mergeGamification({
        equippedTitle: data.equippedTitle,
        equippedFrame: data.equippedFrame,
      });
      queryClient.invalidateQueries({ queryKey: ['store'] });
      toast({ message: 'Cosmetic updated.', tone: 'success' });
    },
    onError: (err) => toast({ message: err.message, tone: 'info' }),
  });

  if (storeQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (storeQuery.isError) {
    return (
      <EmptyState
        headline="The store is closed"
        description="We couldn't load the catalogue. Try again in a moment."
        action={{ label: 'Retry', onClick: () => storeQuery.refetch() }}
      />
    );
  }

  const data = storeQuery.data;
  const coins = data?.coins ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-primary">Store</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Cosmetics and small helpers, earned only through play.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-line-subtle bg-surface px-4 py-2 font-mono text-sm text-ink-primary">
          <Coins size={16} aria-hidden="true" className="text-persimmon" />
          {coins.toLocaleString('en-US')}
          <span className="sr-only">coins</span>
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(data?.items ?? []).map((item) => {
          const cosmetic = item.type === 'title' || item.type === 'frame';
          const badge = item.equipped
            ? 'Equipped'
            : item.owned && cosmetic
              ? 'Owned'
              : item.active
                ? 'Active'
                : item.atMax
                  ? 'Full'
                  : null;
          return (
            <article
              key={item.id}
              className="flex flex-col rounded-card border border-line-subtle bg-surface p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <StoreIcon icon={item.icon} />
                {badge ? (
                  <span className="rounded-full border border-line-subtle bg-subtle px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                    {badge}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-4 font-display text-lg font-medium text-ink-primary">
                {item.name}
                {item.nameJa ? (
                  <span className="ml-2 font-jp text-sm text-ink-muted">{item.nameJa}</span>
                ) : null}
              </h2>
              <p className="mt-1 flex-1 text-sm text-ink-secondary">{item.description}</p>
              {item.type === 'freeze' ? (
                <p className="mt-3 text-xs text-ink-muted">
                  {data.streakFreezes ?? item.quantity} of {item.maxActive} held
                </p>
              ) : null}
              {item.type === 'boost' && item.active ? (
                <p className="mt-3 text-xs text-matcha">
                  Active until {new Date(data.xpBoostExpiresAt).toLocaleString()}
                </p>
              ) : null}

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-subtle pt-4">
                <span className="inline-flex items-center gap-1.5 font-mono text-sm text-ink-primary">
                  <Coins size={14} aria-hidden="true" className="text-persimmon" />
                  {priceLabel(item)}
                </span>
                {cosmetic && item.owned ? (
                  <Button
                    variant={item.equipped ? 'ghost' : 'outline'}
                    onClick={() =>
                      equip.mutate({
                        slot: item.type,
                        itemId: item.equipped ? null : item.id,
                      })
                    }
                    disabled={equip.isPending}
                  >
                    {item.equipped ? (
                      <>
                        <Check size={14} aria-hidden="true" /> Equipped
                      </>
                    ) : (
                      'Equip'
                    )}
                  </Button>
                ) : (
                  <span
                    className="relative"
                    title={
                      item.disabledReason === 'INSUFFICIENT_COINS'
                        ? `Need ${item.remainingCoins} more coins.`
                        : undefined
                    }
                  >
                    <Button
                      variant="outline"
                      disabled={!item.canBuy || purchase.isPending}
                      onClick={() => {
                        setError('');
                        setPending(item);
                      }}
                      aria-label={`Buy ${item.name} for ${item.price} coins`}
                    >
                      {item.atMax
                        ? 'Full'
                        : item.disabledReason === 'ALREADY_OWNED'
                          ? 'Owned'
                          : 'Buy'}
                    </Button>
                    {item.disabledReason === 'INSUFFICIENT_COINS' ? (
                      <span className="sr-only">Need {item.remainingCoins} more coins.</span>
                    ) : null}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-ink-muted">
        <Sparkles size={14} aria-hidden="true" />
        Purchases are final. No loot boxes, no real money.
      </p>

      <Modal
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
            setError('');
          }
        }}
        title="Confirm purchase"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setPending(null);
                setError('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => purchase.mutate(pending.id)} disabled={purchase.isPending}>
              Confirm purchase
            </Button>
          </>
        }
      >
        {pending ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <StoreIcon icon={pending.icon} />
              <div>
                <p className="font-medium text-ink-primary">{pending.name}</p>
                <p className="text-sm text-ink-secondary">{pending.description}</p>
                <p className="mt-1 font-mono text-sm text-ink-primary">
                  {priceLabel(pending)} · {Math.max(0, coins - pending.price)} coins left
                </p>
              </div>
            </div>
            {error ? (
              <p
                role="alert"
                className="rounded-control border border-crimson px-3 py-2 text-sm text-crimson"
              >
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
