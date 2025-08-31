import { TrackActiveTabUseCase } from "./TrackActiveTabUseCase";

export class StopOnBlurUseCase {
  constructor(private tracker: TrackActiveTabUseCase) {}
  async handleWindowFocusChanged(windowId: number) {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      await this.tracker.onFocusLost();
    }
  }
}