import { IBounds, WindowType } from "./api";

export const createNewWindow = async (
  tab: chrome.tabs.Tab,
  windowType: WindowType,
  windowBounds: IBounds,
  isFullscreen: boolean,
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

  const newWin = await chrome.windows.create(opts);
  if (isFullscreen && newWin.id !== undefined) {
    await chrome.windows.update(newWin.id, { state: "fullscreen" });
  }

  return [newWin, tab];
};
