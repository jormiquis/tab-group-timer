
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChromeAdapters } from "../src/infrastructure/ChromeAdapters";
import { TrackActiveTabUseCase } from "../src/application/TrackActiveTabUseCase";
import { StopOnBlurUseCase } from "../src/application/StopOnBlurUseCase";
import { ChromeTimeRepository } from "../src/infrastructure/ChromeTimeRepository";

// Mock dependencies
vi.mock("src/infrastructure/ChromeAdapters");
vi.mock("src/application/TrackActiveTabUseCase");
vi.mock("src/application/StopOnBlurUseCase");
vi.mock("src/infrastructure/ChromeTimeRepository");
vi.mock("src/infrastructure/SystemClock");


describe("background.ts integration tests", () => {
    const mockChrome = {
        tabs: {
            onActivated: { addListener: vi.fn() },
            onUpdated: { addListener: vi.fn() },
        },
        windows: {
            onFocusChanged: { addListener: vi.fn() },
            WINDOW_ID_NONE: -1,
        },
        idle: {
            onStateChanged: { addListener: vi.fn() },
        },
        tabGroups: {
            onUpdated: { addListener: vi.fn() },
            onRemoved: { addListener: vi.fn() },
        },
        runtime: {
            onMessage: { addListener: vi.fn() },
            sendMessage: vi.fn().mockResolvedValue(undefined),
        },
    };

    beforeEach(async () => {
        vi.resetModules(); // Asegura un entorno limpio para cada test
        vi.stubGlobal("chrome", mockChrome);
        await import("../src/background");
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("chrome.tabs.onActivated", () => {
        it("should call tracker.onActiveTabChanged when an active tab is found", async () => {
            const onActivatedListener = mockChrome.tabs.onActivated.addListener.mock.calls[0][0];
            const activeTabInfo = {groupId: 1, groupTitle: "Test"};
            vi.mocked(ChromeAdapters.getActiveTabInfo).mockResolvedValue(activeTabInfo);

            await onActivatedListener();

            expect(ChromeAdapters.getActiveTabInfo).toHaveBeenCalled();
            const trackerInstance = vi.mocked(TrackActiveTabUseCase).mock.instances[0];
            expect(trackerInstance.onActiveTabChanged).toHaveBeenCalledWith(activeTabInfo);
        });

        it("should call tracker.onFocusLost when no active tab is found", async () => {
            const onActivatedListener = mockChrome.tabs.onActivated.addListener.mock.calls[0][0];
            vi.mocked(ChromeAdapters.getActiveTabInfo).mockResolvedValue(null);

            await onActivatedListener();

            expect(ChromeAdapters.getActiveTabInfo).toHaveBeenCalled();
            const trackerInstance = vi.mocked(TrackActiveTabUseCase).mock.instances[0];
            expect(trackerInstance.onFocusLost).toHaveBeenCalled();
        });
    });

    describe("chrome.windows.onFocusChanged", () => {
        it("should call stopOnBlur.handleWindowFocusChanged and handleTabChange when focus returns", async () => {
            const onFocusChangedListener = mockChrome.windows.onFocusChanged.addListener.mock.calls[0][0];
            const windowId = 1;
            const activeTabInfo = { groupId: 1, groupTitle: "Test" };
            vi.mocked(ChromeAdapters.getActiveTabInfo).mockResolvedValue(activeTabInfo);

            await onFocusChangedListener(windowId);

            const stopOnBlurInstance = vi.mocked(StopOnBlurUseCase).mock.instances[0];
            expect(stopOnBlurInstance.handleWindowFocusChanged).toHaveBeenCalledWith(windowId, -1);

            expect(ChromeAdapters.getActiveTabInfo).toHaveBeenCalled();
            const trackerInstance = vi.mocked(TrackActiveTabUseCase).mock.instances[0];
            expect(trackerInstance.onActiveTabChanged).toHaveBeenCalledWith(activeTabInfo);
        });

        it("should only call stopOnBlur when focus is lost", async () => {
            const onFocusChangedListener = mockChrome.windows.onFocusChanged.addListener.mock.calls[0][0];
            const windowId = -1;

            await onFocusChangedListener(windowId);

            const stopOnBlurInstance = vi.mocked(StopOnBlurUseCase).mock.instances[0];
            expect(stopOnBlurInstance.handleWindowFocusChanged).toHaveBeenCalledWith(windowId, -1);
            expect(ChromeAdapters.getActiveTabInfo).not.toHaveBeenCalled();
        });
    });

    describe("chrome.tabs.onUpdated", () => {
        it("should call handleTabChange when the active tab's group changes", async () => {
            const onUpdatedListener = mockChrome.tabs.onUpdated.addListener.mock.calls[0][0];
            const tab = { active: true };
            const changeInfo = { groupId: 1 };
            const activeTabInfo = { groupId: 1, groupTitle: "Test" };
            vi.mocked(ChromeAdapters.getActiveTabInfo).mockResolvedValue(activeTabInfo);

            await onUpdatedListener(1, changeInfo, tab);

            expect(ChromeAdapters.getActiveTabInfo).toHaveBeenCalled();
            const trackerInstance = vi.mocked(TrackActiveTabUseCase).mock.instances[0];
            expect(trackerInstance.onActiveTabChanged).toHaveBeenCalledWith(activeTabInfo);
        });

        it("should not call handleTabChange if the tab is not active", async () => {
            const onUpdatedListener = mockChrome.tabs.onUpdated.addListener.mock.calls[0][0];
            const tab = { active: false };
            const changeInfo = { groupId: 1 };
            vi.mocked(ChromeAdapters.getActiveTabInfo);

            await onUpdatedListener(1, changeInfo, tab);

            expect(ChromeAdapters.getActiveTabInfo).not.toHaveBeenCalled();
        });

        it("should not call handleTabChange if groupId has not changed", async () => {
            const onUpdatedListener = mockChrome.tabs.onUpdated.addListener.mock.calls[0][0];
            const tab = { active: true };
            const changeInfo = { status: "complete" }; // No groupId change
            vi.mocked(ChromeAdapters.getActiveTabInfo);

            await onUpdatedListener(1, changeInfo, tab);

            expect(ChromeAdapters.getActiveTabInfo).not.toHaveBeenCalled();
        });
    });

    describe("chrome.idle.onStateChanged", () => {
        it("should call handleTabChange when state is active", async () => {
            const onStateChangedListener = mockChrome.idle.onStateChanged.addListener.mock.calls[0][0];
            const activeTabInfo = { groupId: 1, groupTitle: "Test"};
            vi.mocked(ChromeAdapters.getActiveTabInfo).mockResolvedValue(activeTabInfo);

            await onStateChangedListener("active");

            expect(ChromeAdapters.getActiveTabInfo).toHaveBeenCalled();
            const trackerInstance = vi.mocked(TrackActiveTabUseCase).mock.instances[0];
            expect(trackerInstance.onActiveTabChanged).toHaveBeenCalledWith(activeTabInfo);
        });

        it("should call tracker.onFocusLost when state is not active", async () => {
            const onStateChangedListener = mockChrome.idle.onStateChanged.addListener.mock.calls[0][0];

            await onStateChangedListener("idle");

            const trackerInstance = vi.mocked(TrackActiveTabUseCase).mock.instances[0];
            expect(trackerInstance.onFocusLost).toHaveBeenCalled();
        });
    });

    describe("chrome.tabGroups.onUpdated", () => {
        it("should update group title in repository and tracker", async () => {
            const onUpdatedListener = mockChrome.tabGroups.onUpdated.addListener.mock.calls[0][0];
            const group = { id: 1, title: "New Title" };

            await onUpdatedListener(group);

            const repositoryInstance = vi.mocked(ChromeTimeRepository).mock.instances[0];
            expect(repositoryInstance.updateGroupTitle).toHaveBeenCalledWith(1, "New Title");

            const trackerInstance = vi.mocked(TrackActiveTabUseCase).mock.instances[0];
            expect(trackerInstance.onGroupTitleChanged).toHaveBeenCalledWith(1, "New Title");
        });
    });

    describe("chrome.runtime.onMessage", () => {
        it("should handle LIST_TIME_ENTRIES message", async () => {
            const onMessageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
            const sendResponse = vi.fn();
            const repositoryInstance = vi.mocked(ChromeTimeRepository).mock.instances[0];
            const entries = [{ id: 1, name: "Test Entry" }];
            vi.mocked(repositoryInstance.listAll).mockResolvedValue(entries as any);

            const result = onMessageListener({ type: "LIST_TIME_ENTRIES" }, {}, sendResponse);
            expect(result).toBe(true);

            // Wait for the promise to resolve
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(repositoryInstance.listAll).toHaveBeenCalled();
            expect(sendResponse).toHaveBeenCalledWith({ entries });
        });

        it("should handle CLEAR_ALL message", async () => {
            const onMessageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
            const sendResponse = vi.fn();
            const repositoryInstance = vi.mocked(ChromeTimeRepository).mock.instances[0];
            vi.mocked(repositoryInstance.clearAll).mockResolvedValue(undefined);

            const result = onMessageListener({ type: "CLEAR_ALL" }, {}, sendResponse);
            expect(result).toBe(true);

            // Wait for the promise to resolve
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(repositoryInstance.clearAll).toHaveBeenCalled();
            expect(sendResponse).toHaveBeenCalledWith({});
        });
    });
});
