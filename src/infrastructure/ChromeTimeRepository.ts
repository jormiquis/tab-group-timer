import { TimeEntry } from "../domain/TimeEntry";
import { TimeRepository } from "../domain/ports/TimeRepository";

const STORAGE_KEY = "timeEntries";

export class ChromeTimeRepository implements TimeRepository {

  async save(entry: TimeEntry): Promise<void> {
    const all = await this.listAll();
    all.push(entry);
    await chrome.storage.local.set({ [STORAGE_KEY]: all });
  }

  async listAll(): Promise<TimeEntry[]> {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    return (res[STORAGE_KEY] as TimeEntry[] | undefined) ?? [];
  }

  async clearAll(): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  }

  async updateGroupTitle(groupId: number, newTitle: string): Promise<void> {
    const all = await this.listAll();
    const updated = all.map(entry => {
      if (entry.groupId === groupId) {
        return { ...entry, groupTitle: newTitle };
      }
      return entry;
    });
    await chrome.storage.local.set({ [STORAGE_KEY]: updated });
  }

  async deleteByGroupId(groupId: number): Promise<void> {
    const all = await this.listAll();
    const remaining = all.filter(entry => entry.groupId !== groupId);
    await chrome.storage.local.set({ [STORAGE_KEY]: remaining });
  }
}