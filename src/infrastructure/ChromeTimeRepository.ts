import {
  NO_GROUP_KEY,
  NO_GROUP_TITLE,
  UNTITLED_GROUP_KEY,
  UNTITLED_GROUP_TITLE,
  groupKeyFromTitle,
} from "../domain/GroupIdentity";
import { localDate } from "../domain/LocalDate";
import { TimeEntry, bucketKey } from "../domain/TimeEntry";
import { TimeRepository } from "../domain/ports/TimeRepository";

const STORAGE_KEY = "timeTracking";
const LEGACY_STORAGE_KEY = "timeEntries";
const SCHEMA_VERSION = 2;

interface StoredState {
  schemaVersion: number;
  /** Keyed by `${date}|${groupKey}` so storage stays bounded by days × groups. */
  buckets: Record<string, TimeEntry>;
}

/**
 * Every mutation is a read-modify-write over one storage key, so concurrent
 * event handlers would clobber each other. All writes go through a promise
 * chain that serialises them.
 */
export class ChromeTimeRepository implements TimeRepository {
  private queue: Promise<unknown> = Promise.resolve();

  async save(entry: TimeEntry): Promise<void> {
    await this.mutate((state) => {
      const key = bucketKey(entry.date, entry.groupKey);
      state.buckets[key] = merge(state.buckets[key], entry, entry.groupTitle);
    });
  }

  async listAll(): Promise<TimeEntry[]> {
    const { state } = await this.read();
    return Object.values(state.buckets);
  }

  async clearAll(): Promise<void> {
    await this.mutate((state) => {
      state.buckets = {};
    });
  }

  async renameGroup(fromKey: string, toKey: string, newTitle: string): Promise<void> {
    await this.mutate((state) => {
      if (fromKey === toKey) {
        for (const entry of Object.values(state.buckets)) {
          if (entry.groupKey === toKey) entry.groupTitle = newTitle;
        }
        return;
      }

      for (const [key, entry] of Object.entries(state.buckets)) {
        if (entry.groupKey !== fromKey) continue;

        delete state.buckets[key];
        const target = bucketKey(entry.date, toKey);
        state.buckets[target] = merge(
          state.buckets[target],
          { ...entry, groupKey: toKey, groupTitle: newTitle },
          newTitle,
        );
      }
    });
  }

  async deleteByGroupKey(groupKey: string): Promise<void> {
    await this.mutate((state) => {
      for (const [key, entry] of Object.entries(state.buckets)) {
        if (entry.groupKey === groupKey) delete state.buckets[key];
      }
    });
  }

  private async mutate(change: (state: StoredState) => void): Promise<void> {
    this.queue = this.queue.then(async () => {
      const { state, migrated } = await this.read();
      change(state);
      await chrome.storage.local.set({ [STORAGE_KEY]: state });
      // The v1 records are now folded into buckets; drop them so they cannot be
      // migrated a second time and so they stop taking up quota.
      if (migrated) await chrome.storage.local.remove(LEGACY_STORAGE_KEY);
    });
    await this.queue;
  }

  private async read(): Promise<{ state: StoredState; migrated: boolean }> {
    const res = await chrome.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
    const stored = res[STORAGE_KEY] as StoredState | undefined;

    if (stored && stored.schemaVersion === SCHEMA_VERSION) {
      return {
        state: { schemaVersion: SCHEMA_VERSION, buckets: { ...stored.buckets } },
        migrated: false,
      };
    }

    const legacy = res[LEGACY_STORAGE_KEY] as LegacyEntry[] | undefined;
    if (legacy?.length) {
      return { state: migrateLegacy(legacy), migrated: true };
    }

    return { state: { schemaVersion: SCHEMA_VERSION, buckets: {} }, migrated: false };
  }
}

function merge(existing: TimeEntry | undefined, incoming: TimeEntry, title: string): TimeEntry {
  if (!existing) return { ...incoming, groupTitle: title };

  return {
    ...existing,
    groupTitle: title,
    startedAt: Math.min(existing.startedAt, incoming.startedAt),
    endedAt: Math.max(existing.endedAt, incoming.endedAt),
    durationMs: existing.durationMs + incoming.durationMs,
  };
}

interface LegacyEntry {
  groupId: number;
  groupTitle: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
}

/**
 * v1 stored one append-only record per interval, identified by a recyclable
 * Chrome group id. We fold those records into day/group buckets, recovering the
 * identity from the title each record was written with.
 */
function migrateLegacy(entries: LegacyEntry[]): StoredState {
  const state: StoredState = { schemaVersion: SCHEMA_VERSION, buckets: {} };

  for (const entry of entries) {
    const { groupKey, groupTitle } = legacyIdentity(entry.groupTitle);
    const date = localDate(entry.startedAt);
    const key = bucketKey(date, groupKey);

    state.buckets[key] = merge(
      state.buckets[key],
      { groupKey, groupTitle, date, startedAt: entry.startedAt, endedAt: entry.endedAt, durationMs: entry.durationMs },
      groupTitle,
    );
  }

  return state;
}

function legacyIdentity(rawTitle: string): { groupKey: string; groupTitle: string } {
  const title = (rawTitle ?? "").trim();

  if (title === "" || title === "No group") {
    return { groupKey: NO_GROUP_KEY, groupTitle: NO_GROUP_TITLE };
  }
  // v1 labelled untitled groups "Grupo <id>", which carried no real identity.
  if (/^Grupo \d+$/.test(title)) {
    return { groupKey: UNTITLED_GROUP_KEY, groupTitle: UNTITLED_GROUP_TITLE };
  }

  return { groupKey: groupKeyFromTitle(title), groupTitle: title };
}
