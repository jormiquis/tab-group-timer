# Privacy Policy — Tab Group Timer

_Last updated: 2 August 2026_

## Summary

Tab Group Timer does not collect, transmit, or sell any data. Everything it
records stays inside your own browser.

## What the extension stores

To show you how long you spent on each tab group, the extension stores locally:

- the **titles of your tab groups**, as you named them;
- the **total time** accumulated per tab group, per calendar day;
- the tab group currently being timed, while your browser is running.

That is the entire dataset. It is written with the standard Chrome
`chrome.storage.local` and `chrome.storage.session` APIs, on your device.

## What the extension does *not* do

- It does not read, store, or transmit the **URLs, page contents, or titles** of
  your tabs. The extension does not request the `tabs` permission, so Chrome does
  not give it access to that information in the first place.
- It does not send anything to any server. There is no backend, no account, no
  login, and no network request of any kind.
- It does not use analytics, telemetry, crash reporting, advertising, or
  third-party libraries at runtime.
- It does not share or sell data to anyone, because it never receives any.

## Permissions and why they are needed

| Permission  | Why it is required                                                            |
| ----------- | ----------------------------------------------------------------------------- |
| `tabGroups` | Read the title of the tab group you are currently in, so time can be attributed to it. |
| `storage`   | Save the accumulated times locally so they survive a browser restart.          |
| `idle`      | Pause the timer when you lock your machine or step away, so idle time is not counted as work. |
| `alarms`    | Save the running interval to disk about once a minute, so no time is lost when Chrome shuts the extension's background worker down. |

## Your control over the data

- **Delete one group's history** with the × button next to it in the popup.
- **Delete everything** with the Reset button in the popup.
- **Export everything** to CSV or JSON at any time from the popup.
- Uninstalling the extension removes all of its stored data from your browser.

## Contact

Questions about this policy can be raised as an issue on the project's
repository.
