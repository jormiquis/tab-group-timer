import { ActiveSession } from "../domain/Session";
import { TimeEntry } from "../domain/TimeEntry";

export type Request =
  | { type: "GET_SNAPSHOT" }
  | { type: "CLEAR_ALL" }
  | { type: "DELETE_GROUP"; groupKey: string };

export interface Snapshot {
  entries: TimeEntry[];
  /** Interval currently accruing, not yet folded into `entries`. */
  active: ActiveSession | null;
  /** Background clock reading, so the popup can render live time consistently. */
  now: number;
}

export const TIME_UPDATED = "TIME_UPDATED";
