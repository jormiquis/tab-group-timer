import { describe, expect, it } from "vitest";
import { groupKeyFromTitle } from "../../src/domain/GroupIdentity";
import { TimeEntry } from "../../src/domain/TimeEntry";
import {
  formatCompact,
  formatDuration,
  summarize,
  toCsv,
} from "../../src/popup/summary";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOW = new Date(2025, 2, 10, 15, 0, 0).getTime();

function entry(title: string, date: string, durationMs: number): TimeEntry {
  return {
    groupKey: groupKeyFromTitle(title),
    groupTitle: title,
    date,
    startedAt: NOW - durationMs,
    endedAt: NOW,
    durationMs,
  };
}

describe("summarize", () => {
  const entries = [
    entry("work", "2025-03-10", HOUR),
    entry("email", "2025-03-10", 30 * MINUTE),
    entry("work", "2025-03-07", 2 * HOUR),
    entry("archive", "2024-12-01", 5 * HOUR),
  ];

  it("shows only today's buckets in the today range", () => {
    const { rows, totalMs } = summarize(entries, null, NOW, "today");

    expect(rows.map((r) => r.groupTitle)).toEqual(["work", "email"]);
    expect(totalMs).toBe(HOUR + 30 * MINUTE);
  });

  it("covers the trailing seven days in the week range", () => {
    const { rows } = summarize(entries, null, NOW, "week");
    const work = rows.find((r) => r.groupTitle === "work")!;

    expect(work.durationMs).toBe(3 * HOUR);
    expect(rows.some((r) => r.groupTitle === "archive")).toBe(false);
  });

  it("sorts longest first and rounds percentages against the range total", () => {
    const { rows } = summarize(entries, null, NOW, "today");

    expect(rows[0]).toMatchObject({ groupTitle: "work", percent: 67 });
    expect(rows[1]).toMatchObject({ groupTitle: "email", percent: 33 });
  });

  it("adds the running interval so the tracked group counts up live", () => {
    const active = {
      groupKey: groupKeyFromTitle("work"),
      groupTitle: "work",
      startedAt: NOW - 90_000,
    };

    const { rows } = summarize(entries, active, NOW, "today");
    const work = rows.find((r) => r.groupTitle === "work")!;

    expect(work.durationMs).toBe(HOUR + 90_000);
    expect(work.isActive).toBe(true);
  });

  it("surfaces a group that is only being tracked right now", () => {
    const active = {
      groupKey: groupKeyFromTitle("brand new"),
      groupTitle: "brand new",
      startedAt: NOW - 10_000,
    };

    const { rows } = summarize([], active, NOW, "today");

    expect(rows).toEqual([
      expect.objectContaining({ groupTitle: "brand new", durationMs: 10_000, percent: 100 }),
    ]);
  });

  it("returns nothing when the range holds no data", () => {
    expect(summarize([], null, NOW, "today")).toEqual({ rows: [], totalMs: 0 });
  });
});

describe("formatting", () => {
  it("renders durations as zero-padded hh:mm:ss", () => {
    expect(formatDuration(0)).toBe("00:00:00");
    expect(formatDuration(HOUR + 2 * MINUTE + 3000)).toBe("01:02:03");
    expect(formatDuration(100 * HOUR)).toBe("100:00:00");
  });

  it("renders range totals compactly", () => {
    expect(formatCompact(45 * MINUTE)).toBe("45m");
    expect(formatCompact(4 * HOUR + 12 * MINUTE)).toBe("4h 12m");
  });
});

describe("toCsv", () => {
  it("writes a header and one row per bucket, oldest first", () => {
    const csv = toCsv([entry("b", "2025-03-10", MINUTE), entry("a", "2025-03-09", 2 * MINUTE)]);

    expect(csv.split("\n")).toEqual([
      "date,group,duration,duration_seconds",
      '2025-03-09,"a",00:02:00,120',
      '2025-03-10,"b",00:01:00,60',
    ]);
  });

  it("escapes quotes and commas in group titles", () => {
    const csv = toCsv([entry('Client "A", east', "2025-03-10", MINUTE)]);

    expect(csv).toContain('"Client ""A"", east"');
  });
});
