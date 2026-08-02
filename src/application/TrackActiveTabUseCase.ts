import { ActiveTabInfo } from "../domain/ActiveTabInfo";
import { localDate } from "../domain/LocalDate";
import { ActiveSession } from "../domain/Session";
import { Clock } from "../domain/ports/Clock";
import { SessionStore } from "../domain/ports/SessionStore";
import { TimeRepository } from "../domain/ports/TimeRepository";

/** Intervals shorter than this are pass-through noise, not work. */
const MIN_TRACKED_MS = 500;

export class TrackActiveTabUseCase {
  constructor(
    private repo: TimeRepository,
    private clock: Clock,
    private sessions: SessionStore,
  ) {}

  /**
   * Staying inside the same group keeps the running session untouched: only a
   * real group change closes the current interval and opens a new one.
   */
  async onActiveTabChanged(info: ActiveTabInfo): Promise<void> {
    const now = this.clock.now();
    const current = await this.sessions.get();

    if (current && current.groupKey === info.groupKey) {
      if (current.groupTitle !== info.groupTitle) {
        await this.sessions.set({ ...current, groupTitle: info.groupTitle });
      }
      return;
    }

    if (current) {
      await this.persist(current, now);
    }

    await this.sessions.set({
      groupKey: info.groupKey,
      groupTitle: info.groupTitle,
      startedAt: now,
    });
  }

  async onFocusLost(): Promise<void> {
    const now = this.clock.now();
    const current = await this.sessions.get();
    if (current) {
      await this.persist(current, now);
    }
    await this.sessions.set(null);
  }

  /**
   * Writes everything accrued so far and restarts the interval from now, without
   * interrupting tracking. Called on a timer so an uninterrupted stretch of work
   * is durable even if the worker is killed or the browser crashes.
   */
  async checkpoint(): Promise<void> {
    const now = this.clock.now();
    const current = await this.sessions.get();
    if (!current) return;

    await this.persist(current, now);
    await this.sessions.set({ ...current, startedAt: now });
  }

  /**
   * Drops time accrued so far without writing it, but keeps tracking the same
   * group. Used after the user erases data, so the interval that was already
   * running does not immediately reappear.
   */
  async restartCurrentInterval(): Promise<void> {
    const current = await this.sessions.get();
    if (!current) return;
    await this.sessions.set({ ...current, startedAt: this.clock.now() });
  }

  /** Rolls the running session onto the renamed group's identity. */
  async onGroupRenamed(fromKey: string, to: { groupKey: string; groupTitle: string }): Promise<void> {
    const current = await this.sessions.get();
    if (current && current.groupKey === fromKey) {
      await this.sessions.set({ ...current, groupKey: to.groupKey, groupTitle: to.groupTitle });
    }
  }

  async getActiveSession(): Promise<ActiveSession | null> {
    return this.sessions.get();
  }

  /**
   * Splits the interval across local calendar days so a session running past
   * midnight is credited to the day each part belongs to.
   */
  private async persist(session: ActiveSession, endedAt: number): Promise<void> {
    if (endedAt - session.startedAt < MIN_TRACKED_MS) return;

    for (const slice of splitByLocalDay(session.startedAt, endedAt)) {
      await this.repo.save({
        groupKey: session.groupKey,
        groupTitle: session.groupTitle,
        date: localDate(slice.from),
        startedAt: slice.from,
        endedAt: slice.to,
        durationMs: slice.to - slice.from,
      });
    }
  }
}

function splitByLocalDay(from: number, to: number): Array<{ from: number; to: number }> {
  const slices: Array<{ from: number; to: number }> = [];
  let cursor = from;

  while (cursor < to) {
    const end = Math.min(startOfNextLocalDay(cursor), to);
    slices.push({ from: cursor, to: end });
    cursor = end;
  }

  return slices;
}

function startOfNextLocalDay(epochMs: number): number {
  const d = new Date(epochMs);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}
