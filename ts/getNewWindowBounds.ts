import { IBounds, Options, windowProperties } from "./api.js";
import { getCloneBounds } from "./getCloneBounds.js";
import { getSizeAndPos } from "./getSizeAndPos.js";
import { getWindowBounds } from "./getWindowBounds.js";

export const getNewWindowBounds = (
  options: Options,
  origWindow: chrome.windows.Window,
  displayBounds: IBounds,
) => {
  const newBounds = options.isCloneEnabled
    ? getCloneBounds(getWindowBounds(origWindow), displayBounds, options.get("cloneMode"))
    : getSizeAndPos(options, "new", displayBounds);

  // ensure all values are integers for Chrome APIs
  windowProperties.forEach((key) => {
    newBounds[key] = Math.round(newBounds[key]);
  });

  return newBounds;
};
