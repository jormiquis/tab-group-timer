import { GroupIdentity, groupIdentityOf } from "../domain/GroupIdentity";

const INDEX_KEY = "groupKeyById";

type Index = Record<string, GroupIdentity>;

/**
 * Remembers which stable key each live Chrome group id currently maps to.
 *
 * `chrome.tabGroups.onUpdated` reports the *new* title only, so without this we
 * could not tell which history bucket a rename should move. Kept in
 * `storage.session` because it is only meaningful for ids of the running
 * browser; `sync()` rebuilds it after a restart.
 */
export class ChromeGroupKeyIndex {
  private queue: Promise<unknown> = Promise.resolve();

  async get(groupId: number): Promise<GroupIdentity | null> {
    const index = await this.read();
    return index[String(groupId)] ?? null;
  }

  async set(groupId: number, identity: GroupIdentity): Promise<void> {
    await this.mutate((index) => {
      index[String(groupId)] = identity;
    });
  }

  async remove(groupId: number): Promise<void> {
    await this.mutate((index) => {
      delete index[String(groupId)];
    });
  }

  /** Rebuilds the index from the groups Chrome currently has open. */
  async sync(groups: Array<{ id: number; title?: string }>): Promise<void> {
    await this.mutate((index) => {
      for (const key of Object.keys(index)) delete index[key];
      for (const group of groups) {
        index[String(group.id)] = groupIdentityOf(group.id, group.title);
      }
    });
  }

  private async mutate(change: (index: Index) => void): Promise<void> {
    this.queue = this.queue.then(async () => {
      const index = await this.read();
      change(index);
      await chrome.storage.session.set({ [INDEX_KEY]: index });
    });
    await this.queue;
  }

  private async read(): Promise<Index> {
    const res = await chrome.storage.session.get(INDEX_KEY);
    return { ...((res[INDEX_KEY] as Index | undefined) ?? {}) };
  }
}
