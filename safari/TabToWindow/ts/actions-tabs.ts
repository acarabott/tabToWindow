import browser from "webextension-polyfill";
import { IBounds, WindowType } from "./api";
import { createNewWindow } from "./createNewWindow";
import { doBackgroundAction } from "./doBackgroundAction";

export const tabToWindow = async (windowType: WindowType) => {
  doBackgroundAction(async () => {
    const tabs = await browser.tabs.query({ currentWindow: true, active: true });

    if (tabs.length === 0) {
      return;
    }
    const tab = tabs[0];

    const isFullscreen = false;
    const isFocused = true;
    const windowBounds: IBounds = {
      left: screen.availWidth * 0.5,
      top: screenTop,
      width: screen.availWidth * 0.5,
      height: screen.availHeight,
    };

    const promises: Promise<unknown>[] = [];

    // create the new window
    promises.push(createNewWindow(tab, windowType, windowBounds, isFullscreen, isFocused));

    // close the existing tab
    if (tab.id !== undefined) {
      promises.push(browser.tabs.remove(tab.id));
    }

    return Promise.all(promises);
  });
};

export const tabToNeighbouringWindow = (_windowDistance: number) => {};

export const tabToWindowNormal = () => tabToWindow("normal");
export const tabToWindowPopup = () => tabToWindow("popup");
export const tabToNextDisplay = () => tabToWindow("normal"); // TODO can we do this in Safari?
