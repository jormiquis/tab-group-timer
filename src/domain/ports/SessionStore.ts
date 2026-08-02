import { ActiveSession } from "../Session";

/**
 * Survives service worker termination. The MV3 worker is killed after ~30s of
 * inactivity, so the in-flight session must live outside the worker's memory or
 * every uninterrupted stretch of work is lost.
 */
export interface SessionStore {
  get(): Promise<ActiveSession | null>;
  set(session: ActiveSession | null): Promise<void>;
}
