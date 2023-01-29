import browser from "webextension-polyfill";

import { WindowType, IBounds } from "./api";

export const createNewWindow = async (
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

  const newWin = await browser.windows.create(opts);

  if (newWin.id !== undefined) {
    await browser.windows.update(newWin.id, { state: isFullscreen ? "fullscreen" : "normal" });
  }

  return newWin;
};
