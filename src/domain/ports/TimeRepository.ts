import { TimeEntry } from "../TimeEntry";

export interface TimeRepository {
  /** Folds a tracked interval into its day/group bucket. */
  save(entry: TimeEntry): Promise<void>;
  listAll(): Promise<TimeEntry[]>;
  clearAll(): Promise<void>;
  /** Moves every bucket of `fromKey` onto `toKey`, merging on collision. */
  renameGroup(fromKey: string, toKey: string, newTitle: string): Promise<void>;
  /** Explicit, user-initiated deletion of one group's whole history. */
  deleteByGroupKey(groupKey: string): Promise<void>;
}
