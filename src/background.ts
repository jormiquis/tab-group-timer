import { StopOnBlurUseCase } from "./application/StopOnBlurUseCase";
import { TrackActiveTabUseCase } from "./application/TrackActiveTabUseCase";
import { groupIdentityOf } from "./domain/GroupIdentity";
import { ChromeAdapters } from "./infrastructure/ChromeAdapters";
import { ChromeGroupKeyIndex } from "./infrastructure/ChromeGroupKeyIndex";
import { ChromeSessionStore } from "./infrastructure/ChromeSessionStore";
import { ChromeTimeRepository } from "./infrastructure/ChromeTimeRepository";
import { SystemClock } from "./infrastructure/SystemClock";
import { Request, Snapshot, TIME_UPDATED } from "./shared/messages";

// --- Setup ---
const clock = new SystemClock();
const repository = new ChromeTimeRepository();
const sessions = new ChromeSessionStore();
const groupIndex = new ChromeGroupKeyIndex();
const tracker = new TrackActiveTabUseCase(repository, clock, sessions);
const stopOnBlur = new StopOnBlurUseCase(tracker);

const HEARTBEAT_ALARM = "tab-group-timer:heartbeat";
/** Chrome's floor for released extensions is one minute. */
const HEARTBEAT_MINUTES = 1;

// --- Helpers ---

/** Notifies the popup of new data. Fails silently when no popup is open. */
function notifyPopup(): void {
  chrome.runtime.sendMessage({ type: TIME_UPDATED }).catch(() => {
    // No popup listening.
  });
}

/**
 * Re-reads the active tab and hands it to the tracker. A missing active tab
 * (no focused window) counts as lost focus.
 */
async function handleTabChange(): Promise<void> {
  const info = await ChromeAdapters.getActiveTabInfo();

  if (info) {
    if (info.groupId !== null) {
      await groupIndex.set(info.groupId, { groupKey: info.groupKey, groupTitle: info.groupTitle });
    }
    await tracker.onActiveTabChanged({ groupKey: info.groupKey, groupTitle: info.groupTitle });
  } else {
    await tracker.onFocusLost();
  }

  notifyPopup();
}

/**
 * The worker is torn down whenever it goes idle, which used to take the running
 * session with it. The alarm both keeps the session checkpointed to disk and
 * revives the worker to do so.
 */
async function ensureHeartbeat(): Promise<void> {
  const existing = await chrome.alarms.get(HEARTBEAT_ALARM);
  if (!existing) {
    await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_MINUTES });
  }
}

/** Rebuilds volatile state after the browser (re)starts. */
async function bootstrap(): Promise<void> {
  await ensureHeartbeat();
  await groupIndex.sync(await ChromeAdapters.listTabGroups());
  await handleTabChange();
}

// --- Lifecycle ---

// Listeners return their promise so callers can await them; Chrome ignores it.
chrome.runtime.onInstalled.addListener(() => bootstrap());

chrome.runtime.onStartup.addListener(() => bootstrap());

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== HEARTBEAT_ALARM) return;
  await tracker.checkpoint();
  notifyPopup();
});

// --- Event Listeners ---

chrome.tabs.onActivated.addListener(() => handleTabChange());

// Fires when a tab joins or leaves a group.
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.groupId !== undefined) {
    await handleTabChange();
  }
});

// Pause while Chrome is in the background, resume when it comes back.
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  await stopOnBlur.handleWindowFocusChanged(windowId, chrome.windows.WINDOW_ID_NONE);

  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    await handleTabChange();
  } else {
    notifyPopup();
  }
});

// Pause while the machine is idle or locked.
chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === "active") {
    await handleTabChange();
  } else {
    await tracker.onFocusLost();
    notifyPopup();
  }
});

/**
 * A rename changes the group's stable key, so its history has to move with it.
 * Also fires for colour changes and collapses, which leave the key untouched.
 */
chrome.tabGroups.onUpdated.addListener(async (group) => {
  const next = groupIdentityOf(group.id, group.title);
  const previous = await groupIndex.get(group.id);

  await groupIndex.set(group.id, next);

  if (!previous || previous.groupKey === next.groupKey) return;

  await repository.renameGroup(previous.groupKey, next.groupKey, next.groupTitle);
  await tracker.onGroupRenamed(previous.groupKey, next);
  notifyPopup();
});

/**
 * Closing a group ends tracking for it but must never erase what it recorded —
 * a finished task is exactly the data the user wants to keep.
 */
chrome.tabGroups.onRemoved.addListener(async (group) => {
  await groupIndex.remove(group.id);
});

// --- Message Handling for the Popup ---

chrome.runtime.onMessage.addListener((message: Request, _sender, sendResponse) => {
  if (message?.type === "GET_SNAPSHOT") {
    buildSnapshot().then(sendResponse);
    return true;
  }

  if (message?.type === "CLEAR_ALL") {
    repository
      .clearAll()
      .then(() => tracker.restartCurrentInterval())
      .then(buildSnapshot)
      .then(sendResponse);
    return true;
  }

  if (message?.type === "DELETE_GROUP") {
    deleteGroup(message.groupKey).then(sendResponse);
    return true;
  }

  return false;
});

/**
 * Erasing the group that is being tracked also restarts its interval, otherwise
 * the time already accrued would reappear at the next checkpoint.
 */
async function deleteGroup(groupKey: string): Promise<Snapshot> {
  await repository.deleteByGroupKey(groupKey);

  const active = await tracker.getActiveSession();
  if (active?.groupKey === groupKey) {
    await tracker.restartCurrentInterval();
  }

  return buildSnapshot();
}

async function buildSnapshot(): Promise<Snapshot> {
  const [entries, active] = await Promise.all([repository.listAll(), tracker.getActiveSession()]);
  return { entries, active, now: clock.now() };
}

/**
 * The worker also starts on demand, without any lifecycle event, so the
 * heartbeat is re-armed on every boot. Exported so tests can await start-up.
 */
export const ready = ensureHeartbeat();
