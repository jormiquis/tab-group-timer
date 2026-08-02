/// <reference types="chrome" />
import { ActiveTabInfo } from "../domain/ActiveTabInfo";
import { groupIdentityOf } from "../domain/GroupIdentity";

export interface ActiveTabSnapshot extends ActiveTabInfo {
  /** Chrome's group id — usable for live lookups, never for storage identity. */
  groupId: number | null;
}

const TAB_GROUP_ID_NONE = -1;

export class ChromeAdapters {
  static async getActiveTabInfo(): Promise<ActiveTabSnapshot | null> {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || tab.id == null) return null;

    const groupId = tab.groupId != null && tab.groupId !== TAB_GROUP_ID_NONE ? tab.groupId : null;

    let rawTitle: string | undefined;
    if (groupId !== null) {
      try {
        rawTitle = (await chrome.tabGroups.get(groupId)).title;
      } catch {
        // Group vanished between the query and the lookup; treat it as untitled.
      }
    }

    return { groupId, ...groupIdentityOf(groupId, rawTitle) };
  }

  /** Every tab group currently open, across all windows. */
  static async listTabGroups(): Promise<Array<{ id: number; title?: string }>> {
    try {
      return await chrome.tabGroups.query({});
    } catch {
      return [];
    }
  }
}
