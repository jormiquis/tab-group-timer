// test/fakes/FakeClock.ts
import { Clock } from "../../src/domain/ports/Clock";

export class FakeClock implements Clock {
  private nowValue = 0;

  now(): number {
    return this.nowValue;
  }

  advance(ms: number) {
    this.nowValue += ms;
  }
}
