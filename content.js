const SELECTORS = {
  notifBadge: [
    '[data-testid="notification-badge"]',
    '.notification-item .count',
    '.nav-notifications .badge-count',
    'a[href*="notifications"] .count',
    '.notifications-bell .count'
  ],
  msgBadge: [
    '[data-testid="messages-badge"]',
    'a[href*="inbox"] .count',
    '.inbox-link .count',
    '.nav-inbox .count'
  ],
  inboxThreads: [
    '.thread-item',
    '.inbox-row',
    '[data-testid="inbox-row"]',
    '.conversation-item'
  ],
  threadTime: [
    'time',
    '.time-ago',
    '[data-testid="message-time"]',
    '.message-date'
  ],
  threadUnread: [
    '.unread',
    '[data-unread="true"]',
    '.thread-item.new',
    '.is-unread'
  ]
};

function querySelector(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function querySelectorAll(selectors) {
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    if (els.length) return Array.from(els);
  }
  return [];
}

function getCountFromElement(selectors) {
  const el = querySelector(selectors);
  if (!el) return 0;
  const num = parseInt(el.textContent.trim(), 10);
  return isNaN(num) ? 0 : num;
}

let settings = {
  onlineKeeperEnabled: true,
  notificationsEnabled: true,
  responseTrackerEnabled: true
};

// --- Wake Lock ---
// Prevents OS display sleep while online keeper is enabled and this tab is visible.
// Browser releases the lock automatically when tab goes to background — we re-request
// it as soon as the tab becomes visible again.
let wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  if (wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (_) {}
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  try { await wakeLock.release(); } catch (_) {}
  wakeLock = null;
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && settings.onlineKeeperEnabled) {
    await requestWakeLock();
  }
});

let lastNotifCount = 0;
let lastMessageCount = 0;
let keeperTimer = null;
let responseTimerEl = null;
// Random ID per session — prevents Fiverr scanning DOM for known extension element IDs
const TIMER_EL_ID = '_fv' + Math.random().toString(36).slice(2, 9);

chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
  if (res) {
    settings = { ...settings, ...res };
    lastNotifCount = res.lastNotifCount || 0;
    lastMessageCount = res.lastMessageCount || 0;
  }
  init();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'KEEPER_TICK' && settings.onlineKeeperEnabled) {
    // Only fire mouse events on visible tabs — events on hidden tabs are
    // detectable by Fiverr (real users can't move a mouse on a tab they're not viewing).
    // WebSocket keeps online status alive on background tabs without needing events.
    if (!document.hidden) simulateActivityBurst();
  }
});

function init() {
  if (settings.onlineKeeperEnabled) startOnlineKeeper();
  if (settings.responseTrackerEnabled) startResponseTracker();
  if (settings.notificationsEnabled) startNotifWatcher();
}

// --- Online Keeper ---
// Works even when Fiverr tab is in the background.
// Triggered by chrome.alarms (never throttled by Chrome) instead of setInterval.
// setInterval in background tabs gets throttled to 1+ min — alarms fire exactly on schedule.
function startOnlineKeeper() {
  chrome.runtime.sendMessage({ type: 'START_KEEPER_ALARM' });
  setKeeperBadge(true);
  requestWakeLock();
}

function setKeeperBadge(isActive) {
  chrome.runtime.sendMessage({ type: 'KEEPER_STATUS', active: isActive });
}

function simulateActivityBurst() {
  const all = [
    () => {
      const x = 100 + Math.random() * (window.innerWidth - 200);
      const y = 100 + Math.random() * (window.innerHeight - 200);
      const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y };
      document.dispatchEvent(new MouseEvent('mousemove', opts));
      document.dispatchEvent(new PointerEvent('pointermove', { ...opts, pointerId: 1 }));
    },
    () => {
      window.dispatchEvent(new Event('scroll'));
    },
    () => {
      const x = 100 + Math.random() * (window.innerWidth - 200);
      const y = 100 + Math.random() * (window.innerHeight - 200);
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
    }
  ];

  // Pick 1–3 events at random so every burst looks different
  const count = 1 + Math.floor(Math.random() * all.length);
  const picked = all.sort(() => Math.random() - 0.5).slice(0, count);

  let delay = 0;
  picked.forEach((fn) => {
    delay += 150 + Math.random() * 600;
    setTimeout(fn, delay);
  });
}

