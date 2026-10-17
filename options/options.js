const enabledInput = document.querySelector("#enabled");
const delayInput = document.querySelector("#delay");
const readout = document.querySelector("#delay-readout");
const status = document.querySelector("#status");
const error = document.querySelector("#error");

const DEFAULT_DELAY_SECONDS = 10;
const MIN_DELAY_SECONDS = 5;
const MAX_DELAY_SECONDS = 30;

document.documentElement.lang = browser.i18n.getUILanguage();

function clampDelay(value) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) {
    return DEFAULT_DELAY_SECONDS;
  }
  return Math.min(MAX_DELAY_SECONDS, Math.max(MIN_DELAY_SECONDS, number));
}

function showError(message) {
  error.hidden = !message;
  error.textContent = message || "";
}

function render() {
  const delaySeconds = clampDelay(delayInput.value);
  readout.textContent = browser.i18n.getMessage("delayReadout", String(delaySeconds));
  status.textContent = enabledInput.checked
    ? browser.i18n.getMessage("statusWaiting", String(delaySeconds))
    : browser.i18n.getMessage("statusImmediate");
  delayInput.disabled = !enabledInput.checked;
}

async function save() {
  showError("");
  const delaySeconds = clampDelay(delayInput.value);
  delayInput.value = String(delaySeconds);
  render();
  await browser.storage.local.set({
    enabled: enabledInput.checked,
    delaySeconds,
  });
}

async function restore() {
  const stored = await browser.storage.local.get({
    enabled: true,
    delaySeconds: DEFAULT_DELAY_SECONDS,
  });
  enabledInput.checked = stored.enabled !== false;
  delayInput.value = String(clampDelay(stored.delaySeconds));
  render();
}

function report(loadError) {
  showError(browser.i18n.getMessage("optionsError", String(loadError)));
}

enabledInput.addEventListener("change", () => {
  save().catch(report);
});

delayInput.addEventListener("input", render);

delayInput.addEventListener("change", () => {
  save().catch(report);
});

render();
restore().catch(loadError => {
  enabledInput.disabled = true;
  delayInput.disabled = true;
  report(loadError);
});
