import type { WindowType } from "./api.js";
import { tabToWindow } from "./actionsTabs.js";
import { getNeighbouringWindowId } from "./getNeighbouringWindowId.js";
import { unhighlightTabs } from "./unhighlightTabs.js";
import { getHighlightedTabs } from "./getHighlightedTabs.js";

export const urlToWindow = async (
  url: string,
  windowType: WindowType | undefined,
  moveToNextDisplay = false,
) => {
  await chrome.tabs.create({ url, active: true });
  void tabToWindow(windowType, moveToNextDisplay);
};

export const urlToNeighbouringWindow = async (url: string, windowDistance: number) => {
  const currentWindow = await chrome.windows.getCurrent();

  if (currentWindow.id !== undefined) {
    const nextWindowId = await getNeighbouringWindowId(currentWindow.id, windowDistance);
    if (nextWindowId === undefined) {
      return;
    }

    unhighlightTabs(await getHighlightedTabs(nextWindowId));

    const opts = { windowId: nextWindowId, url };
    await chrome.tabs.create(opts);
  }
};

export const urlToWindowNormal = (url: string) => urlToWindow(url, "normal");
export const urlToWindowPopup = (url: string) => urlToWindow(url, "popup");
export const urlToNextDisplay = (url: string) => urlToWindow(url, undefined, true);
