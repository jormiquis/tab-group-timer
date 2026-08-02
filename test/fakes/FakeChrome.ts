import { vi } from "vitest";

type Listener = (...args: any[]) => any;

interface FakeTab {
  id: number;
  active: boolean;
  groupId: number;
}

interface FakeGroup {
  id: number;
  title?: string;
}

const TAB_GROUP_ID_NONE = -1;

function createEvent(bag: Map<string, Listener[]>, name: string) {
  bag.set(name, []);
  return {
    addListener: (fn: Listener) => bag.get(name)!.push(fn),
  };
}

function createStorageArea(store: Map<string, unknown>) {
  return {
    async get(keys: string | string[]) {
      const wanted = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const key of wanted) {
        if (store.has(key)) out[key] = structuredClone(store.get(key));
      }
      return out;
    },
    async set(items: Record<string, unknown>) {
      for (const [key, value] of Object.entries(items)) {
        store.set(key, structuredClone(value));
      }
    },
    async remove(key: string) {
      store.delete(key);
    },
  };
}

/**
 * Enough of the Chrome extension API to drive background.ts end to end: real
 * storage semantics (values are cloned in and out) and manually fired events.
 */
export function createFakeChrome() {
  const listeners = new Map<string, Listener[]>();
  const local = new Map<string, unknown>();
  const session = new Map<string, unknown>();
  const alarms = new Map<string, { periodInMinutes?: number }>();

  let tabs: FakeTab[] = [{ id: 1, active: true, groupId: TAB_GROUP_ID_NONE }];
  let groups: FakeGroup[] = [];

  const chrome = {
    tabs: {
      onActivated: createEvent(listeners, "tabs.onActivated"),
      onUpdated: createEvent(listeners, "tabs.onUpdated"),
      query: vi.fn(async () => tabs.filter((t) => t.active)),
    },
    tabGroups: {
      onUpdated: createEvent(listeners, "tabGroups.onUpdated"),
      onRemoved: createEvent(listeners, "tabGroups.onRemoved"),
      query: vi.fn(async () => groups),
      get: vi.fn(async (id: number) => {
        const group = groups.find((g) => g.id === id);
        if (!group) throw new Error(`no group ${id}`);
        return group;
      }),
    },
    windows: {
      onFocusChanged: createEvent(listeners, "windows.onFocusChanged"),
      WINDOW_ID_NONE: -1,
    },
    idle: {
      onStateChanged: createEvent(listeners, "idle.onStateChanged"),
    },
    alarms: {
      onAlarm: createEvent(listeners, "alarms.onAlarm"),
      get: vi.fn(async (name: string) => alarms.get(name)),
      create: vi.fn(async (name: string, info: { periodInMinutes?: number }) => {
        alarms.set(name, info);
      }),
    },
    runtime: {
      onInstalled: createEvent(listeners, "runtime.onInstalled"),
      onStartup: createEvent(listeners, "runtime.onStartup"),
      onMessage: createEvent(listeners, "runtime.onMessage"),
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
    storage: {
      local: createStorageArea(local),
      session: createStorageArea(session),
    },
  };

  return {
    chrome,
    alarms,
    local,
    session,

    /** Fires an event and waits for every listener to settle. */
    async emit(name: string, ...args: unknown[]): Promise<void> {
      for (const listener of listeners.get(name) ?? []) {
        await listener(...args);
      }
    },

    /** Simulates a worker teardown: the old module's listeners are gone. */
    clearListeners(): void {
      for (const key of listeners.keys()) listeners.set(key, []);
    },

    /** Sends a message through the background listener and resolves its reply. */
    sendMessage<T>(message: unknown): Promise<T> {
      const listener = listeners.get("runtime.onMessage")![0];
      return new Promise<T>((resolve) => {
        listener(message, {}, resolve);
      });
    },

    setActiveGroup(group: FakeGroup | null): void {
      if (group === null) {
        tabs = [{ id: 1, active: true, groupId: TAB_GROUP_ID_NONE }];
        return;
      }
      if (!groups.some((g) => g.id === group.id)) groups.push(group);
      const existing = groups.find((g) => g.id === group.id)!;
      existing.title = group.title;
      tabs = [{ id: 1, active: true, groupId: group.id }];
    },

    setNoActiveTab(): void {
      tabs = [];
    },

    renameGroup(id: number, title: string): FakeGroup {
      const group = groups.find((g) => g.id === id)!;
      group.title = title;
      return group;
    },

    setGroups(next: FakeGroup[]): void {
      groups = next;
    },
  };
}
