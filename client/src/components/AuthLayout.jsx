/** Split auth layout — prompt.md §7.11: left = form (max 400px, vertically
 *  centered), right = decorative panel (soft bg, line-art kanji, tagline).
 *  Mobile: form only. */
export function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <span className="flex items-baseline gap-2">
            <span className="font-display text-[20px] font-semibold text-ink-primary">
              Kanji Garden
            </span>
            <span className="font-jp-serif text-xs text-ink-muted">植物</span>
          </span>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <aside
        aria-hidden="true"
        className="hidden w-[42%] max-w-[520px] flex-col items-center justify-center gap-10 border-l border-line-subtle bg-subtle lg:flex"
      >
        <svg width="240" height="240" viewBox="0 0 120 120" fill="none" aria-hidden="true">
          {/* 木 — line-art kanji, 1.5–3px strokes, ink + vermillion only (§3.7) */}
          <path d="M20 42 H100" stroke="var(--ink-primary)" strokeWidth="3" strokeLinecap="round" />
          <path
            d="M60 20 V100"
            stroke="var(--accent-vermillion)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M60 48 C48 62 38 74 24 84"
            stroke="var(--ink-primary)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M60 48 C72 62 82 74 96 84"
            stroke="var(--ink-primary)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <p className="font-display text-xl font-medium text-ink-secondary">
          Plant kanji. Watch them grow.
        </p>
      </aside>
    </div>
  );
}
