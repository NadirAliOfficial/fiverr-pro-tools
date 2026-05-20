const DEFAULT_SETTINGS = { onlineKeeperEnabled: true };

function alarmName(tabId) { return `fpt-keeper-${tabId}`; }
function tabKey(tabId) { return `tab_${tabId}`; }

function randomKeeperDelay() {
  return 0.67 + Math.random() * 0.58; // 40–75 seconds
}

function scheduleNextTick(tabId) {
  chrome.alarms.create(alarmName(tabId), { delayInMinutes: randomKeeperDelay() });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ defaults: DEFAULT_SETTINGS });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(tabKey(tabId));
  chrome.alarms.clear(alarmName(tabId));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  const match = alarm.name.match(/^fpt-keeper-(\d+)$/);
  if (!match) return;
  const tabId = parseInt(match[1], 10);
  chrome.tabs.sendMessage(tabId, { type: 'KEEPER_TICK' }).catch(() => {});
  scheduleNextTick(tabId);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (msg.type === 'GET_SETTINGS') {
    if (!tabId) { sendResponse(DEFAULT_SETTINGS); return true; }
    chrome.storage.local.get([tabKey(tabId), 'defaults'], (data) => {
      const base = data.defaults || DEFAULT_SETTINGS;
      const tabSettings = data[tabKey(tabId)] || {};
      sendResponse({ ...base, ...tabSettings });
    });
    return true;
  }

  if (msg.type === 'SET_TAB_SETTING') {
    const tid = msg.tabId;
    const key = tabKey(tid);
    chrome.storage.local.get(key, (data) => {
      const current = data[key] || {};
      chrome.storage.local.set({ [key]: { ...current, [msg.key]: msg.value } });
    });
  }

  if (msg.type === 'GET_TAB_SETTINGS') {
    const tid = msg.tabId;
    chrome.storage.local.get([tabKey(tid), 'defaults'], (data) => {
      const base = data.defaults || DEFAULT_SETTINGS;
      const tabSettings = data[tabKey(tid)] || {};
      sendResponse({ ...base, ...tabSettings });
    });
    return true;
  }

  if (msg.type === 'START_KEEPER_ALARM') {
    if (!tabId) return;
    scheduleNextTick(tabId);
    chrome.action.setBadgeText({ text: 'ON', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#1dbf73', tabId });
    chrome.action.setTitle({ title: 'Fiverr Pro Tools — Online Keeper Active', tabId });
  }

  if (msg.type === 'STOP_KEEPER_ALARM') {
    if (!tabId) return;
    chrome.alarms.clear(alarmName(tabId));
    chrome.action.setBadgeText({ text: '', tabId });
    chrome.action.setTitle({ title: 'Fiverr Pro Tools — Keeper Off', tabId });
  }

  if (msg.type === 'KEEPER_STATUS') {
    if (!tabId) return;
    if (msg.active) {
      chrome.action.setBadgeText({ text: 'ON', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#1dbf73', tabId });
      chrome.action.setTitle({ title: 'Fiverr Pro Tools — Online Keeper Active', tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
      chrome.action.setTitle({ title: 'Fiverr Pro Tools — Keeper Off', tabId });
    }
  }
});
