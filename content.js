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

function isUserTyping() {
  const el = document.activeElement;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox';
}

// Receive tick from background alarm
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'KEEPER_TICK' && settings.onlineKeeperEnabled) {
    if (document.hidden) return;
    if (isUserTyping()) return;
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
  const moves = [
    () => {
      // Re-check right before dispatching — user may have clicked into input during delay
      if (isUserTyping()) return;
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
      if (isUserTyping()) return;
      const x = 100 + Math.random() * (window.innerWidth - 200);
      const y = 100 + Math.random() * (window.innerHeight - 200);
      const movX = Math.round(x - _lastX);
      const movY = Math.round(y - _lastY);
      _lastX = x; _lastY = y;
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y, movementX: movX, movementY: movY }));
    }
  ];

  // scroll removed — it closes Fiverr dropdowns and autocomplete regardless of focus state

  const picked = moves.sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * moves.length));
  let delay = 0;
  picked.forEach((fn) => {
    delay += 200 + Math.random() * 600;
    setTimeout(fn, delay);
  });
}
