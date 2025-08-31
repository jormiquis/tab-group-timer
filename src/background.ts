import { TrackActiveTabUseCase } from "./application/TrackActiveTabUseCase";
import { StopOnBlurUseCase } from "./application/StopOnBlurUseCase";
import { ChromeTimeRepository } from "./infrastructure/ChromeTimeRepository";
import { SystemClock } from "./infrastructure/SystemClock";
import { ChromeAdapters } from "./infrastructure/ChromeAdapters";

const tracker = new TrackActiveTabUseCase(new ChromeTimeRepository(), new SystemClock());
const stopOnBlur = new StopOnBlurUseCase(tracker);

async function updateFromActiveTab() {
  const info = await ChromeAdapters.getActiveTabInfo();
  if (info) {
    await tracker.onActiveTabChanged(info);
  }
}

chrome.runtime.onStartup.addListener(updateFromActiveTab);
chrome.runtime.onInstalled.addListener(updateFromActiveTab);

chrome.tabs.onActivated.addListener(async () => {
  await updateFromActiveTab();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.groupId !== undefined) {
    await updateFromActiveTab();
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  await stopOnBlur.handleWindowFocusChanged(windowId);
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    await updateFromActiveTab();
  }
});

chrome.windows.onRemoved.addListener(async () => {
  await tracker.onFocusLost();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "LIST_TIME_ENTRIES") {
    (async () => {
      const repo = new ChromeTimeRepository();
      const entries = await repo.listAll();
      sendResponse({ entries });
    })();
    return true;
  }
  if (msg?.type === "CLEAR_ALL") {
    (async () => {
      const repo = new ChromeTimeRepository();
      await repo.clearAll();
      sendResponse({ ok: true });
    })();
    return true;
  }
});