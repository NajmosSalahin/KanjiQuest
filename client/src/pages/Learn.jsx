import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search } from 'lucide-react';
import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Select } from '../components/ui/Select.jsx';

/** Kanji browser — prompt.md §7.3. Server-side pagination (50/page), 250ms
 *  debounced server search, virtualized above 200 loaded items (§7.3). */

const SEARCH_DEBOUNCE_MS = 250;
const CELL_H = 144;
const ROW_GAP = 16;
const ROW_H = CELL_H + ROW_GAP;

const SORT_OPTIONS = [
  { value: 'frequency', label: 'Frequency' },
  { value: 'strokes', label: 'Stroke count' },
  { value: 'jlpt', label: 'JLPT' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'learning', label: 'Learning' },
  { value: 'mastered', label: 'Mastered' },
];

const JLPT_TABS = [
  { value: '5', label: 'N5' },
  { value: '4', label: 'N4' },
  { value: '3', label: 'N3' },
  { value: 'all', label: 'All' },
];

function computeColumns(width) {
  if (width >= 1024) return 6;
  if (width >= 768) return 4;
  return 3;
}

function useColumns() {
  const [columns, setColumns] = useState(() =>
    typeof window === 'undefined' ? 6 : computeColumns(window.innerWidth)
  );
  useEffect(() => {
    const update = () => setColumns(computeColumns(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return columns;
}

/** 6px progress dot (§7.3): matcha filled / half indigo / outlined. */
function ProgressDot({ status }) {
  if (status === 'mastered') {
    return <span aria-hidden="true" className="block h-1.5 w-1.5 rounded-full bg-matcha" />;
  }
  if (status === 'learning') {
    return (
      <span
        aria-hidden="true"
        className="block h-1.5 w-1.5 rounded-full border border-indigo"
        style={{
          background: 'linear-gradient(to right, var(--accent-indigo) 50%, transparent 50%)',
        }}
      />
    );
  }
  return (
    <span aria-hidden="true" className="block h-1.5 w-1.5 rounded-full border border-ink-muted" />
  );
}

function KanjiCell({ item, style }) {
  const status = item.status ?? 'new';
  const statusLabel =
    status === 'mastered' ? 'Mastered' : status === 'learning' ? 'Learning' : 'New';
  return (
    <Link
      to={`/kanji/${encodeURIComponent(item.character)}`}
      style={style}
      className={cn(
        'group flex h-36 flex-col items-center rounded-card border border-line-subtle bg-surface px-3 pt-3 pb-2 text-center',
        'transition duration-fast ease-out hover:border-line-strong hover:shadow-sm'
      )}
    >
      <span className="font-jp-serif text-[3rem] leading-none text-ink-primary">
        {item.character}
      </span>
      <span className="mt-2 w-full truncate text-xs text-ink-secondary">
        {(item.meanings ?? []).join(' · ')}
      </span>
      <span className="mt-auto flex items-center gap-1.5 pt-1.5">
        <ProgressDot status={status} />
        <span className="sr-only">{statusLabel}</span>
      </span>
    </Link>
  );
}

/** Custom SVG — empty garden bed (§7.3 no-results state). */
function EmptyGardenBedSvg({ size = 180 }) {
  return (
    <svg
      width={size}
      height={(size * 120) / 180}
      viewBox="0 0 180 120"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M24 62h132v34H24z"
        stroke="var(--border-strong)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M24 62l12-14h108l12 14"
        stroke="var(--border-strong)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M36 96v10M144 96v10"
        stroke="var(--border-strong)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* bare soil rows — nothing planted */}
      <path
        d="M40 74c8-4 16 4 24 0s16 4 24 0 16 4 24 0 16 4 24 0"
        stroke="var(--ink-muted)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="56" cy="86" r="2" fill="var(--accent-vermillion)" />
      <circle cx="90" cy="86" r="2" fill="var(--accent-vermillion)" />
      <circle cx="124" cy="86" r="2" fill="var(--accent-vermillion)" />
      {/* empty trellis */}
      <path
        d="M60 48V30M120 48V30M60 36h60"
        stroke="var(--border-subtle)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Learn() {
  const [searchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  // Deep link (§7.1 empty state): /learn?jlpt=5 opens the N5 tab.
  const [tab, setTab] = useState(() => {
    const jlpt = searchParams.get('jlpt');
    return JLPT_TABS.some((entry) => entry.value === jlpt) ? jlpt : 'all';
  });
  const [radical, setRadical] = useState(null);
  const [sort, setSort] = useState('frequency');
  const [status, setStatus] = useState('all');
  const columns = useColumns();

  // Debounced server search — 250ms (§7.3), queries the server, not an array.
  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const radicalsQuery = useQuery({
    queryKey: ['radicals'],
    queryFn: () => api('/radicals'),
    staleTime: 5 * 60_000,
  });

  const listQuery = useInfiniteQuery({
    queryKey: ['kanji-list', q, tab, radical, sort, status],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (tab !== 'all') params.set('jlpt', tab);
      if (radical) params.set('radical', radical);
      params.set('sort', sort);
      params.set('status', status);
      params.set('page', String(pageParam));
      params.set('limit', '50');
      return api(`/kanji?${params.toString()}`);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });

  const items = useMemo(
    () => (listQuery.data?.pages ?? []).flatMap((page) => page.items),
    [listQuery.data]
  );

  const clearFilters = () => {
    setSearchInput('');
    setQ('');
    setTab('all');
    setRadical(null);
    setSort('frequency');
    setStatus('all');
  };

  const showEmpty = !listQuery.isLoading && items.length === 0;

  return (
    <div>
      {/* Header (§7.3) */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-display text-3xl font-semibold text-ink-primary">Learn</h1>
        <div className="relative w-full md:w-[280px]">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="search"
            aria-label="Search kanji, meaning, or reading"
            placeholder="Search kanji, meaning, or reading"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full rounded-control border border-line-subtle bg-surface py-2 pl-9 pr-3 text-sm text-ink-primary transition-colors duration-fast ease-out placeholder:text-ink-muted hover:border-line-strong"
          />
        </div>
      </div>

      {/* JLPT segmented tabs — active = vermillion underline (§7.3) */}
      <div
        role="tablist"
        aria-label="JLPT level"
        className="mt-6 flex gap-5 border-b border-line-subtle"
      >
        {JLPT_TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              '-mb-px border-b-2 pb-2 text-sm font-medium transition-colors duration-fast ease-out',
              tab === value
                ? 'border-vermillion text-ink-primary'
                : 'border-transparent text-ink-secondary hover:text-ink-primary'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Radical pills — horizontal scrollable strip (§7.3) */}
      <div
        className="mt-4 flex gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label="Filter by radical"
      >
        {(radicalsQuery.data?.radicals ?? []).map((entry) => {
          const active = radical === entry.character;
          return (
            <button
              key={entry.character}
              type="button"
              aria-pressed={active}
              title={`${entry.meaning} radical — ${entry.count} kanji`}
              onClick={() => setRadical(active ? null : entry.character)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors duration-fast ease-out',
                active
                  ? 'border-line-strong bg-subtle text-ink-primary'
                  : 'border-line-subtle bg-surface text-ink-secondary hover:border-line-strong'
              )}
            >
              <span className="font-jp-serif text-base leading-none text-ink-primary">
                {entry.character}
              </span>
              <span className="font-mono text-[10px] text-ink-muted">{entry.count}</span>
            </button>
          );
        })}
      </div>

      {/* Secondary filters (§7.3) */}
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div className="w-44">
          <Select
            id="learn-sort"
            label="Sort by"
            options={SORT_OPTIONS}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          />
        </div>
        <div className="w-44">
          <Select
            id="learn-status"
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          />
        </div>
      </div>

      {/* Grid / results */}
      <div className="mt-6">
        {listQuery.isLoading ? (
          <div className="grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-card" />
            ))}
          </div>
        ) : null}

        {showEmpty ? (
          <EmptyState
            svg={<EmptyGardenBedSvg />}
            headline="No kanji match those filters"
            description="Try removing a filter or searching for a meaning."
            action={{ label: 'Clear filters', onClick: clearFilters }}
          />
        ) : null}

        {!showEmpty && items.length > 0 ? (
          <VirtualizedGridOrPlain columns={columns} items={items} />
        ) : null}
      </div>

      {/* Server-side pagination — 50 per page + Load more (§7.3) */}
      {listQuery.hasNextPage && !showEmpty ? (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={() => listQuery.fetchNextPage()}
            disabled={listQuery.isFetchingNextPage}
          >
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Plain CSS grid under 200 items; @tanstack/react-virtual rows above (§7.3). */
function VirtualizedGridOrPlain({ columns, items }) {
  const parentRef = useRef(null);
  const virtualized = items.length > 200;
  const rowCount = Math.ceil(items.length / columns);

  const virtualizer = useVirtualizer({
    count: virtualized ? rowCount : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 4,
    enabled: virtualized,
  });

  if (!virtualized) {
    return (
      <div className="grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {items.map((item) => (
          <KanjiCell key={item.character} item={item} />
        ))}
      </div>
    );
  }

  return (
    <div ref={parentRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const start = virtualRow.index * columns;
        const rowItems = items.slice(start, start + columns);
        return (
          <div
            key={virtualRow.key}
            className="absolute left-0 grid w-full grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6"
            style={{ transform: `translateY(${virtualRow.start}px)`, height: CELL_H }}
          >
            {rowItems.map((item) => (
              <KanjiCell key={item.character} item={item} style={{ height: CELL_H }} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
