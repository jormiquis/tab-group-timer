import { ActiveTabInfo } from "../application/TrackActiveTabUseCase";

export class ChromeAdapters {
  static async getActiveTabInfo(): Promise<ActiveTabInfo | null> {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || tab.id == null) return null;

    const groupId = tab.groupId != null && tab.groupId !== -1 ? tab.groupId : null;

    let groupTitle = "Sin grupo";
    if (groupId !== null) {
      try {
        const group = await chrome.tabGroups.get(groupId);
        groupTitle = group.title || `Grupo ${groupId}`;
      } catch {
        groupTitle = `Grupo ${groupId}`;
      }
    }

    return { groupId, groupTitle };
  }
}