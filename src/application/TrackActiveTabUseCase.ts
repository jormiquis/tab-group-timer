import { ActiveTabInfo } from "src/domain/ActiveTabInfo";
import { Clock } from "../domain/ports/Clock";
import { TimeRepository } from "../domain/ports/TimeRepository";
import { ActiveSession } from "../domain/Session";

export class TrackActiveTabUseCase {
  private session: ActiveSession | null = null;

  constructor(private repo: TimeRepository, private clock: Clock) {}

  async onActiveTabChanged(info: ActiveTabInfo) {
    const now = this.clock.now();

    if (this.session) {
      const prev = this.session;
      const changedGroup = prev.groupId !== info.groupId;
      if (changedGroup) {
        await this.flush(now);
      }
    }

    this.session = {
      groupId: info.groupId,
      groupTitle: info.groupTitle,
      startedAt: now,
    };
  }

  async onFocusLost() {
    const now = this.clock.now();
    await this.flush(now);
    this.session = null;
  }

  async onGroupTitleChanged(groupId: number, newTitle: string) {
    if (this.session && this.session.groupId === groupId) {
      this.session.groupTitle = newTitle;
    }
    await this.repo.updateGroupTitle(groupId, newTitle);
  }

  private async flush(endTime: number) {
    if (!this.session) return;
    const duration = Math.max(0, endTime - this.session.startedAt);
    if (duration < 500) {
      this.session = null;
      return;
    }
    await this.repo.save({
      groupId: this.session.groupId ?? -1,
      groupTitle: this.session.groupTitle,
      startedAt: this.session.startedAt,
      endedAt: endTime,
      durationMs: duration,
    });
  }
}