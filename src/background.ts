import { StopOnBlurUseCase } from "./application/StopOnBlurUseCase";
import { TrackActiveTabUseCase } from "./application/TrackActiveTabUseCase";
import { ChromeAdapters } from "./infrastructure/ChromeAdapters";
import { ChromeTimeRepository } from "./infrastructure/ChromeTimeRepository";
import { SystemClock } from "./infrastructure/SystemClock";

// --- Setup ---
const clock = new SystemClock();
const repository = new ChromeTimeRepository();
const tracker = new TrackActiveTabUseCase(repository, clock);
const stopOnBlur = new StopOnBlurUseCase(tracker);

// --- Helpers ---

/**
 * Sends a message to the popup to notify it of data changes.
 * It ignores errors that happen if the popup is not open.
 */
function safeSendTimeUpdated() {
  chrome.runtime.sendMessage({ type: "TIME_UPDATED" }).catch(() => {
    // Popup not open, ignore error
  });
}

/**
 * Fetches the current active tab info and updates the tracker.
 * If no active tab is found (e.g., no focused window), it's treated as focus lost.
 */
async function handleTabChange() {
  const info = await ChromeAdapters.getActiveTabInfo();
  if (info) {
    await tracker.onActiveTabChanged(info);
  } else {
    await tracker.onFocusLost();
  }
  safeSendTimeUpdated();
}

// --- Event Listeners ---

// Track active tab changes
chrome.tabs.onActivated.addListener(handleTabChange);

// Track tab updates (e.g., moving a tab to/from a group)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // We only care if the active tab's group changes.
  if (tab.active && changeInfo.groupId !== undefined) {
    await handleTabChange();
  }
});

// Track window focus changes to pause/resume
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  await stopOnBlur.handleWindowFocusChanged(windowId, chrome.windows.WINDOW_ID_NONE);
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    // When focus returns, re-evaluate the active tab
    await handleTabChange();
  } else {
    safeSendTimeUpdated();
  }
});

// Track system idle state
chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === "active") {
    await handleTabChange();
  } else {
    await tracker.onFocusLost();
    safeSendTimeUpdated();
  }
});

// Handle group renames to fix historical data
chrome.tabGroups.onUpdated.addListener(async (group) => {
  const newTitle = group.title || `Grupo ${group.id}`;
  await repository.updateGroupTitle(group.id, newTitle);
  tracker.onGroupTitleChanged(group.id, newTitle);
  safeSendTimeUpdated();
});

// --- Message Handling for Popup ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LIST_TIME_ENTRIES") {
    repository.listAll().then(entries => sendResponse({ entries }));
    return true; // Indicates async response
  }
  if (message.type === "CLEAR_ALL") {
    repository.clearAll().then(() => sendResponse({}));
    return true; // Indicates async response
  }
});