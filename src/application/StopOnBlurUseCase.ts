import { TrackActiveTabUseCase } from "./TrackActiveTabUseCase";

export class StopOnBlurUseCase {
  constructor(private tracker: TrackActiveTabUseCase) {}

  async handleWindowFocusChanged(windowId: number, noWindowIdValue: number) {
    if (windowId === noWindowIdValue) {
      await this.tracker.onFocusLost();
    }
  }
}