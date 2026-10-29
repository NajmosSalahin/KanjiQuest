/**
 * Calendar-day helpers — §11.4 streaks run on the user's LOCAL day (their
 * timezone), never the server's. Day arithmetic is done on YYYY-MM-DD strings
 * anchored to UTC midnight, so DST transitions can never shift a day boundary.
 */

/** YYYY-MM-DD for a moment in the user's timezone. */
export function localDay(date, timeZone = 'UTC') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Hour of day (0-23) for a moment in the user's timezone. */
export function localHour(date, timeZone = 'UTC') {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false }).format(date)
  );
}

/** YYYY-MM-DD shifted by n calendar days. */
export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Calendar days from `from` to `to` (positive when to > from). */
export function dayDiff(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

/** "HH:MM" in the user's timezone (dashboard "next review at" copy, §7.1). */
export function localTime(date, timeZone = 'UTC') {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
