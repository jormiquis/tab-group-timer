export interface TimeEntry {
  groupKey: string;   // stable identity, see GroupIdentity
  groupTitle: string; // display title at the time of writing
  date: string;       // local calendar day, YYYY-MM-DD
  startedAt: number;  // epoch ms, earliest start folded into this entry
  endedAt: number;    // epoch ms, latest end folded into this entry
  durationMs: number; // total tracked time for this group on this day
}

/** Storage key for a day/group bucket. */
export function bucketKey(date: string, groupKey: string): string {
  return `${date}|${groupKey}`;
}
