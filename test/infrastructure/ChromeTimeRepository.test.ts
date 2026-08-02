import { beforeEach, describe, expect, it, vi } from "vitest";
import { UNTITLED_GROUP_KEY, groupKeyFromTitle } from "../../src/domain/GroupIdentity";
import { localDate } from "../../src/domain/LocalDate";
import { TimeEntry } from "../../src/domain/TimeEntry";
import { ChromeTimeRepository } from "../../src/infrastructure/ChromeTimeRepository";
import { createFakeChrome } from "../fakes/FakeChrome";

const MINUTE = 60_000;
const START = new Date(2025, 2, 10, 9, 0, 0).getTime();

function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    groupKey: groupKeyFromTitle("work"),
    groupTitle: "work",
    date: "2025-03-10",
    startedAt: START,
    endedAt: START + MINUTE,
    durationMs: MINUTE,
    ...overrides,
  };
}

describe("ChromeTimeRepository", () => {
  let fake: ReturnType<typeof createFakeChrome>;
  let repo: ChromeTimeRepository;

  beforeEach(() => {
    fake = createFakeChrome();
    vi.stubGlobal("chrome", fake.chrome);
    repo = new ChromeTimeRepository();
  });

  it("folds repeated intervals into one bucket per day and group", async () => {
    await repo.save(entry());
    await repo.save(entry({ startedAt: START + MINUTE, endedAt: START + 3 * MINUTE, durationMs: 2 * MINUTE }));

    const entries = await repo.listAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      durationMs: 3 * MINUTE,
      startedAt: START,
      endedAt: START + 3 * MINUTE,
    });
  });

  it("keeps the same group on different days apart", async () => {
    await repo.save(entry({ date: "2025-03-10" }));
    await repo.save(entry({ date: "2025-03-11" }));

    expect(await repo.listAll()).toHaveLength(2);
  });

  it("does not lose concurrent writes", async () => {
    // Read-modify-write over a single storage key: unserialised, these clobber.
    await Promise.all(Array.from({ length: 20 }, () => repo.save(entry())));

    const [stored] = await repo.listAll();
    expect(stored.durationMs).toBe(20 * MINUTE);
  });

  it("merges history onto the new key when a group is renamed", async () => {
    await repo.save(entry({ groupKey: groupKeyFromTitle("old"), groupTitle: "old" }));
    await repo.save(entry({ groupKey: groupKeyFromTitle("new"), groupTitle: "new" }));

    await repo.renameGroup(groupKeyFromTitle("old"), groupKeyFromTitle("new"), "new");

    const entries = await repo.listAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ groupTitle: "new", durationMs: 2 * MINUTE });
  });

  it("refreshes the display title when a rename keeps the same key", async () => {
    await repo.save(entry({ groupTitle: "work" }));

    await repo.renameGroup(groupKeyFromTitle("work"), groupKeyFromTitle("Work"), "Work");

    expect((await repo.listAll())[0].groupTitle).toBe("Work");
  });

  it("deletes only the requested group", async () => {
    await repo.save(entry());
    await repo.save(entry({ groupKey: groupKeyFromTitle("email"), groupTitle: "email" }));

    await repo.deleteByGroupKey(groupKeyFromTitle("work"));

    const entries = await repo.listAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].groupTitle).toBe("email");
  });

  it("migrates v1 records into day buckets, recovering identity from the title", async () => {
    await fake.chrome.storage.local.set({
      timeEntries: [
        { groupId: 5, groupTitle: "work", startedAt: START, endedAt: START + MINUTE, durationMs: MINUTE },
        { groupId: 9, groupTitle: "work", startedAt: START + MINUTE, endedAt: START + 2 * MINUTE, durationMs: MINUTE },
        { groupId: 2, groupTitle: "Grupo 2", startedAt: START, endedAt: START + MINUTE, durationMs: MINUTE },
      ],
    });

    const entries = await repo.listAll();
    const work = entries.find((e) => e.groupKey === groupKeyFromTitle("work"));

    // Same title under two recycled ids is one task, not two.
    expect(work).toMatchObject({ durationMs: 2 * MINUTE, date: localDate(START) });
    expect(entries.some((e) => e.groupKey === UNTITLED_GROUP_KEY)).toBe(true);
  });

  it("clears everything on reset", async () => {
    await repo.save(entry());
    await repo.clearAll();
    expect(await repo.listAll()).toHaveLength(0);
  });
});
