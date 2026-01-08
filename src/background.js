import { createMemo } from "./domain/memo.js";
import { addMemo } from "./infrastructure/memoRepository.js";

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "save-selection") {
    return;
  }

  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!activeTab || typeof activeTab.id !== "number") {
    return;
  }

  const tabUrl = activeTab.url ?? "";

  if (!isScriptableUrl(tabUrl)) {
    return;
  }

  const selection = await captureSelection(activeTab.id);
  const text = selection.trim();

  if (!text) {
    return;
  }

  const url = tabUrl;
  const memo = createMemo({ text, url });

  await addMemo(memo);
});

chrome.runtime.onInstalled.addListener(() => {
  if (!chrome.sidePanel) {
    return;
  }
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!chrome.sidePanel) {
    return;
  }
  if (!tab || typeof tab.id !== "number" || typeof tab.windowId !== "number") {
    return;
  }
  await chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: "src/sidepanel.html",
    enabled: true
  });
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

async function captureSelection(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const selection = window.getSelection();
      return selection ? selection.toString() : "";
    }
  });

  if (!Array.isArray(results) || results.length === 0) {
    return "";
  }

  return typeof results[0].result === "string" ? results[0].result : "";
}

function isScriptableUrl(url) {
  if (!url) {
    return false;
  }
  if (url.startsWith("chrome://")) {
    return false;
  }
  if (url.startsWith("chrome-extension://")) {
    return false;
  }
  if (url.startsWith("https://chrome.google.com/webstore")) {
    return false;
  }
  if (url.startsWith("https://chromewebstore.google.com")) {
    return false;
  }
  return true;
}
