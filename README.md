# Fiverr Pro Tools

A Chrome extension for Fiverr sellers — keeps your online status active, improves response rate visibility, and adds productivity shortcuts to the Fiverr dashboard.

## Features
- Auto online status keeper
- Response rate tracker overlay
- Quick reply template inserter
- Order notification badges

## Installation
1. Open `chrome://extensions/`
2. Enable Developer Mode
3. Load unpacked → select this folder

## Description
This extension runs in the background of the Fiverr dashboard and periodically simulates mouse movements to keep the seller's online status active. It also provides a popup UI to toggle the keeper on or off and displays the current status via a badge.

## Requirements
- Google Chrome (or any Chromium‑based browser) that supports Manifest V3 and the Wake Lock API.

## Usage
After loading the extension, open the popup by clicking the extension icon. Use the toggle switch to enable or disable the online keeper. When enabled, the extension will automatically simulate activity to keep your Fiverr status online.

## Project Structure
- `manifest.json` – extension manifest.
- `background.js` – background script handling alarms and messaging.
- `content.js` – content script that simulates activity and manages wake lock.
- `popup.html`, `popup.css`, `popup.js` – UI shown when clicking the extension icon.
- `README.md` – this file.
- `.gitignore` – ignored files.

## License
MIT
<!-- updated: 2025-08-13-r01 -->
