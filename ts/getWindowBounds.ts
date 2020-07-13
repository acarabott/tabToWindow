import { IBounds } from "./api.js";

export const getWindowBounds = (win: chrome.windows.Window): IBounds => {
  return {
    left: win.left ?? 0,
    top: win.top ?? 0,
    width: win.width ?? screen.availWidth,
    height: win.height ?? screen.availHeight,
  };
};
