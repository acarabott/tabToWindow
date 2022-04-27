import browser from "webextension-polyfill";
import { WindowID, WindowType } from "./api";
import { createNewWindow } from "./createNewWindow";
import { doBackgroundAction } from "./doBackgroundAction";
import { getWindowBounds } from "./getWindowBounds";

export const tabToWindow = async (windowType: WindowType | "clone") => {
  doBackgroundAction(async () => {
    const currentWindowPromise = browser.windows.getCurrent({});
    const tabsPromise = browser.tabs.query({ currentWindow: true });
    const [currentWindow, tabs] = await Promise.all([currentWindowPromise, tabsPromise]);

    const focus: WindowID = Math.random() < 2.0 ? "new" : "original";
    // const focus = options.get("focus");
    const isFocused = focus === "new";

    // const options = await getOptions();
    // const isFullscreen = options.get("copyFullscreen") && currentWindow.state === "fullscreen";
    const isFullscreen = false;

    // (maybe) move and resize original window
    let origWindow = currentWindow;
    const destroyingOriginalWindow = tabs.length === 1;
    // if (
    //   options.get("resizeOriginal") &&
    //   !isFullscreen &&
    //   !destroyingOriginalWindow &&
    // ) {
    //   const vals = await getSizeAndPos(options, "original", currentDisplay.workArea);
    //   origWindow = await new Promise<browser.Windows.Window>((resolve) => {
    //     if (origWindow.id !== undefined) {
    //       browser.Windows.update(
    //         origWindow.id,
    //         {
    //           width: vals.width,
    //           height: vals.height,
    //           left: vals.left,
    //           top: vals.top,
    //           state: "normal",
    //         },
    //         (win) => resolve(win),
    //       );
    //     }
    //   });
    // }

    // move and resize new window
    const activeTab = tabs.find((tab) => tab.active)!;

    // if it's just one tab, the only use case is to convert it into a popup
    // window, so just leave it where it was
    // const windowBounds =
    //   tabs.length === 1
    //     ? getWindowBounds(origWindow)
    //     : await getNewWindowBounds(options, origWindow, currentDisplay.workArea);
    const windowBounds = getWindowBounds(origWindow);
    windowBounds.left = screen.availWidth * 0.5;

    const newWindowType =
      windowType === "clone" ? (currentWindow.type === "popup" ? "popup" : "normal") : windowType;

    await createNewWindow(activeTab, newWindowType, windowBounds, isFullscreen, isFocused);

    // focus on original window if specified, and it still exists
    // (popping a single tab will destroy the original window)
    const currentWindowId = currentWindow.id;
    if (currentWindowId !== undefined) {
      if (focus === "original" && !destroyingOriginalWindow) {
        browser.windows
          .get(currentWindowId, {})
          .then((_window) => {
            browser.windows.update(currentWindowId, { focused: true });
          })
          .catch((reason) => {
            throw new Error(reason);
          });
      }
    }
  });
};

export const tabToNeighbouringWindow = (windowDistance: number) => {
  doBackgroundAction(async () => {
    console.log("windowDistance:", windowDistance);
    // const tabsToMove = await new Promise<chrome.tabs.Tab[]>((resolve) =>
    //   chrome.tabs.query({ currentWindow: true, highlighted: true }, (tabs) => resolve(tabs)),
    // );

    // if (tabsToMove.length === 0) {
    //   return;
    // }

    // const nextWindowId = await getNeighbouringWindowId(tabsToMove[0].windowId, windowDistance);
    // if (nextWindowId === undefined) {
    //   return;
    // }

    // // focus on next window
    // await new Promise((resolve) => {
    //   chrome.windows.update(nextWindowId, { focused: true }, (win) => resolve(win));
    // });

    // // store tabs to unhighlight
    // const tabsToUnhighlight = await getTabsToUnhighlight(nextWindowId);

    // // move and highlight selected tabs
    // const moveIndex = -1;
    // const movedTabs = await moveTabs(tabsToMove, nextWindowId, moveIndex);
    // await Promise.all(
    //   movedTabs.map((tab, i) => {
    //     return new Promise((tabResolve) => {
    //       chrome.tabs.update(
    //         tab.id!,
    //         { highlighted: true, active: i === movedTabs.length - 1 },
    //         (tab) => tabResolve(tab),
    //       );
    //     });
    //   }),
    // );

    // // unlight old tabs
    // unhighlightTabs(tabsToUnhighlight);
  });
};

export const tabToWindowNormal = () => tabToWindow("normal");
export const tabToWindowPopup = () => tabToWindow("popup");
export const tabToNextDisplay = () => tabToWindow("clone");
