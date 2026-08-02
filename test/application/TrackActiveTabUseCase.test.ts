import { describe, expect, it } from "vitest";
import { TrackActiveTabUseCase } from "../../src/application/TrackActiveTabUseCase";
import { groupIdentityOf } from "../../src/domain/GroupIdentity";
import { localDate } from "../../src/domain/LocalDate";
import { FakeClock } from "../fakes/FakeClock";
import { FakeSessionStore } from "../fakes/FakeSessionStore";
import { FakeTimeRepository } from "../fakes/FakeTimeRepository";

const MINUTE = 60_000;
/** 2025-03-10T09:00:00 local time. */
const START = new Date(2025, 2, 10, 9, 0, 0).getTime();

function setup(startAt = START) {
  const repo = new FakeTimeRepository();
  const clock = new FakeClock(startAt);
  const sessions = new FakeSessionStore();
  const tracker = new TrackActiveTabUseCase(repo, clock, sessions);
  return { repo, clock, sessions, tracker };
}

const group = (title: string) => groupIdentityOf(1, title);

async function totalFor(repo: FakeTimeRepository, title: string): Promise<number> {
  const entries = await repo.listAll();
  return entries
    .filter((e) => e.groupKey === group(title).groupKey)
    .reduce((sum, e) => sum + e.durationMs, 0);
}

describe("TrackActiveTabUseCase", () => {
  it("records the elapsed interval when the group changes", async () => {
    const { repo, clock, tracker } = setup();

    await tracker.onActiveTabChanged(group("work"));
    clock.advance(5 * MINUTE);
    await tracker.onActiveTabChanged(group("email"));

    expect(await totalFor(repo, "work")).toBe(5 * MINUTE);
  });

  it("keeps accruing when the active tab changes inside the same group", async () => {
    const { repo, clock, tracker } = setup();

    await tracker.onActiveTabChanged(group("work"));
    clock.advance(3 * MINUTE);
    // Switching to a sibling tab of the same group used to reset the timer.
    await tracker.onActiveTabChanged(group("work"));
    clock.advance(2 * MINUTE);
    await tracker.onFocusLost();

    expect(await totalFor(repo, "work")).toBe(5 * MINUTE);
  });

  it("survives a service worker restart mid-session", async () => {
    const { repo, clock, sessions } = setup();
    const first = new TrackActiveTabUseCase(repo, clock, sessions);

    await first.onActiveTabChanged(group("deep work"));
    clock.advance(45 * MINUTE);

    // The worker is torn down and a later event boots a fresh instance.
    const revived = new TrackActiveTabUseCase(repo, clock, sessions);
    await revived.onActiveTabChanged(group("email"));

    expect(await totalFor(repo, "deep work")).toBe(45 * MINUTE);
  });

  it("checkpoints without losing or double counting time", async () => {
    const { repo, clock, tracker } = setup();

    await tracker.onActiveTabChanged(group("work"));
    clock.advance(MINUTE);
    await tracker.checkpoint();
    clock.advance(MINUTE);
    await tracker.checkpoint();
    clock.advance(30_000);
    await tracker.onFocusLost();

    expect(await totalFor(repo, "work")).toBe(2 * MINUTE + 30_000);
  });

  it("ignores intervals below the noise threshold", async () => {
    const { repo, clock, tracker } = setup();

    await tracker.onActiveTabChanged(group("passing through"));
    clock.advance(200);
    await tracker.onFocusLost();

    expect(await repo.listAll()).toHaveLength(0);
  });

  it("credits each calendar day when a session crosses midnight", async () => {
    const beforeMidnight = new Date(2025, 2, 10, 23, 30, 0).getTime();
    const { repo, clock, tracker } = setup(beforeMidnight);

    await tracker.onActiveTabChanged(group("night shift"));
    clock.advance(60 * MINUTE); // 00:30 the next day
    await tracker.onFocusLost();

    const entries = await repo.listAll();
    const byDate = Object.fromEntries(entries.map((e) => [e.date, e.durationMs]));

    expect(byDate[localDate(beforeMidnight)]).toBe(30 * MINUTE);
    expect(byDate["2025-03-11"]).toBe(30 * MINUTE);
  });

  it("moves the running session onto a renamed group", async () => {
    const { clock, sessions, tracker } = setup();

    await tracker.onActiveTabChanged(group("old name"));
    clock.advance(MINUTE);
    await tracker.onGroupRenamed(group("old name").groupKey, group("new name"));

    const session = await sessions.get();
    expect(session).toMatchObject({
      groupKey: group("new name").groupKey,
      groupTitle: "new name",
      startedAt: START, // the interval keeps running, it is not restarted
    });
  });

  it("drops accrued time but keeps tracking when the interval is restarted", async () => {
    const { repo, clock, sessions, tracker } = setup();

    await tracker.onActiveTabChanged(group("work"));
    clock.advance(10 * MINUTE);
    await tracker.restartCurrentInterval();

    expect(await repo.listAll()).toHaveLength(0);
    expect(await sessions.get()).toMatchObject({ startedAt: START + 10 * MINUTE });
  });

  it("stops accruing once focus is lost", async () => {
    const { repo, clock, tracker } = setup();

    await tracker.onActiveTabChanged(group("work"));
    clock.advance(MINUTE);
    await tracker.onFocusLost();
    clock.advance(60 * MINUTE);
    await tracker.checkpoint();

    expect(await totalFor(repo, "work")).toBe(MINUTE);
  });
});
