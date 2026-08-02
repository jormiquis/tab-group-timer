/**
 * Chrome recycles tab group ids across browser sessions, so an id is not a safe
 * identity for historical data: a brand new group can inherit the id of a group
 * that was tracked weeks ago. We key everything by the group title instead,
 * which matches the "1 task = 1 group" model this extension is built around.
 */

export const NO_GROUP_KEY = "__ungrouped__";
export const UNTITLED_GROUP_KEY = "__untitled__";

export const NO_GROUP_TITLE = "Ungrouped";
export const UNTITLED_GROUP_TITLE = "Untitled group";

export interface GroupIdentity {
  /** Stable key used for storage and aggregation. */
  groupKey: string;
  /** Human readable title shown in the UI. */
  groupTitle: string;
}

/**
 * Derives a stable identity from a Chrome tab group.
 *
 * Untitled groups all collapse into a single bucket on purpose: an unnamed
 * group has no identity to preserve, and keying it by its recyclable id would
 * let unrelated groups inherit each other's tracked time.
 */
export function groupIdentityOf(groupId: number | null, rawTitle?: string): GroupIdentity {
  if (groupId === null) {
    return { groupKey: NO_GROUP_KEY, groupTitle: NO_GROUP_TITLE };
  }

  const title = (rawTitle ?? "").trim();
  if (title === "") {
    return { groupKey: UNTITLED_GROUP_KEY, groupTitle: UNTITLED_GROUP_TITLE };
  }

  return { groupKey: groupKeyFromTitle(title), groupTitle: title };
}

/** Titles differing only in case or surrounding whitespace are the same task. */
export function groupKeyFromTitle(title: string): string {
  return `title:${title.trim().toLowerCase()}`;
}
