import browser from "webextension-polyfill";

import { WindowType, IBounds } from "./api";

export const createNewWindow = (
  tab: browser.Tabs.Tab,
  windowType: WindowType,
  windowBounds: IBounds,
  isFullscreen: boolean,
  isFocused: boolean,
): Promise<browser.Windows.Window> => {
  const opts: browser.Windows.CreateCreateDataType = {
    url: tab.url,
    type: windowType,
    focused: isFocused,
    incognito: tab.incognito,
    ...windowBounds,
  };

  if (isFullscreen) {
    return new Promise<browser.Windows.Window>(async (resolve, reject) => {
      browser.windows.create(opts).then((newWin) => {
        // this timeout is gross but necessary.
        // updating immediately fails
        setTimeout(() => {
          if (newWin.id !== undefined) {
            browser.windows.update(newWin.id, { state: "fullscreen" }).then(() => {
              resolve(newWin);
            });
          } else {
            reject("New window has no ide");
          }
        }, 1000);
      });
    });
  }

  return browser.windows.create(opts);
};
