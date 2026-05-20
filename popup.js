const dot = document.getElementById('keeper-dot');
const keeperSub = document.getElementById('keeper-sub');
const tabLabel = document.getElementById('tab-label');
const toggle = document.getElementById('toggle-keeper');

let activeTabId = null;

function updateKeeperDot(isActive) {
  if (!dot) return;
  dot.className = 'dot ' + (isActive ? 'active' : 'paused');
  if (keeperSub) keeperSub.textContent = isActive ? 'Active — works in background too' : 'Disabled';
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab) return;
  activeTabId = tab.id;

  if (tabLabel) {
    tabLabel.textContent = tab.title
      ? 'Tab: ' + tab.title.replace(' - Fiverr', '').trim()
      : 'Tab: fiverr.com';
  }

  chrome.runtime.sendMessage({ type: 'GET_TAB_SETTINGS', tabId: activeTabId }, (data) => {
    if (!data) return;
    toggle.checked = data.onlineKeeperEnabled !== false;
    chrome.action.getBadgeText({ tabId: activeTabId }, (text) => {
      updateKeeperDot(text === 'ON');
    });
  });
});

toggle.addEventListener('change', () => {
  if (!activeTabId) return;
  const value = toggle.checked;
  chrome.runtime.sendMessage({ type: 'SET_TAB_SETTING', tabId: activeTabId, key: 'onlineKeeperEnabled', value });
  updateKeeperDot(value);
  chrome.tabs.sendMessage(activeTabId, { type: 'SETTINGS_UPDATED', settings: { onlineKeeperEnabled: value } }).catch(() => {});
});
