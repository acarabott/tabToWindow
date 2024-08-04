import type { IBounds, WindowType } from "./api.js";

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

  if (newWin.id !== undefined) {
    const updateOptions: chrome.windows.UpdateInfo = {
      focused: isFocused,
    };

    if (isFullscreen) {
      updateOptions.state = "fullscreen";
    }

    await chrome.windows.update(newWin.id, updateOptions);
  }

  return [newWin, tab];
};