// --- Notification Watcher (MutationObserver fallback) ---
// Fires if badge updates happen via DOM mutation (without a fetch cycle)
function startNotifWatcher() {
  const observer = new MutationObserver(() => {
    const notif = getCountFromElement(SELECTORS.notifBadge);
    const msg = getCountFromElement(SELECTORS.msgBadge);

    if (settings.notificationsEnabled) {
      if (notif > lastNotifCount) {
        chrome.runtime.sendMessage({
          type: 'NOTIFY',
          title: 'Fiverr — New Notification',
          body: `You have ${notif - lastNotifCount} new notification${notif - lastNotifCount > 1 ? 's' : ''}.`
        });
      }
      if (msg > lastMessageCount) {
        chrome.runtime.sendMessage({
          type: 'NOTIFY',
          title: 'Fiverr — New Message',
          body: `You have ${msg - lastMessageCount} new message${msg - lastMessageCount > 1 ? 's' : ''}.`
        });
      }
    }

    lastNotifCount = notif;
    lastMessageCount = msg;
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

// --- Response Time Tracker ---
// Scans inbox threads, finds the oldest unanswered one, shows a live countdown widget
function startResponseTracker() {
  if (!window.location.pathname.includes('/inbox') && !window.location.pathname.includes('/messages')) {
    injectResponseBadge(null);
    return;
  }

  setInterval(() => {
    if (!settings.responseTrackerEnabled) return;
    const oldestUnanswered = findOldestUnansweredTimestamp();
    injectResponseBadge(oldestUnanswered);
  }, 5000);

  injectResponseBadge(findOldestUnansweredTimestamp());
}

function findOldestUnansweredTimestamp() {
  const threads = querySelectorAll(SELECTORS.inboxThreads);
  let oldest = null;

  for (const thread of threads) {
    const isUnread = SELECTORS.threadUnread.some(sel => thread.matches(sel) || thread.querySelector(sel));
    if (!isUnread) continue;

    const timeEl = (() => {
      for (const sel of SELECTORS.threadTime) {
        const el = thread.querySelector(sel);
        if (el) return el;
      }
      return null;
    })();

    if (!timeEl) continue;

    const ts = timeEl.getAttribute('datetime') || timeEl.getAttribute('title') || timeEl.textContent;
    const parsed = new Date(ts);
    if (isNaN(parsed.getTime())) continue;

    if (!oldest || parsed < oldest) oldest = parsed;
  }

  return oldest;
}

function injectResponseBadge(oldestTs) {
  if (!responseTimerEl) {
    responseTimerEl = document.createElement('div');
    responseTimerEl.id = TIMER_EL_ID;
    responseTimerEl.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 99999;
      background: #222325;
      color: #fff;
      font-family: sans-serif;
      font-size: 13px;
      padding: 10px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      display: none;
      line-height: 1.5;
      min-width: 190px;
    `;
    document.body.appendChild(responseTimerEl);
  }

  if (!oldestTs) {
    responseTimerEl.style.display = 'none';
    return;
  }

  const now = Date.now();
  const elapsed = now - oldestTs.getTime();
  const remaining = 3600000 - elapsed; // 1 hour in ms

  if (remaining <= 0) {
    responseTimerEl.style.background = '#c0392b';
    responseTimerEl.style.display = 'block';
    responseTimerEl.innerHTML = `<strong>Response Time</strong><br>⚠️ 1-hour window passed`;
    return;
  }

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const urgent = remaining < 900000; // < 15 min

  responseTimerEl.style.background = urgent ? '#c0392b' : '#222325';
  responseTimerEl.style.display = 'block';
  responseTimerEl.innerHTML = `<strong>Response Time Left</strong><br>${mins}m ${secs}s`;
}

// Listen for settings changes from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SETTINGS_UPDATED') {
    settings = { ...settings, ...msg.settings };

    if (!settings.onlineKeeperEnabled) {
      chrome.runtime.sendMessage({ type: 'STOP_KEEPER_ALARM' });
      setKeeperBadge(false);
      releaseWakeLock();
    } else {
      startOnlineKeeper();
    }

    if (responseTimerEl && !settings.responseTrackerEnabled) {
      responseTimerEl.style.display = 'none';
    }
  }
});
