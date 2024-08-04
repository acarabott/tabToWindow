import type { WindowType } from "./api.js";
import { createNewWindow } from "./createNewWindow.js";
import { getHighlightedTabs } from "./getHighlightedTabs.js";
import { getNeighbouringWindowId } from "./getNeighbouringWindowId.js";
import { getNewWindowBounds } from "./getNewWindowBounds.js";
import { getSizeAndPos } from "./getSizeAndPos.js";
import { getWindowBounds } from "./getWindowBounds.js";
import { moveTabs } from "./moveTabs.js";
import { getOptions } from "./options.js";
import { queryTabs } from "./queryTabs.js";
import { unhighlightTabs } from "./unhighlightTabs.js";

export const tabToWindow = async (
  windowType: WindowType | undefined,
  moveToNextDisplay = false,
) => {
  const tabs = await queryTabs({ currentWindow: true });
  const activeTab = tabs.find((tab) => tab.active);
  if (activeTab === undefined) {
    return;
  }

  const displays = await chrome.system.display.getInfo();
  const currentWindow = await chrome.windows.getCurrent();

  const shouldMoveToNextDisplay = moveToNextDisplay && displays.length > 1;

  const calcOverlapArea = (display: chrome.system.display.DisplayInfo) => {
    const wl = currentWindow.left ?? 0;
    const wt = currentWindow.top ?? 0;
    const wr = wl + (currentWindow.width ?? screen.availWidth);
    const wb = wt + (currentWindow.height ?? screen.availWidth);

    const dl = display.bounds.left;
    const dt = display.bounds.top;
    const dr = display.bounds.left + display.bounds.width;
    const db = display.bounds.top + display.bounds.height;

    return (
      Math.max(0, Math.min(wr, dr) - Math.max(wl, dl)) *
      Math.max(0, Math.min(wb, db) - Math.max(wt, dt))
    );
  };

  const currentDisplay = displays.reduce((accum, current) => {
    const accumOverlap = calcOverlapArea(accum);
    const curOverlap = calcOverlapArea(current);
    return curOverlap > accumOverlap ? current : accum;
  }, displays[0]);

  const options = await getOptions();

  const isFullscreen = options.get("copyFullscreen") && currentWindow.state === "fullscreen";
  const isFocused = options.get("focus") === "new";

  // (maybe) move and resize original window
  let origWindow = currentWindow;
  const destroyingOriginalWindow = tabs.length === 1;
  if (
    origWindow.id !== undefined &&
    options.get("resizeOriginal") &&
    !isFullscreen &&
    !destroyingOriginalWindow &&
    !shouldMoveToNextDisplay
  ) {
    const bounds = getSizeAndPos(options, "original", currentDisplay.workArea);
    origWindow = await chrome.windows.update(origWindow.id, {
      ...bounds,
      state: "normal",
    });
  }

  const getNextDisplay = () => {
    const currentIndex = displays.indexOf(currentDisplay);
    const nextIndex = (currentIndex + 1) % displays.length;
    return displays[nextIndex];
  };

  // if it's just one tab, the only use case is to convert it into a popup
  // window, so just leave it where it was
  const windowBounds = shouldMoveToNextDisplay
    ? getNextDisplay().bounds
    : tabs.length === 1
      ? getWindowBounds(origWindow)
      : getNewWindowBounds(options, origWindow, currentDisplay.workArea);

  const newWindowType = windowType ?? (currentWindow.type === "popup" ? "popup" : "normal");

  // move and resize new window
  const newWindowResult = await createNewWindow(
    activeTab,
    newWindowType,
    windowBounds,
    isFullscreen,
    isFocused,
  );

  if (newWindowResult === undefined) {
    return;
  }

  const [newWin, movedTab] = newWindowResult;

  if (newWin.id !== undefined) {
    // move other highlighted tabs
    const otherTabs = tabs.filter((tab) => tab !== movedTab && tab.highlighted);
    if (otherTabs.length > 0) {
      switch (newWindowType) {
        case "normal": {
          // move all tabs at once
          const moveIndex = 1;
          const movedTabs = await moveTabs(otherTabs, newWin.id, moveIndex);

          // highlight tabs in new window
          for (const tab of movedTabs) {
            if (tab.id !== undefined) {
              await chrome.tabs.update(tab.id, { highlighted: true });
            }
          }
          break;
        }
        case "popup": {
          // can't move tabs to a popup window, so create individual ones
          const tabPromises = otherTabs.map((tab) =>
            createNewWindow(tab, newWindowType, getWindowBounds(newWin), isFullscreen, isFocused),
          );
          await Promise.all(tabPromises);
          break;
        }
      }
    }
  }

  // focus on original window if specified, and it still exists
  // (popping a single tab will destroy the original window)
  if (
    currentWindow.id !== undefined &&
    options.get("focus") === "original" &&
    !destroyingOriginalWindow
  ) {
    await chrome.windows.update(currentWindow.id, { focused: true });
  }
};

/**
 * Move the tab to a neighbouring window.
 * @param windowDistance Number of windows to move to. Positive numbers move to the right, negative to the left.
 * @returns
 */
export const tabToNeighbouringWindow = async (windowDistance: number) => {
  const tabsToMove = await queryTabs({ currentWindow: true, highlighted: true });

  if (tabsToMove.length === 0) {
    return;
  }

  const nextWindowId = await getNeighbouringWindowId(tabsToMove[0].windowId, windowDistance);
  if (nextWindowId === undefined) {
    return;
  }

  // focus on next window
  await chrome.windows.update(nextWindowId, { focused: true });

  // store tabs to unhighlight
  const tabsToUnhighlight = await getHighlightedTabs(nextWindowId);

  // move and highlight selected tabs
  const moveIndex = -1;
  const movedTabs = await moveTabs(tabsToMove, nextWindowId, moveIndex);
  for (const tab of movedTabs) {
    if (tab.id !== undefined) {
      const active = tab === movedTabs[moveTabs.length - 1];
      await chrome.tabs.update(tab.id, { highlighted: true, active });
    }
  }

  // unlight old tabs
  unhighlightTabs(tabsToUnhighlight);
};

export const tabToWindowNormal = () => tabToWindow("normal");
export const tabToWindowPopup = () => tabToWindow("popup");
export const tabToNextDisplay = () => tabToWindow(undefined, true);
