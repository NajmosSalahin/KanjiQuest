/** Tiny class-name joiner (no dependency). */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}
