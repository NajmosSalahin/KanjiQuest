import { Skeleton } from './ui/Skeleton.jsx';

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
