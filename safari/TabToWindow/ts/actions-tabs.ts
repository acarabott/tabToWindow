import browser from "webextension-polyfill";
import { WindowType } from "./api";
import { createNewWindow } from "./createNewWindow";
import { doBackgroundAction } from "./doBackgroundAction";
import { getScreenBounds } from "./getScreenBounds";
import { getSizeAndPos } from "./getSizeAndPos";
import { getOptions } from "./options-storage";

export const tabToWindow = async (windowType: WindowType) => {
  doBackgroundAction(async () => {
    const currentWindow = await browser.windows.getCurrent({ populate: true });

    if (currentWindow.tabs === undefined || currentWindow.tabs.length === 0) {
      return;
    }

    const options = await getOptions();

    const tab = currentWindow.tabs[0];
    const isCopyFullScreenEnabled = options.get("copyFullscreen");
    const isCurrentWindowFullscreen = currentWindow.state === "fullscreen";
    const isNewWindowFullscreen = isCopyFullScreenEnabled && isCurrentWindowFullscreen;
    const isNewWindowFocused = options.get("focus") === "new";
    const newWindowBounds = await getSizeAndPos(options, "new", getScreenBounds());

    // create the new window
    await createNewWindow(
      tab,
      windowType,
      newWindowBounds,
      isNewWindowFullscreen,
      isNewWindowFocused,
    );

    // close the existing tab
    if (tab.id !== undefined) {
      await browser.tabs.remove(tab.id);
    }

    // (maybe) move and resize original window
    const destroyingOriginalWindow = currentWindow.tabs.length === 1;
    if (
      currentWindow.id !== undefined &&
      options.get("resizeOriginal") &&
      !isNewWindowFullscreen &&
      !destroyingOriginalWindow
    ) {
      const vals = await getSizeAndPos(options, "original", getScreenBounds());
      browser.windows.update(currentWindow.id, {
        ...vals,
        state: "normal",
        focused: !isNewWindowFocused,
      });
    }
  });
};

export const tabToNeighbouringWindow = (_windowDistance: number) => {};

export const tabToWindowNormal = () => tabToWindow("normal");
export const tabToWindowPopup = () => tabToWindow("popup");
export const tabToNextDisplay = () => {
  // TODO can we do this in Safari?
  throw new Error("tabToNextDisplay not implemented");
};
