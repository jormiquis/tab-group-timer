// test/fakes/FakeTimeRepository.ts
import { TimeRepository } from "../../src/domain/ports/TimeRepository";
import { TimeEntry } from "../../src/domain/TimeEntry";

export class FakeTimeRepository implements TimeRepository {
  entries: TimeEntry[] = [];

  async save(entry: TimeEntry): Promise<void> {
    this.entries.push(entry);
  }

  async listAll(): Promise<TimeEntry[]> {
    return this.entries;
  }

  async clearAll(): Promise<void> {
    this.entries = [];
  }

  async updateGroupTitle(id: number, title: string): Promise<void> {
    this.entries.forEach(entry => {
      if (entry.groupId === id) {
        entry.groupTitle = title;
      }
    });
  }

   async deleteByGroupId(groupId: number): Promise<void> {
    const newEntries = this.entries.filter(entry => entry.groupId !== groupId);

    this.entries = newEntries;
  }
}