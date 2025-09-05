// test/application/StopOnBlurUseCase.unit.test.ts
import { describe, it, expect, vi } from "vitest";
import { StopOnBlurUseCase } from "../../src/application/StopOnBlurUseCase";

describe("StopOnBlurUseCase", () => {
  it("calls onFocusLost when focus is lost", async () => {
    const tracker = { onFocusLost: vi.fn(), onActiveTabChanged: vi.fn() };
    const useCase = new StopOnBlurUseCase(tracker as any);

    await useCase.handleWindowFocusChanged(-1, -1);

    expect(tracker.onFocusLost).toHaveBeenCalled();
    expect(tracker.onActiveTabChanged).not.toHaveBeenCalled();
  });

  it("calls onActiveTabChanged when retakes focus", async () => {
    const tracker = { onFocusLost: vi.fn(), onActiveTabChanged: vi.fn() };
    const useCase = new StopOnBlurUseCase(tracker as any);

    const activeTabInfo = { groupId: 1, groupTitle: "Test" };
    await useCase.handleWindowFocusChanged(1, -1);
    await tracker.onActiveTabChanged(activeTabInfo);

    expect(tracker.onActiveTabChanged).toHaveBeenCalledWith(activeTabInfo);
  });
});
