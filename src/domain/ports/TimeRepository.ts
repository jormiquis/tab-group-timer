import { TimeEntry } from "../TimeEntry";

export interface TimeRepository {
  save(entry: TimeEntry): Promise<void>;
  listAll(): Promise<TimeEntry[]>;
  clearAll(): Promise<void>;
  updateGroupTitle(groupId: number, newTitle: string): Promise<void>;
  deleteByGroupId(groupId: number): Promise<void>;
}