import { Options, WindowID, IBounds } from "./api.js";
import { getStorageWindowPropKey } from "./getStorageWindowPropKey.js";

/**
 * Convert normalised values into pixel values
 */
export const getSizeAndPos = (options: Options, winKey: WindowID, displayBounds: IBounds) => {
  return {
    left: Math.round(
      options.get(getStorageWindowPropKey(winKey, "left")) * displayBounds.width +
        displayBounds.left,
    ),
    top: Math.round(
      options.get(getStorageWindowPropKey(winKey, "top")) * displayBounds.height +
        displayBounds.top,
    ),
    width: Math.round(options.get(getStorageWindowPropKey(winKey, "width")) * displayBounds.width),
    height: Math.round(
      options.get(getStorageWindowPropKey(winKey, "height")) * displayBounds.height,
    ),
  };
};
