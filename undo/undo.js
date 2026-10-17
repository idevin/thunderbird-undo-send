const params = new URLSearchParams(window.location.search);
const tabId = Number(params.get("tabId"));
const deadline = Number(params.get("deadline"));
const countdown = document.querySelector("#countdown");
const undoButton = document.querySelector("#undo");

document.documentElement.lang = browser.i18n.getUILanguage();

function secondsLeft() {
  if (!Number.isFinite(deadline)) {
    return 0;
  }
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

function render() {
  const left = secondsLeft();
  countdown.textContent =
    left > 0
      ? browser.i18n.getMessage("countdown", String(left))
      : browser.i18n.getMessage("countdownNow");
  return left;
}

let lastLeft = render();
if (lastLeft > 0) {
  const ticker = window.setInterval(() => {
    const left = render();
    if (left === lastLeft) {
      return;
    }
    lastLeft = left;
    if (left === 0) {
      window.clearInterval(ticker);
    }
  }, 200);
}

undoButton.addEventListener("click", async () => {
  if (!Number.isInteger(tabId)) {
    return;
  }
  undoButton.disabled = true;
  try {
    await browser.runtime.sendMessage({ type: "undo-send", tabId });
  } catch (error) {
    console.error("Undo Send could not cancel the message.", error);
    undoButton.disabled = false;
    return;
  }
  window.close();
});
