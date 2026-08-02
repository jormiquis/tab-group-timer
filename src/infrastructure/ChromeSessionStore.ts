import { ActiveSession } from "../domain/Session";
import { SessionStore } from "../domain/ports/SessionStore";

const SESSION_KEY = "activeSession";

/**
 * Backed by `chrome.storage.session`: in memory, wiped when the browser closes,
 * but outliving the service worker. Browser-scoped is the behaviour we want —
 * time must not keep accruing across a restart.
 */
export class ChromeSessionStore implements SessionStore {
  async get(): Promise<ActiveSession | null> {
    const res = await chrome.storage.session.get(SESSION_KEY);
    return (res[SESSION_KEY] as ActiveSession | undefined) ?? null;
  }

  async set(session: ActiveSession | null): Promise<void> {
    if (session === null) {
      await chrome.storage.session.remove(SESSION_KEY);
      return;
    }
    await chrome.storage.session.set({ [SESSION_KEY]: session });
  }
}
