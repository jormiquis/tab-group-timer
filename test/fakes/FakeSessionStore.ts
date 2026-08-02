import { ActiveSession } from "../../src/domain/Session";
import { SessionStore } from "../../src/domain/ports/SessionStore";

/**
 * Stores a copy on both read and write, so a test cannot accidentally mutate the
 * "persisted" session through a shared reference — the real store serialises it.
 */
export class FakeSessionStore implements SessionStore {
  private session: ActiveSession | null = null;

  async get(): Promise<ActiveSession | null> {
    return this.session ? { ...this.session } : null;
  }

  async set(session: ActiveSession | null): Promise<void> {
    this.session = session ? { ...session } : null;
  }
}
