# Fiverr Pro Tools

A Chrome extension for Fiverr sellers to stay online, get instant notifications, and track response times — without Fiverr detecting anything unusual.

## Features

### Online Status Keeper
Keeps your Fiverr "Online" badge active by simulating natural browser activity (mouse movement, scroll, pointer events) in staggered bursts every ~50 seconds. Uses `chrome.alarms` so it works even when the Fiverr tab is in the background. Also requests a Wake Lock to prevent your screen from sleeping while active.

### Desktop Notifications
Instant desktop alerts when new messages or notifications arrive, detected via MutationObserver watching badge counts in real-time.

### Response Time Tracker
A live countdown widget on the Fiverr inbox showing how much time is left in the 1-hour response window. Turns red under 15 minutes. Helps maintain your response rate metric.

## How It Works

- Activity simulation runs via `chrome.alarms` — not `setInterval` — so Chrome's background tab throttling never affects it
- Each Fiverr tab has its own independent settings (toggle features per tab)
- Wake Lock API prevents OS display sleep while the keeper is active and the tab is visible
- Extension icon shows a green **ON** badge when the keeper is running

## Browser Support

Works on any Chromium-based browser:

- Chrome
- Brave
- Microsoft Edge
- Opera

Does not support Firefox or Safari.

## Installation

1. Clone or download this repo
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the project folder
5. Open any Fiverr tab — the extension activates automatically

## Usage

Click the extension icon to open the popup. Each toggle is independent per tab:

- **Online Status Keeper** — keeps your green dot active for buyers
- **Desktop Notifications** — alerts for new messages and orders
- **Response Time Tracker** — countdown widget on inbox pages

## Notes

- Fiverr cannot detect this extension — activity events are local to the browser and never sent to Fiverr's servers
- The keeper pauses automatically if the browser or OS is suspended (laptop sleep)
- Settings are stored per tab and cleared when the tab is closed
