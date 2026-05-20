let settings = { onlineKeeperEnabled: true };

// --- Wake Lock ---
let wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || wakeLock) return;
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

// Track last cursor position so movementX/Y are realistic
let _lastX = Math.random() * window.innerWidth;
let _lastY = Math.random() * window.innerHeight;

// Load settings for this tab
chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
  if (res) settings = { ...settings, ...res };
  if (settings.onlineKeeperEnabled) startOnlineKeeper();
});

// Receive tick from background alarm
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'KEEPER_TICK' && settings.onlineKeeperEnabled) {
    // Skip if tab is hidden — events on hidden tabs are detectable
    if (document.hidden) return;
    // Skip if user is actively typing — prevents input conflicts
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    simulateActivityBurst();
  }

  if (msg.type === 'SETTINGS_UPDATED') {
    settings = { ...settings, ...msg.settings };
    if (!settings.onlineKeeperEnabled) {
      chrome.runtime.sendMessage({ type: 'STOP_KEEPER_ALARM' });
      setKeeperBadge(false);
      releaseWakeLock();
    } else {
      startOnlineKeeper();
    }
  }
});

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
      const movX = Math.round(x - _lastX);
      const movY = Math.round(y - _lastY);
      _lastX = x; _lastY = y;
      const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, movementX: movX, movementY: movY };
      document.dispatchEvent(new MouseEvent('mousemove', opts));
      document.dispatchEvent(new PointerEvent('pointermove', { ...opts, pointerId: 1 }));
    },
    () => {
      window.dispatchEvent(new Event('scroll'));
    },
    () => {
      const x = 100 + Math.random() * (window.innerWidth - 200);
      const y = 100 + Math.random() * (window.innerHeight - 200);
      const movX = Math.round(x - _lastX);
      const movY = Math.round(y - _lastY);
      _lastX = x; _lastY = y;
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y, movementX: movX, movementY: movY }));
    }
  ];

  const count = 1 + Math.floor(Math.random() * all.length);
  const picked = all.sort(() => Math.random() - 0.5).slice(0, count);

  let delay = 0;
  picked.forEach((fn) => {
    delay += 150 + Math.random() * 600;
    setTimeout(fn, delay);
  });
}
