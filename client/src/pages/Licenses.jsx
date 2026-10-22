import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Skeleton } from '../components/ui/Skeleton.jsx';

/** Data sources & licenses — prompt.md §5.8 (footer link target). */

export default function Licenses() {
  const licensesQuery = useQuery({
    queryKey: ['licenses'],
    queryFn: () => api('/licenses'),
    staleTime: 60 * 60_000,
  });

  if (licensesQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="mt-6 h-20 w-full" />
        <Skeleton className="mt-4 h-20 w-full" />
        <Skeleton className="mt-4 h-20 w-full" />
      </div>
    );
  }

  const { notice, sources } = licensesQuery.data;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-semibold text-ink-primary">
        Data sources and licenses
      </h1>

      <div className="mt-6 border-l-2 border-vermillion bg-subtle p-4 text-sm text-ink-secondary">
        {notice}
      </div>

      <div className="mt-6 space-y-4">
        {sources.map((source) => (
          <div key={source.name} className="rounded-card border border-line-subtle bg-surface p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-medium text-ink-primary">{source.name}</h2>
              <span className="shrink-0 rounded-full border border-line-subtle bg-subtle px-2.5 py-0.5 font-mono text-xs text-ink-muted">
                {source.license}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-secondary">{source.description}</p>
            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-xs text-ink-muted">{source.attribution}</span>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-vermillion underline-offset-4 transition-colors duration-fast ease-out hover:text-vermillion-hover hover:underline"
              >
                {source.url}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
