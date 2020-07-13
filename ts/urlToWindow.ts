import { WindowType } from "./api.js";
import { doBackgroundAction } from "./doBackgroundAction.js";
import { tabToWindow } from "./tabToWindow.js";

export const urlToWindow = (
  url: string,
  windowType: WindowType | undefined,
  moveToNextDisplay = false,
) => {
  doBackgroundAction(() => {
    chrome.tabs.create({ url, active: true }, () => {
      tabToWindow(windowType, moveToNextDisplay);
    });
  });
};
