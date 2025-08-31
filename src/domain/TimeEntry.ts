export interface TimeEntry {
  groupId: number;
  groupTitle: string;
  startedAt: number; // epoch ms
  endedAt: number;   // epoch ms
  durationMs: number; // derived
}