import { TimeEntry } from "src/domain/TimeEntry";
import { TimeRepository } from "src/domain/ports/TimeRepository";

export class InMemoryTimeRepository implements TimeRepository {
  private entries: TimeEntry[] = [];

  async save(entry: TimeEntry): Promise<void> {
    this.entries.push(entry);
  }

  async listAll(): Promise<TimeEntry[]> {
    return [...this.entries];
  }

  async updateGroupTitle(groupId: number, newTitle: string): Promise<void> {
    this.entries.forEach(entry => {
      if (entry.groupId === groupId) {
        entry.groupTitle = newTitle;
      }
    });
  }

  async clearAll(): Promise<void> {
    this.entries = [];
  }

  getEntries(): TimeEntry[] {
    return this.entries;
  }
}
