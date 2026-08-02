import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { groupKeyFromTitle } from "../src/domain/GroupIdentity";
import { Snapshot } from "../src/shared/messages";
import { createFakeChrome } from "./fakes/FakeChrome";

const MINUTE = 60_000;
const START = new Date(2025, 2, 10, 9, 0, 0).getTime();

/**
 * Drives the real background wiring against a fake Chrome, so these cover the
 * event plumbing and the storage adapters together.
 */
describe("background", () => {
  let fake: ReturnType<typeof createFakeChrome>;

  async function boot() {
    vi.resetModules();
    fake.clearListeners();
    vi.stubGlobal("chrome", fake.chrome);
    const worker = await import("../src/background");
    await worker.ready;
  }

  function snapshot(): Promise<Snapshot> {
    return fake.sendMessage<Snapshot>({ type: "GET_SNAPSHOT" });
  }

  async function totalFor(title: string): Promise<number> {
    const { entries } = await snapshot();
    return entries
      .filter((e) => e.groupKey === groupKeyFromTitle(title))
      .reduce((sum, e) => sum + e.durationMs, 0);
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    fake = createFakeChrome();
    await boot();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("registers the heartbeat alarm so the worker cannot silently die", async () => {
    expect(fake.alarms.get("tab-group-timer:heartbeat")).toEqual({ periodInMinutes: 1 });
  });

  it("tracks time across a group switch", async () => {
    fake.setActiveGroup({ id: 1, title: "work" });
    await fake.emit("tabs.onActivated");

    vi.setSystemTime(START + 10 * MINUTE);
    fake.setActiveGroup({ id: 2, title: "email" });
    await fake.emit("tabs.onActivated");

    expect(await totalFor("work")).toBe(10 * MINUTE);
  });

  it("keeps the session across a worker teardown", async () => {
    fake.setActiveGroup({ id: 1, title: "deep work" });
    await fake.emit("tabs.onActivated");

    // Chrome kills the idle worker; a later event boots a fresh one.
    vi.setSystemTime(START + 40 * MINUTE);
    await boot();
    await fake.emit("alarms.onAlarm", { name: "tab-group-timer:heartbeat" });

    expect(await totalFor("deep work")).toBe(40 * MINUTE);
  });

  it("checkpoints the running interval on every heartbeat", async () => {
    fake.setActiveGroup({ id: 1, title: "work" });
    await fake.emit("tabs.onActivated");

    vi.setSystemTime(START + MINUTE);
    await fake.emit("alarms.onAlarm", { name: "tab-group-timer:heartbeat" });

    expect(await totalFor("work")).toBe(MINUTE);
  });

  it("ignores alarms it did not schedule", async () => {
    fake.setActiveGroup({ id: 1, title: "work" });
    await fake.emit("tabs.onActivated");

    vi.setSystemTime(START + MINUTE);
    await fake.emit("alarms.onAlarm", { name: "someone-elses-alarm" });

    expect(await totalFor("work")).toBe(0);
  });

  it("pauses while the machine is idle", async () => {
    fake.setActiveGroup({ id: 1, title: "work" });
    await fake.emit("tabs.onActivated");

    vi.setSystemTime(START + 5 * MINUTE);
    await fake.emit("idle.onStateChanged", "idle");

    vi.setSystemTime(START + 60 * MINUTE);
    await fake.emit("alarms.onAlarm", { name: "tab-group-timer:heartbeat" });

    expect(await totalFor("work")).toBe(5 * MINUTE);
  });

  it("pauses when Chrome loses window focus and resumes when it returns", async () => {
    fake.setActiveGroup({ id: 1, title: "work" });
    await fake.emit("tabs.onActivated");

    vi.setSystemTime(START + 2 * MINUTE);
    await fake.emit("windows.onFocusChanged", -1);

    vi.setSystemTime(START + 30 * MINUTE);
    await fake.emit("windows.onFocusChanged", 1);

    vi.setSystemTime(START + 33 * MINUTE);
    await fake.emit("idle.onStateChanged", "locked");

    expect(await totalFor("work")).toBe(5 * MINUTE);
  });

  it("moves recorded time onto the new name when a group is renamed", async () => {
    fake.setActiveGroup({ id: 1, title: "old name" });
    await fake.emit("tabs.onActivated");

    vi.setSystemTime(START + 5 * MINUTE);
    await fake.emit("tabGroups.onUpdated", fake.renameGroup(1, "new name"));

    vi.setSystemTime(START + 8 * MINUTE);
    await fake.emit("idle.onStateChanged", "idle");

    expect(await totalFor("old name")).toBe(0);
    expect(await totalFor("new name")).toBe(8 * MINUTE);
  });

  it("keeps a group's history after the group is closed", async () => {
    fake.setActiveGroup({ id: 1, title: "finished task" });
    await fake.emit("tabs.onActivated");

    vi.setSystemTime(START + 25 * MINUTE);
    await fake.emit("idle.onStateChanged", "idle");
    await fake.emit("tabGroups.onRemoved", { id: 1 });

    expect(await totalFor("finished task")).toBe(25 * MINUTE);
  });

  it("reports the running interval so the popup can show live time", async () => {
    fake.setActiveGroup({ id: 1, title: "work" });
    await fake.emit("tabs.onActivated");
    vi.setSystemTime(START + 42_000);

    const { active, now } = await snapshot();

    expect(active).toMatchObject({ groupKey: groupKeyFromTitle("work"), startedAt: START });
    expect(now).toBe(START + 42_000);
  });

  it("erases everything on reset without stopping the tracker", async () => {
    fake.setActiveGroup({ id: 1, title: "work" });
    await fake.emit("tabs.onActivated");
    vi.setSystemTime(START + 10 * MINUTE);

    const after = await fake.sendMessage<Snapshot>({ type: "CLEAR_ALL" });

    expect(after.entries).toEqual([]);
    // Still tracking, but the erased interval does not come back.
    expect(after.active).toMatchObject({ startedAt: START + 10 * MINUTE });
  });

  it("deletes a single group on request", async () => {
    fake.setActiveGroup({ id: 1, title: "work" });
    await fake.emit("tabs.onActivated");
    vi.setSystemTime(START + 5 * MINUTE);
    fake.setActiveGroup({ id: 2, title: "email" });
    await fake.emit("tabs.onActivated");
    vi.setSystemTime(START + 8 * MINUTE);
    await fake.emit("idle.onStateChanged", "idle");

    await fake.sendMessage({ type: "DELETE_GROUP", groupKey: groupKeyFromTitle("work") });

    expect(await totalFor("work")).toBe(0);
    expect(await totalFor("email")).toBe(3 * MINUTE);
  });

  it("stops tracking when there is no active tab", async () => {
    fake.setActiveGroup({ id: 1, title: "work" });
    await fake.emit("tabs.onActivated");

    vi.setSystemTime(START + 3 * MINUTE);
    fake.setNoActiveTab();
    await fake.emit("tabs.onActivated");

    expect((await snapshot()).active).toBeNull();
    expect(await totalFor("work")).toBe(3 * MINUTE);
  });

  it("only reacts to tab updates that change the active tab's group", async () => {
    fake.setActiveGroup({ id: 1, title: "work" });
    await fake.emit("tabs.onActivated");
    vi.setSystemTime(START + MINUTE);

    await fake.emit("tabs.onUpdated", 1, { status: "complete" }, { active: true });
    await fake.emit("tabs.onUpdated", 2, { groupId: 3 }, { active: false });

    expect(fake.chrome.tabs.query).toHaveBeenCalledTimes(1);
  });
});
