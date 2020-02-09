export type WindowID = "original" | "new";
export const windowProperties = ["width", "height", "left", "top"] as const;
export type WindowProperty = typeof windowProperties[any];

export interface IBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface IOptions {
  focus: WindowID;
  resizeOriginal: boolean;
  cloneMode: "clone-mode-no" | "clone-mode-same" | "clone-mode-horizontal" | "clone-mode-vertical";
  copyFullscreen: boolean;
  menuButtonType: "normal" | "popup";
  originalWidth: number;
  originalHeight: number;
  originalLeft: number;
  originalTop: number;
  newWidth: number;
  newHeight: number;
  newLeft: number;
  newTop: number;
}