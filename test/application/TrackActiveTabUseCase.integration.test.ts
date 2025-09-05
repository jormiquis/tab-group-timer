// test/application/TrackActiveTabUseCase.unit.test.ts
import { describe, it, expect } from "vitest";
import { TrackActiveTabUseCase } from "../../src/application/TrackActiveTabUseCase";
import { FakeTimeRepository } from "../fakes/FakeTimeRepository";
import { FakeClock } from "../fakes/FakeClock";

describe("TrackActiveTabUseCase", () => {
  it("stores a session when tab changes", async () => {
    const repo = new FakeTimeRepository();
    const clock = new FakeClock();
    const useCase = new TrackActiveTabUseCase(repo, clock);

    clock.advance(1000);
    await useCase.onActiveTabChanged({ groupId: 1, groupTitle: "work" });

    clock.advance(5000);
    await useCase.onFocusLost();

    const entries = await repo.listAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      groupId: 1,
      groupTitle: "work"
    });
  });

  it("updates and existent group title", async () => {
    const repo = new FakeTimeRepository();
    const clock = new FakeClock();
    const useCase = new TrackActiveTabUseCase(repo, clock);

    await useCase.onActiveTabChanged({ groupId: 1, groupTitle: "old title" });
    clock.advance(2000);
    await useCase.onFocusLost();

    await useCase.onGroupTitleChanged(1, "new title");

    const entries = await repo.listAll();
    expect(entries[0].groupTitle).toBe("new title");
  });
});
