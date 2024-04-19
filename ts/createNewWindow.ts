import { WindowType, IBounds } from "./api";

export const createNewWindow = (
  tab: chrome.tabs.Tab,
  windowType: WindowType,
  windowBounds: IBounds,
  isFocused: boolean,
  copyState: boolean,
  state: chrome.windows.windowStateEnum | undefined,
): Promise<[chrome.windows.Window, chrome.tabs.Tab]> => {
  // new window options
  const opts: chrome.windows.CreateData = {
    tabId: tab.id,
    type: windowType,
    focused: isFocused,
    incognito: tab.incognito,
    state,
  };

  return new Promise((resolve, reject) => {
    chrome.windows.create(opts, (newWin) => {
      if (newWin !== undefined) {
        if (newWin.id && copyState) {
          chrome.windows.update(newWin.id, { state: "normal", ...windowBounds }, () =>
            chrome.windows.update(newWin.id!, { state }, () => resolve([newWin, tab])),
          );
        }
        resolve([newWin, tab]);
      } else {
        reject("Could not create new window");
      }
    });
  });
};
