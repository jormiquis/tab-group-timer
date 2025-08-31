interface TimeEntry {
  groupId: number;
  groupTitle: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
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

function renderTotals(totals: Totals) {
  const root = document.getElementById("summary")!;
  root.innerHTML = "";
  const pairs = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  for (const [key, ms] of pairs) {
    const [, title] = key.split("|");
    const name = document.createElement("div");
    name.textContent = title;
    name.className = "group";
    const val = document.createElement("div");
    val.textContent = fmt(ms);
    val.className = "small";
    root.appendChild(name);
    root.appendChild(val);
  }
  if (pairs.length === 0) {
    root.textContent = "Sin datos todavía.";
  }
}

async function refresh() {
  const entries = await loadEntries();
  const totals = aggregate(entries);
  renderTotals(totals);
}

document.getElementById("refresh")!.addEventListener("click", refresh);
document.getElementById("clear")!.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "CLEAR_ALL" }, refresh);
});

refresh();