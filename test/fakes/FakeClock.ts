import { Clock } from "../../src/domain/ports/Clock";

export class FakeClock implements Clock {
  constructor(private nowValue = 0) {}

  now(): number {
    return this.nowValue;
  }

  advance(ms: number): void {
    this.nowValue += ms;
  }

  set(epochMs: number): void {
    this.nowValue = epochMs;
  }
}
