// popup.ts

import { TimeEntry } from "../domain/TimeEntry";

interface GroupTimeViewModel {
  title: string;
  formattedTime: string;
  percent: number;
}

type Totals = Record<string, number>;

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600).toString().padStart(2, "0");
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${h}:${m}:${ss}`;
}

async function loadEntries(): Promise<TimeEntry[]> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "LIST_TIME_ENTRIES" }, (res) => {
      resolve((res?.entries as TimeEntry[]) ?? []);
    });
  });
}

function aggregate(entries: TimeEntry[]): Totals {
  return entries.reduce((acc, e) => {
    const key = `${e.groupId}|${e.groupTitle}`;
    acc[key] = (acc[key] ?? 0) + e.durationMs;
    return acc;
  }, {} as Totals);
}

function createViewModels(totals: Totals): GroupTimeViewModel[] {
  const sortedPairs = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (sortedPairs.length === 0) {
    return [];
  }

  const totalMs = sortedPairs.reduce((sum, [, ms]) => sum + ms, 0);

  return sortedPairs.map(([key, ms]) => {
    const [, title] = key.split("|");
    const percent = totalMs > 0 ? Math.round((ms / totalMs) * 100) : 0;
    return {
      title,
      formattedTime: fmt(ms),
      percent,
    };
  });
}

function render(viewModels: GroupTimeViewModel[]) {
  const root = document.getElementById("summary")!;
  root.innerHTML = "";

  if (viewModels.length === 0) {
    root.textContent = "No data yet.";
    return;
  }

  for (const viewModel of viewModels) {
    const container = document.createElement("div");
    container.className = "entry-row";

    const label = document.createElement("div");
    label.className = "entry-label";
    label.textContent = `${viewModel.title} — ${viewModel.formattedTime} (${viewModel.percent}%)`;

    const barOuter = document.createElement("div");
    barOuter.className = "bar-outer";

    const barInner = document.createElement("div");
    barInner.className = "bar-inner";
    barInner.style.width = `${viewModel.percent}%`;

    barOuter.appendChild(barInner);
    container.appendChild(label);
    container.appendChild(barOuter);

    root.appendChild(container);
  }
}

async function refresh() {
  const entries = await loadEntries();
  const totals = aggregate(entries);
  const viewModels = createViewModels(totals);
  render(viewModels);
}

document.getElementById("clear")!.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "CLEAR_ALL" }, refresh);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "TIME_UPDATED") {
    refresh();
  }
});

refresh();
