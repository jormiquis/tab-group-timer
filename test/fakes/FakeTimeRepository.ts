import { TimeEntry, bucketKey } from "../../src/domain/TimeEntry";
import { TimeRepository } from "../../src/domain/ports/TimeRepository";

/** Mirrors ChromeTimeRepository's day/group bucketing, without Chrome. */
export class FakeTimeRepository implements TimeRepository {
  buckets = new Map<string, TimeEntry>();

  async save(entry: TimeEntry): Promise<void> {
    const key = bucketKey(entry.date, entry.groupKey);
    const existing = this.buckets.get(key);

    this.buckets.set(
      key,
      existing
        ? {
            ...existing,
            groupTitle: entry.groupTitle,
            startedAt: Math.min(existing.startedAt, entry.startedAt),
            endedAt: Math.max(existing.endedAt, entry.endedAt),
            durationMs: existing.durationMs + entry.durationMs,
          }
        : { ...entry },
    );
  }

  async listAll(): Promise<TimeEntry[]> {
    return [...this.buckets.values()];
  }

  async clearAll(): Promise<void> {
    this.buckets.clear();
  }

  async renameGroup(fromKey: string, toKey: string, newTitle: string): Promise<void> {
    for (const [key, entry] of [...this.buckets]) {
      if (entry.groupKey !== fromKey) continue;
      this.buckets.delete(key);
      await this.save({ ...entry, groupKey: toKey, groupTitle: newTitle });
    }
  }

  async deleteByGroupKey(groupKey: string): Promise<void> {
    for (const [key, entry] of [...this.buckets]) {
      if (entry.groupKey === groupKey) this.buckets.delete(key);
    }
  }
}
