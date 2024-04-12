import { WindowType, IBounds } from "./api";

export const createNewWindow = (
  tab: chrome.tabs.Tab,
  windowType: WindowType,
  windowBounds: IBounds,
  isFocused: boolean,
  state: chrome.windows.windowStateEnum | undefined,
): Promise<[chrome.windows.Window, chrome.tabs.Tab]> => {
  // new window options
  const opts: chrome.windows.CreateData = {
    tabId: tab.id,
    type: windowType,
    focused: isFocused,
    incognito: tab.incognito,
    ...(state === "normal" ? windowBounds : { state }),
  };

  return new Promise((resolve, reject) => {
    chrome.windows.create(opts, (newWin) => {
      if (newWin !== undefined) {
        resolve([newWin, tab]);
      } else {
        reject("Could not create new window");
      }
    });
  });
};
