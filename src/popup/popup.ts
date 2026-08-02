import { localDate } from "../domain/LocalDate";
import { Request, Snapshot, TIME_UPDATED } from "../shared/messages";
import {
  GroupSummary,
  Range,
  formatCompact,
  formatDuration,
  isWithinRange,
  summarize,
  toCsv,
} from "./summary";

const RANGE_LABELS: Record<Range, string> = {
  today: "today",
  week: "in the last 7 days",
  all: "all time",
};

const el = {
  ranges: document.getElementById("ranges")!,
  total: document.getElementById("total")!,
  summary: document.getElementById("summary")!,
  confirm: document.getElementById("confirm") as HTMLDivElement,
  confirmCancel: document.getElementById("confirm-cancel")!,
  confirmErase: document.getElementById("confirm-erase")!,
  reset: document.getElementById("reset")!,
  exportCsv: document.getElementById("export-csv")!,
  exportJson: document.getElementById("export-json")!,
};

let range: Range = "today";
let snapshot: Snapshot = { entries: [], active: null, now: Date.now() };
/** Difference between the background clock and ours, so live time stays honest. */
let clockSkew = 0;

function send(request: Request): Promise<Snapshot> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(request, (response?: Snapshot) => {
      // A missing response means the worker was mid-restart; keep what we have.
      resolve(response ?? snapshot);
    });
  });
}

function now(): number {
  return Date.now() + clockSkew;
}

async function load(request: Request = { type: "GET_SNAPSHOT" }): Promise<void> {
  const response = await send(request);
  clockSkew = response.now - Date.now();
  snapshot = response;
  render();
}

function render(): void {
  const { rows, totalMs } = summarize(snapshot.entries, snapshot.active, now(), range);

  for (const button of el.ranges.querySelectorAll<HTMLButtonElement>(".range")) {
    button.setAttribute("aria-selected", String(button.dataset.range === range));
  }

  el.total.replaceChildren(
    strong(formatCompact(totalMs)),
    document.createTextNode(` tracked ${RANGE_LABELS[range]}`),
  );

  el.summary.replaceChildren(
    ...(rows.length === 0 ? [emptyState()] : rows.map(renderRow)),
  );
}

function emptyState(): HTMLElement {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent =
    range === "all"
      ? "No time tracked yet. Open a tab group and start working."
      : `Nothing tracked ${RANGE_LABELS[range]}.`;
  return p;
}

function renderRow(row: GroupSummary): HTMLElement {
  const container = document.createElement("div");
  container.className = "entry-row";

  const head = document.createElement("div");
  head.className = "entry-head";

  if (row.isActive) {
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.title = "Currently tracking";
    head.appendChild(dot);
  }

  const title = document.createElement("span");
  title.className = "entry-title";
  title.textContent = row.groupTitle;
  title.title = row.groupTitle;

  const time = document.createElement("span");
  time.className = "entry-time";
  time.textContent = formatDuration(row.durationMs);

  const percent = document.createElement("span");
  percent.className = "entry-percent";
  percent.textContent = `${row.percent}%`;

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "entry-delete";
  remove.textContent = "×";
  remove.title = `Delete "${row.groupTitle}"`;
  remove.setAttribute("aria-label", `Delete ${row.groupTitle}`);
  remove.addEventListener("click", () => {
    void load({ type: "DELETE_GROUP", groupKey: row.groupKey });
  });

  head.append(title, time, percent, remove);

  const barOuter = document.createElement("div");
  barOuter.className = "bar-outer";
  const barInner = document.createElement("div");
  barInner.className = "bar-inner";
  barInner.style.width = `${row.percent}%`;
  barOuter.appendChild(barInner);

  container.append(head, barOuter);
  return container;
}

function strong(text: string): HTMLElement {
  const node = document.createElement("strong");
  node.textContent = text;
  return node;
}

function download(filename: string, mime: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoked on a delay so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Exports what the current range shows, not the whole history. */
function entriesInRange() {
  return snapshot.entries.filter((entry) => isWithinRange(entry.date, range, now()));
}

// --- Events ---

el.ranges.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".range");
  if (!button?.dataset.range) return;
  range = button.dataset.range as Range;
  render();
});

el.reset.addEventListener("click", () => {
  el.confirm.hidden = false;
  (el.confirmCancel as HTMLButtonElement).focus();
});

el.confirmCancel.addEventListener("click", () => {
  el.confirm.hidden = true;
});

el.confirmErase.addEventListener("click", async () => {
  el.confirm.hidden = true;
  await load({ type: "CLEAR_ALL" });
});

el.exportCsv.addEventListener("click", () => {
  download(`tab-group-timer-${localDate(now())}.csv`, "text/csv", toCsv(entriesInRange()));
});

el.exportJson.addEventListener("click", () => {
  download(
    `tab-group-timer-${localDate(now())}.json`,
    "application/json",
    JSON.stringify(entriesInRange(), null, 2),
  );
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === TIME_UPDATED) void load();
});

// Redraw once a second so the tracked group's timer counts up live.
setInterval(render, 1000);

void load();
