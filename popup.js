const toggleMap = {
  'toggle-keeper': 'onlineKeeperEnabled',
  'toggle-notif': 'notificationsEnabled',
  'toggle-response': 'responseTrackerEnabled'
};

const dot = document.getElementById('keeper-dot');
const keeperSub = document.getElementById('keeper-sub');
const tabLabel = document.getElementById('tab-label');

let activeTabId = null;

function updateKeeperDot(isActive) {
  if (!dot) return;
  dot.className = 'dot ' + (isActive ? 'active' : 'paused');
  if (keeperSub) {
    keeperSub.textContent = isActive
      ? 'Active — works in background too'
      : 'Disabled';
  }
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname;
    return u.hostname + path;
  } catch (_) {
    return url;
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab) return;

  activeTabId = tab.id;

  // Show tab label
  if (tabLabel) {
    tabLabel.textContent = tab.title
      ? `Tab: ${tab.title.replace(' - Fiverr', '').trim()}`
      : `Tab: ${shortUrl(tab.url)}`;
  }

  // Load this tab's settings
  chrome.runtime.sendMessage({ type: 'GET_TAB_SETTINGS', tabId: activeTabId }, (data) => {
    if (!data) return;
    for (const [id, key] of Object.entries(toggleMap)) {
      const el = document.getElementById(id);
      if (el) el.checked = data[key] !== false;
    }
    // Reflect keeper badge
    chrome.action.getBadgeText({ tabId: activeTabId }, (text) => {
      updateKeeperDot(text === 'ON');
    });
  });
});

// Wire up toggles — each change only affects the active tab
for (const [id, key] of Object.entries(toggleMap)) {
  const el = document.getElementById(id);
  if (!el) continue;

  el.addEventListener('change', () => {
    if (!activeTabId) return;
    const value = el.checked;

    // Save to this tab's settings
    chrome.runtime.sendMessage({ type: 'SET_TAB_SETTING', tabId: activeTabId, key, value });

    // Update keeper dot immediately if toggling keeper
    if (key === 'onlineKeeperEnabled') {
      updateKeeperDot(value);
    }

    // Push live setting change to the tab's content script
    chrome.tabs.sendMessage(activeTabId, {
      type: 'SETTINGS_UPDATED',
      settings: { [key]: value }
    }).catch(() => {});
  });
}
