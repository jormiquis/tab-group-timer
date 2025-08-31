import { Clock } from "../domain/ports/Clock";

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}