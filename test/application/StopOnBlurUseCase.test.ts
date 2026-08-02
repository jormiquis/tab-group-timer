import { describe, expect, it, vi } from "vitest";
import { StopOnBlurUseCase } from "../../src/application/StopOnBlurUseCase";
import { TrackActiveTabUseCase } from "../../src/application/TrackActiveTabUseCase";

function trackerSpy() {
  return { onFocusLost: vi.fn(), onActiveTabChanged: vi.fn() } as unknown as TrackActiveTabUseCase;
}

describe("StopOnBlurUseCase", () => {
  it("stops tracking when no window holds focus", async () => {
    const tracker = trackerSpy();

    await new StopOnBlurUseCase(tracker).handleWindowFocusChanged(-1, -1);

    expect(tracker.onFocusLost).toHaveBeenCalled();
  });

  it("leaves the session alone when focus moves between windows", async () => {
    const tracker = trackerSpy();

    await new StopOnBlurUseCase(tracker).handleWindowFocusChanged(2, -1);

    expect(tracker.onFocusLost).not.toHaveBeenCalled();
  });
});
