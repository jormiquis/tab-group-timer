import { describe, it, expect, beforeEach } from "vitest";
import { TrackActiveTabUseCase } from "../../src/application/TrackActiveTabUseCase";
import { InMemoryTimeRepository } from "../../src/tests/mocks/InMemoryTimeRepository";
import { TestClock } from "../../src/tests/mocks/TestClock";
import { ActiveTabInfo } from "../../src/domain/ActiveTabInfo";

describe("TrackActiveTabUseCase Integration Test", () => {
  let trackActiveTabUseCase: TrackActiveTabUseCase;
  let timeRepository: InMemoryTimeRepository;
  let clock: TestClock;

  beforeEach(() => {
    timeRepository = new InMemoryTimeRepository();
    clock = new TestClock();
    trackActiveTabUseCase = new TrackActiveTabUseCase(timeRepository, clock);
  });

  it("should start a session when a tab becomes active", async () => {
    const activeTabInfo: ActiveTabInfo = {
      groupId: 1,
      groupTitle: "Test Group",
    };

    await trackActiveTabUseCase.onActiveTabChanged(activeTabInfo);

    // Nothing should be saved yet
    expect(timeRepository.getEntries()).toHaveLength(0);
  });

  it("should save a time entry when the tab group changes", async () => {
    const initialTab: ActiveTabInfo = {
      groupId: 1,
      groupTitle: "Group 1",
    };
    await trackActiveTabUseCase.onActiveTabChanged(initialTab);
    const initialTime = clock.now();

    clock.advance(1000 * 60 * 5); // 5 minutes later

    const newTab: ActiveTabInfo = {
      groupId: 2, // Different group
      groupTitle: "Group 2",
    };
    await trackActiveTabUseCase.onActiveTabChanged(newTab);

    const entries = timeRepository.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].groupId).toBe(1);
    expect(entries[0].groupTitle).toBe("Group 1");
    expect(entries[0].startedAt).toBe(initialTime);
    expect(entries[0].endedAt).toBe(clock.now());
    expect(entries[0].durationMs).toBe(1000 * 60 * 5);
  });

  it("should save a time entry when focus is lost", async () => {
    const activeTabInfo: ActiveTabInfo = {
      groupId: 1,
      groupTitle: "Test Group",
    };
    await trackActiveTabUseCase.onActiveTabChanged(activeTabInfo);
    const initialTime = clock.now();

    clock.advance(1000 * 60 * 10); // 10 minutes later

    await trackActiveTabUseCase.onFocusLost();

    const entries = timeRepository.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].groupId).toBe(1);
    expect(entries[0].groupTitle).toBe("Test Group");
    expect(entries[0].startedAt).toBe(initialTime);
    expect(entries[0].endedAt).toBe(clock.now());
    expect(entries[0].durationMs).toBe(1000 * 60 * 10);
  });

  it("should not save a time entry for short durations", async () => {
    const activeTabInfo: ActiveTabInfo = {
      groupId: 1,
      groupTitle: "Test Group"
    };
    await trackActiveTabUseCase.onActiveTabChanged(activeTabInfo);

    clock.advance(499); // Less than 500ms

    await trackActiveTabUseCase.onFocusLost();

    const entries = timeRepository.getEntries();
    expect(entries).toHaveLength(0);
  });
});
