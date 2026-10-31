import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { Skeleton } from '../components/ui/Skeleton.jsx';

/** Statistics — prompt.md §7.7 / §9. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function parseDate(date) {
  return new Date(`${date}T00:00:00Z`);
}

function shortDate(date) {
  const d = parseDate(date);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function longDate(date) {
  const d = parseDate(date);
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function matchaShade(level) {
  if (level <= 0) return 'var(--bg-subtle)';
  return `color-mix(in srgb, var(--success-matcha) ${level * 20}%, transparent)`;
}

function Heatmap({ data = [] }) {
  const { weeks, labels } = useMemo(() => {
    if (!data.length) return { weeks: [], labels: [] };
    const first = parseDate(data[0].date);
    const offset = (first.getUTCDay() + 6) % 7; // Monday-first
    const cells = [...Array(offset).fill(null), ...data];
    const result = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    const monthLabels = [];
    let lastMonth = '';
    for (const week of result) {
      const day = week.find(Boolean);
      if (!day) {
        monthLabels.push('');
        continue;
      }
      const month = parseDate(day.date).getUTCMonth();
      if (MONTHS[month] !== lastMonth) {
        monthLabels.push(MONTHS[month]);
        lastMonth = MONTHS[month];
      } else {
        monthLabels.push('');
      }
    }
    return { weeks: result, labels: monthLabels };
  }, [data]);

  const max = Math.max(1, ...data.map((d) => d.reviews ?? 0));
  const levelFor = (reviews = 0) => {
    if (reviews <= 0) return 0;
    return Math.min(4, Math.max(1, Math.ceil((reviews / max) * 4)));
  };

  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[720px]">
        <div
          className="ml-6 grid gap-[2px] font-mono text-[10px] text-ink-muted"
          style={{ gridTemplateColumns: `repeat(${weeks.length}, 12px)` }}
          aria-hidden="true"
        >
          {labels.map((label, i) => (
            <span key={i} className="h-4 overflow-visible whitespace-nowrap">
              {label}
            </span>
          ))}
        </div>
        <div className="mt-1 flex gap-2">
          <div
            className="grid gap-[2px] pt-0 font-mono text-[10px] leading-[12px] text-ink-muted"
            style={{ gridTemplateRows: 'repeat(7, 12px)' }}
            aria-hidden="true"
          >
            {WEEKDAYS.map((day, i) => (
              <span key={i} className="w-4 text-center">
                {day}
              </span>
            ))}
          </div>
          <div
            className="grid grid-flow-col gap-[2px]"
            style={{ gridTemplateRows: 'repeat(7, 12px)', gridAutoColumns: '12px' }}
            role="img"
            aria-label="Review heatmap for the last 365 days"
          >
            {weeks.flatMap((week, weekIndex) =>
              WEEKDAYS.map((_, dayIndex) => {
                const day = week[dayIndex];
                if (!day) return <span key={`${weekIndex}-${dayIndex}`} className="h-3 w-3" />;
                const level = levelFor(day.reviews);
                return (
                  <span
                    key={day.date}
                    className="h-3 w-3 rounded-[3px]"
                    style={{ backgroundColor: matchaShade(level) }}
                    title={`${longDate(day.date)} · ${day.reviews} review${
                      day.reviews === 1 ? '' : 's'
                    }`}
                  />
                );
              })
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 font-mono text-[10px] text-ink-muted">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className="h-3 w-3 rounded-[3px]"
              style={{ backgroundColor: matchaShade(level) }}
              aria-hidden="true"
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children, className }) {
  return (
    <section
      className={cn('rounded-card border border-line-subtle bg-surface p-6 shadow-sm', className)}
    >
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold text-ink-primary">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ChartEmpty({ children }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-control bg-subtle px-4 text-center text-sm text-ink-muted">
      {children}
    </div>
  );
}

function AccuracyChart({ points = [] }) {
  const hasData = points.some((point) => point.total > 0);
  if (!hasData) return <ChartEmpty>No reviews in the last 30 days.</ChartEmpty>;
  const data = points.map((point) => ({ ...point, accuracy: point.rate }));
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            interval={6}
            tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-subtle)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              color: 'var(--ink-primary)',
              fontSize: 12,
            }}
            labelFormatter={longDate}
            formatter={(value) => [`${value}%`, 'Accuracy']}
          />
          <Line
            type="monotone"
            dataKey="accuracy"
            stroke="var(--success-matcha)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--success-matcha)', strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ForecastChart({ points = [] }) {
  const hasData = points.some((point) => point.count > 0);
  if (!hasData) return <ChartEmpty>No reviews are scheduled in the next 30 days.</ChartEmpty>;
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            interval={6}
            tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-subtle)' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              color: 'var(--ink-primary)',
              fontSize: 12,
            }}
            labelFormatter={longDate}
            formatter={(value) => [value, 'Due reviews']}
          />
          <Bar dataKey="count" fill="var(--accent-indigo)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function JlptBars({ levels = [] }) {
  const total = levels.reduce((sum, row) => sum + (row.total ?? 0), 0);
  if (!total) return <ChartEmpty>No N5–N3 kanji are loaded yet.</ChartEmpty>;
  return (
    <div className="space-y-4">
      {levels.map((row) => (
        <div key={row.level}>
          <div className="flex items-center justify-between gap-3">
            <span className="w-8 font-mono text-sm font-medium text-ink-primary">N{row.level}</span>
            <div
              className="flex h-3 flex-1 overflow-hidden rounded-full bg-subtle"
              role="img"
              aria-label={`N${row.level}: ${row.mastered} mastered, ${row.review} in review, ${row.learning} learning, ${row.new} new`}
            >
              <span
                style={{
                  width: `${row.percentages.mastered}%`,
                  background: 'var(--success-matcha)',
                }}
                title={`Mastered: ${row.mastered}`}
              />
              <span
                style={{
                  width: `${row.percentages.review}%`,
                  background: 'var(--warning-persimmon)',
                }}
                title={`Review: ${row.review}`}
              />
              <span
                style={{
                  width: `${row.percentages.learning}%`,
                  background: 'var(--accent-indigo)',
                }}
                title={`Learning: ${row.learning}`}
              />
              <span
                style={{ width: `${row.percentages.new}%`, background: 'var(--border-strong)' }}
                title={`New: ${row.new}`}
              />
            </div>
            <span className="w-12 text-right font-mono text-xs text-ink-secondary">
              {row.percentages.mastered}%
            </span>
          </div>
          <p className="ml-11 mt-1 font-mono text-[10px] text-ink-muted">
            {row.mastered} mastered · {row.review} review · {row.learning} learning · {row.new} new
          </p>
        </div>
      ))}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 font-mono text-[10px] text-ink-muted">
        {[
          ['New', 'var(--border-strong)'],
          ['Learning', 'var(--accent-indigo)'],
          ['Review', 'var(--warning-persimmon)'],
          ['Mastered', 'var(--success-matcha)'],
        ].map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function DayList({ title, days = [], empty }) {
  return (
    <div>
      <h3 className="font-mono text-xs uppercase tracking-[0.05em] text-ink-muted">{title}</h3>
      {days.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line-subtle">
          {days.map((day) => (
            <li key={day.date} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-ink-secondary">{longDate(day.date)}</span>
              <span className="font-mono text-xs text-ink-muted">{day.total} reviews</span>
              <span className="w-12 text-right font-mono text-sm font-medium text-ink-primary">
                {day.rate}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-48 rounded-card" />
      <Skeleton className="h-64 rounded-card" />
      <Skeleton className="h-48 rounded-card" />
      <Skeleton className="h-48 rounded-card" />
    </div>
  );
}

export default function Stats() {
  const query = useQuery({ queryKey: ['stats'], queryFn: () => api('/stats') });

  if (query.isLoading) return <StatsSkeleton />;
  if (query.isError) {
    return (
      <div className="mx-auto w-full max-w-[960px] rounded-card border border-line-subtle bg-surface p-6">
        <p className="text-sm text-ink-secondary">Statistics could not be loaded.</p>
      </div>
    );
  }

  const {
    heatmap = [],
    forecast = [],
    accuracy = { points: [] },
    jlpt = [],
    bestWorst,
  } = query.data ?? {};
  const best = bestWorst?.best ?? [];
  const worst = bestWorst?.worst ?? [];
  const accuracyAverage = accuracy.rate;

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-ink-primary">Statistics</h1>
        {accuracyAverage != null ? (
          <p className="font-mono text-sm text-ink-muted">{accuracyAverage}% 30-day accuracy</p>
        ) : null}
      </div>

      <Section
        title="Review heatmap"
        subtitle="Every review in the last year. Darker matcha means more reviews."
      >
        <Heatmap data={heatmap} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Accuracy" subtitle="Good or Easy ratings over the last 30 days.">
          <AccuracyChart points={accuracy.points} />
        </Section>
        <Section title="Forecast" subtitle="Reviews due over the next 30 days.">
          <ForecastChart points={forecast} />
        </Section>
      </div>

      <Section title="JLPT progress" subtitle="Your garden across the N5, N4, and N3 decks.">
        <JlptBars levels={jlpt} />
      </Section>

      <Section title="Best and worst days" subtitle="Only days with at least 10 reviews count.">
        <div className="grid gap-6 md:grid-cols-2">
          <DayList
            title="Best days"
            days={best}
            empty="Complete 10 reviews in a day to appear here."
          />
          <DayList
            title="Worst days"
            days={worst}
            empty="Complete 10 reviews in a day to appear here."
          />
        </div>
      </Section>
    </div>
  );
}
