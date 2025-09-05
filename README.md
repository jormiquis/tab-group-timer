# ⏱️ Tab Group Timer

## ✨ About

This is a **custom-built tool** I created to satisfy a personal need:
tracking the tasks I dedicate my working hours to.

If it’s useful for me, chances are it might be useful for someone else too! 🚀

This is an early **v0.1** release 🚧 — expect things to evolve quickly.

---

## ✨ Features
- Automatically tracks active tab groups and time spent.
- Handles tab focus changes and idle time.
- Live summary popup with totals per group.
- Simple, lightweight, no external servers.

---

## 📸 Captures
![Demo](/docs/Screenshot%20from%202025-09-05%2022-24-46.png)

![Demo2](/docs/Screenshot%20from%202025-09-05%2022-25-44.png)

---

## 🛠️ Installation (Developer Mode)
Since this project is not yet published in the Chrome Web Store, you can try it locally:

1. Clone this repository:
   ```bash
   git clone
   cd tab-group-timer

2. Build the extension:
```bash
    npm install
    npm run build
```
3. Open Chrome and go to:
```arduino
chrome://extensions
```
4. Enable Developer mode (top right).
5. Click Load unpacked and select the dist/ folder.
6. Pin the extension to your toolbar and start tracking!

## 🧪 Running Tests

This project uses [Vitest](https://vitest.dev) for testing.

Run all tests:
```bash
npm run test
```
### Debug tests:
```bash
npm run test:debug
```
## 📂 Project Structure

```bash
src/
  domain/         # Core domain models & ports
  application/    # Use cases (business logic)
  infrastructure/ # Chrome extension adapters
  ui/             # Popup UI
test/
  application/    # Integration tests for use cases
```

## ⚡ Credits

This project was bootstrapped with the help of AI-assisted coding and lots of ☕.