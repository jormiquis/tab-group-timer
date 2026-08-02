#!/usr/bin/env node
/**
 * Renders the Chrome Web Store screenshots into store/screenshots/ at the
 * 1280x800 the listing requires.
 *
 * The popup markup below mirrors what popup.ts builds and pulls in the real
 * popup.css, so the promo images stay honest as the UI changes.
 *
 * Usage: npm run screenshots
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "store", "screenshots");
const WORK_DIR = join(ROOT, ".screenshot-tmp");
const CHROME = process.env.CHROME_BIN ?? "google-chrome";

const popupCss = readFileSync(join(ROOT, "src", "popup", "popup.css"), "utf8");

const row = ({ title, time, percent, active = false }) => `
  <div class="entry-row">
    <div class="entry-head">
      ${active ? '<span class="dot"></span>' : ""}
      <span class="entry-title">${title}</span>
      <span class="entry-time">${time}</span>
      <span class="entry-percent">${percent}%</span>
    </div>
    <div class="bar-outer"><div class="bar-inner" style="width:${percent}%"></div></div>
  </div>`;

const popup = ({ range, total, totalLabel, rows }) => `
  <div class="popup">
    <header>
      <h1>Tab Group Timer</h1>
      <div class="ranges">
        ${["today", "week", "all"]
          .map(
            (r) =>
              `<button class="range" aria-selected="${r === range}">${
                { today: "Today", week: "7 days", all: "All time" }[r]
              }</button>`,
          )
          .join("")}
      </div>
    </header>
    <p class="total"><strong>${total}</strong> tracked ${totalLabel}</p>
    <main>${rows.map(row).join("")}</main>
    <footer>
      <button>Export CSV</button>
      <button>Export JSON</button>
      <button class="danger">Reset</button>
    </footer>
  </div>`;

const page = ({ headline, sub, popupHtml }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
${popupCss}

/* popup.css follows the viewer's theme; the store images are always light. */
:root {
  --bg: #ffffff;
  --surface: #f4f5f7;
  --text: #1f2430;
  --muted: #6b7280;
  --border: #e3e5ea;
  --accent: #2f6fed;
  --accent-soft: #6ba4ff;
  --danger: #c0392b;
  --track: #e6e8ee;
}
html { color-scheme: light; }
body {
  width: 1280px; height: 800px; margin: 0; padding: 0;
  display: flex; align-items: center; justify-content: center; gap: 72px;
  background: linear-gradient(135deg, #eef3ff 0%, #dce8ff 55%, #cfe0ff 100%);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
.copy { width: 480px; }
.copy h2 {
  margin: 0 0 18px; font-size: 44px; line-height: 1.15;
  letter-spacing: -0.5px; color: #16233d;
}
.copy p { margin: 0; font-size: 20px; line-height: 1.55; color: #41547a; }
.popup {
  width: 340px; padding: 18px; border-radius: 14px;
  background: var(--bg); color: var(--text); font-size: 13px;
  box-shadow: 0 24px 60px rgb(22 35 61 / 22%), 0 2px 6px rgb(22 35 61 / 10%);
  transform: scale(1.18); transform-origin: center;
}
.popup main { max-height: none; }
.entry-delete { display: none; }
</style></head>
<body>
  <div class="copy"><h2>${headline}</h2><p>${sub}</p></div>
  ${popupHtml}
</body></html>`;

const SHOTS = [
  {
    name: "01-today",
    headline: "Every tab group, timed automatically",
    sub: "Name a tab group after the task you are on. Tab Group Timer records how long you actually spend there — no start or stop button to forget.",
    popup: {
      range: "today",
      total: "6h 24m",
      totalLabel: "today",
      rows: [
        { title: "Checkout redesign", time: "02:41:18", percent: 42, active: true },
        { title: "Code review", time: "01:35:02", percent: 25 },
        { title: "Support tickets", time: "01:02:47", percent: 16 },
        { title: "Standup & planning", time: "00:38:11", percent: 10 },
        { title: "Ungrouped", time: "00:26:42", percent: 7 },
      ],
    },
  },
  {
    name: "02-week",
    headline: "See where the week actually went",
    sub: "Switch between today, the last seven days, and all time. Totals are kept per day, so nothing gets lost when you close a tab group.",
    popup: {
      range: "week",
      total: "31h 08m",
      totalLabel: "in the last 7 days",
      rows: [
        { title: "Checkout redesign", time: "12:18:33", percent: 40 },
        { title: "Code review", time: "07:44:05", percent: 25 },
        { title: "Support tickets", time: "05:29:51", percent: 18 },
        { title: "Standup & planning", time: "03:22:16", percent: 11 },
        { title: "Ungrouped", time: "02:13:29", percent: 7 },
      ],
    },
  },
  {
    name: "03-privacy",
    headline: "Your data never leaves your browser",
    sub: "No account, no server, no analytics. Everything is stored locally with chrome.storage, and you can export it to CSV or JSON whenever you want.",
    popup: {
      range: "all",
      total: "128h 47m",
      totalLabel: "all time",
      rows: [
        { title: "Checkout redesign", time: "48:12:09", percent: 37, active: true },
        { title: "Code review", time: "31:55:44", percent: 25 },
        { title: "Support tickets", time: "24:18:02", percent: 19 },
        { title: "Standup & planning", time: "14:07:38", percent: 11 },
        { title: "Ungrouped", time: "10:13:21", percent: 8 },
      ],
    },
  },
];

function main() {
  rmSync(WORK_DIR, { recursive: true, force: true });
  mkdirSync(WORK_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  for (const shot of SHOTS) {
    const html = page({ ...shot, popupHtml: popup(shot.popup) });
    const htmlPath = join(WORK_DIR, `${shot.name}.html`);
    const pngPath = join(OUT_DIR, `${shot.name}.png`);
    writeFileSync(htmlPath, html);

    execFileSync(
      CHROME,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--window-size=1280,800",
        `--screenshot=${pngPath}`,
        `--user-data-dir=${join(WORK_DIR, "profile")}`,
        `file://${htmlPath}`,
      ],
      { stdio: "ignore" },
    );

    console.log(`wrote ${pngPath}`);
  }

  rmSync(WORK_DIR, { recursive: true, force: true });
}

main();
