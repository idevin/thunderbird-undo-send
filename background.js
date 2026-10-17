/**
 * Delay sending from the compose window.
 *
 * onBeforeSend locks that window until this listener returns, so Undo lives
 * in a separate popup. { cancel: true } keeps the draft. Returning nothing
 * continues the original send, including Send Later.
 */

const DEFAULT_DELAY_SECONDS = 10;
const MIN_DELAY_SECONDS = 5;
const MAX_DELAY_SECONDS = 30;

let settings = {
  enabled: true,
  delaySeconds: DEFAULT_DELAY_SECONDS,
};

function clampDelay(value) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) {
    return DEFAULT_DELAY_SECONDS;
  }
  return Math.min(MAX_DELAY_SECONDS, Math.max(MIN_DELAY_SECONDS, number));
}

function applySettings(stored) {
  settings = {
    enabled: stored.enabled !== false,
    delaySeconds: clampDelay(
      stored.delaySeconds == null ? DEFAULT_DELAY_SECONDS : stored.delaySeconds
    ),
  };
}

let settingsLoaded = false;
const settingsReady = browser.storage.local
  .get({ enabled: true, delaySeconds: DEFAULT_DELAY_SECONDS })
  .then(applySettings)
  .catch(error => {
    console.error("Undo Send could not read its settings.", error);
  })
  .then(() => {
    settingsLoaded = true;
  });

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }
  applySettings({
    enabled: Object.prototype.hasOwnProperty.call(changes, "enabled")
      ? changes.enabled.newValue
      : settings.enabled,
    delaySeconds: Object.prototype.hasOwnProperty.call(changes, "delaySeconds")
      ? changes.delaySeconds.newValue
      : settings.delaySeconds,
  });
});

const pending = new Map();

function finish(tabId, undo) {
  const entry = pending.get(tabId);
  if (!entry || entry.done) {
    return;
  }
  entry.done = true;
  pending.delete(tabId);
  clearTimeout(entry.timer);
  if (entry.popupId != null) {
    browser.windows.remove(entry.popupId).catch(() => {});
  }
  entry.resolve(undo);
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (!sender || sender.id !== browser.runtime.id) {
    return;
  }
  if (!message || message.type !== "undo-send") {
    return;
  }
  finish(Number(message.tabId), true);
});

browser.tabs.onRemoved.addListener(tabId => {
  finish(tabId, true);
});

browser.compose.onBeforeSend.addListener(async tab => {
  // After the first load the choice is already in memory, so the popup opens
  // in this turn. A cold start waits for storage before deciding to delay.
  if (!settingsLoaded) {
    await settingsReady;
  }
  if (!settings.enabled || tab.id == null) {
    return;
  }
  if (pending.has(tab.id)) {
    return { cancel: true };
  }

  const deadline = Date.now() + settings.delaySeconds * 1000;
  let resolveDecision;
  const decision = new Promise(resolve => {
    resolveDecision = resolve;
  });
  const entry = {
    resolve: resolveDecision,
    timer: setTimeout(() => finish(tab.id, false), deadline - Date.now()),
    popupId: null,
    done: false,
  };
  pending.set(tab.id, entry);

  const url =
    browser.runtime.getURL("undo/undo.html") +
    `?tabId=${encodeURIComponent(tab.id)}&deadline=${encodeURIComponent(deadline)}`;

  try {
    const popup = await browser.windows.create({
      url,
      type: "popup",
      width: 440,
      height: 260,
      focused: true,
    });
    if (entry.done) {
      if (popup && popup.id != null) {
        browser.windows.remove(popup.id).catch(() => {});
      }
    } else if (popup && popup.id != null) {
      entry.popupId = popup.id;
    }
  } catch (error) {
    console.error("Undo Send could not open the countdown window.", error);
  }

  if (await decision) {
    return { cancel: true };
  }
});
