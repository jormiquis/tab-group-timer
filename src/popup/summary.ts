import { localDate, localDateDaysAgo } from "../domain/LocalDate";
import { ActiveSession } from "../domain/Session";
import { TimeEntry } from "../domain/TimeEntry";

export type Range = "today" | "week" | "all";

export interface GroupSummary {
  groupKey: string;
  groupTitle: string;
  durationMs: number;
  percent: number;
  /** True for the group currently accruing time. */
  isActive: boolean;
}

export interface Summary {
  rows: GroupSummary[];
  totalMs: number;
}

export function isWithinRange(date: string, range: Range, now: number): boolean {
  if (range === "all") return true;
  if (range === "today") return date === localDate(now);
  return date >= localDateDaysAgo(now, 6);
}

/**
 * Folds stored buckets plus the interval still running into per-group totals,
 * sorted longest first.
 */
export function summarize(
  entries: TimeEntry[],
  active: ActiveSession | null,
  now: number,
  range: Range,
): Summary {
  const totals = new Map<string, GroupSummary>();

  const add = (groupKey: string, groupTitle: string, durationMs: number) => {
    const existing = totals.get(groupKey);
    if (existing) {
      existing.durationMs += durationMs;
      existing.groupTitle = groupTitle;
    } else {
      totals.set(groupKey, { groupKey, groupTitle, durationMs, percent: 0, isActive: false });
    }
  };

  for (const entry of entries) {
    if (!isWithinRange(entry.date, range, now)) continue;
    add(entry.groupKey, entry.groupTitle, entry.durationMs);
  }

  // The running interval is not in storage until the next checkpoint, so the
  // popup adds it in to show live time.
  if (active) {
    const elapsed = Math.max(0, now - active.startedAt);
    if (isWithinRange(localDate(active.startedAt), range, now)) {
      add(active.groupKey, active.groupTitle, elapsed);
    }
    const row = totals.get(active.groupKey);
    if (row) row.isActive = true;
  }

  const rows = [...totals.values()].sort((a, b) => b.durationMs - a.durationMs);
  const totalMs = rows.reduce((sum, row) => sum + row.durationMs, 0);

  for (const row of rows) {
    row.percent = totalMs > 0 ? Math.round((row.durationMs / totalMs) * 100) : 0;
  }

  return { rows, totalMs };
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => `${n}`.padStart(2, "0")).join(":");
}

/** Compact form for the range total, e.g. `4h 12m`. */
export function formatCompact(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function toCsv(entries: TimeEntry[]): string {
  const header = "date,group,duration,duration_seconds";
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date) || a.groupTitle.localeCompare(b.groupTitle))
    .map((entry) =>
      [
        entry.date,
        csvField(entry.groupTitle),
        formatDuration(entry.durationMs),
        Math.round(entry.durationMs / 1000),
      ].join(","),
    );

  return [header, ...rows].join("\n");
}

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
