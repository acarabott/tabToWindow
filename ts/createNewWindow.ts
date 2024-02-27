import { WindowType, IBounds } from "./api";

export const createNewWindow = (
  tab: chrome.tabs.Tab,
  windowType: WindowType,
  windowBounds: IBounds,
  isFullscreen: boolean,
  isMaximized: boolean,
  isFocused: boolean,
): Promise<[chrome.windows.Window, chrome.tabs.Tab]> => {
  // new window options
  const opts: chrome.windows.CreateData = {
    tabId: tab.id,
    type: windowType,
    focused: isFocused,
    incognito: tab.incognito,
    ...windowBounds,
  };

  return new Promise((resolve, reject) => {
    chrome.windows.create(opts, (newWin) => {
      if (newWin !== undefined) {
        if (isFullscreen && newWin.id !== undefined) {
          chrome.windows.update(newWin.id, { state: "fullscreen" }, () => resolve([newWin, tab]));
        } else if (isMaximized && newWin.id !== undefined) {
          chrome.windows.update(newWin.id, { state: "maximized" }, () => resolve([newWin, tab]));
        } else {
          resolve([newWin, tab]);
        }
      } else {
        reject("Could not create new window");
      }
    });
  });
};
