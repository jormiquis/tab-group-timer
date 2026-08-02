# Chrome Web Store listing

Copy-paste source for the Developer Dashboard. Assets live in
`store/screenshots/` and `img/icon128.png`.

---

## Store listing tab

**Name** (45 char max)

```
Tab Group Timer
```

**Short description** (132 char max — must match `manifest.json`)

```
Automatically tracks how much time you spend in each Chrome tab group. All data stays on your device.
```

**Category:** Workflow & Planning
**Language:** English

**Detailed description**

```
Tab Group Timer answers a simple question: where did my working hours actually go?

Name a Chrome tab group after the task you are working on — "Checkout redesign",
"Code review", "Client A" — and the extension records how long you spend in it.
There is no timer to start and no timer to stop, so there is nothing to forget.

HOW IT WORKS

Whenever you switch to a tab, the extension notes which group that tab belongs to
and starts counting. Switch to a tab in another group and the previous total is
banked. Lock your machine, switch to another app, or leave Chrome in the
background and the clock pauses automatically — idle time is not counted as work.

WHAT YOU GET

• A live breakdown of time per tab group, with bars and percentages
• Today, last 7 days, and all-time views
• A live counter for the group you are in right now
• Per-day totals, so history is kept even after you close a tab group
• Export to CSV or JSON in one click
• Delete a single group's history, or reset everything

PRIVACY

Tab Group Timer has no server, no account, and no analytics. It never reads the
URLs, titles, or contents of your pages — it does not even request the browser
permission that would allow it to. The only things stored are your tab group
names and the time totals, saved locally in your own browser with
chrome.storage. Nothing is ever transmitted anywhere.

Open source. Built for people who track their own time.
```

---

## Privacy tab

**Single purpose description**

```
Tab Group Timer measures how much time the user spends in each of their Chrome
tab groups and displays those totals in the extension popup. That is its only
function.
```

**Permission justifications**

| Field | Text |
| --- | --- |
| `tabGroups` | Reads the title of the tab group that the active tab belongs to, so elapsed time can be attributed to the right group and shown in the popup. Group titles are the only data read. |
| `storage` | Stores accumulated per-group, per-day time totals locally in the browser so they persist across restarts, and keeps the in-progress interval in session storage so it is not lost when Chrome suspends the service worker. |
| `idle` | Detects when the machine goes idle or is locked so the timer can be paused. Without it, time away from the computer would be wrongly counted as time worked. |
| `alarms` | Runs a once-per-minute checkpoint that writes the in-progress interval to storage. Manifest V3 terminates the background service worker after roughly 30 seconds of inactivity, so without this alarm any uninterrupted stretch of work would be lost. |
| Remote code | Not used. All code is contained in the uploaded package. |

**Data usage disclosures** — check **none** of the data-collection categories, then
certify:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL** — publish `PRIVACY.md` at a public URL and paste it here.
A GitHub Pages site or the file's GitHub permalink both work.

---

## Assets checklist

| Asset | Requirement | File |
| --- | --- | --- |
| Store icon | 128×128 PNG | `img/icon128.png` |
| Screenshot 1 | 1280×800 PNG | `store/screenshots/01-today.png` |
| Screenshot 2 | 1280×800 PNG | `store/screenshots/02-week.png` |
| Screenshot 3 | 1280×800 PNG | `store/screenshots/03-privacy.png` |
| Package | zip of `dist/` | `npm run package` |

Regenerate assets with `npm run icons` and `npm run screenshots`.
