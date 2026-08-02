/**
 * Local calendar day for an epoch timestamp, as YYYY-MM-DD.
 *
 * Deliberately local rather than UTC: a user in UTC+2 finishing at 01:00 should
 * see that time on the day they were actually working.
 */
export function localDate(epochMs: number): string {
  const d = new Date(epochMs);
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Local day `daysAgo` days before the day containing `epochMs`. */
export function localDateDaysAgo(epochMs: number, daysAgo: number): string {
  const d = new Date(epochMs);
  d.setDate(d.getDate() - daysAgo);
  return localDate(d.getTime());
}
