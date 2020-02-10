import { getOptions } from "./options-storage";

export const windowIds = ["original", "new"] as const;
export type WindowID = typeof windowIds[any];

export const windowProperties = ["width", "height", "left", "top"] as const;
export type WindowProperty = typeof windowProperties[any];

export const windowTypes = ["normal", "popup"] as const;
export type WindowType = typeof windowTypes[any];

export const cloneModes = [
  "clone-mode-no",
  "clone-mode-same",
  "clone-mode-horizontal",
  "clone-mode-vertical",
] as const;
export type CloneMode = typeof cloneModes[any];

export const storedWindowBounds = [
  "originalWidth",
  "originalHeight",
  "originalLeft",
  "originalTop",
  "newWidth",
  "newHeight",
  "newLeft",
  "newTop",
] as const;
export type StoredWindowProperty = typeof storedWindowBounds[any];

export interface IBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface IOptions {
  cloneMode: CloneMode;
  copyFullscreen: boolean;
  focus: WindowID;
  menuButtonType: WindowType;
  newHeight: number;
  newLeft: number;
  newTop: number;
  newWidth: number;
  originalHeight: number;
  originalLeft: number;
  originalTop: number;
  originalWidth: number;
  resizeOriginal: boolean;
}

export const isIOptions = (obj: any): obj is IOptions => {
  const cast = obj as IOptions;
  return (
    cast !== undefined &&
    obj &&
    cloneModes.includes(cast.cloneMode) &&
    typeof cast.copyFullscreen === "boolean" &&
    windowIds.includes(cast.focus) &&
    windowTypes.includes(cast.menuButtonType) &&
    typeof cast.newHeight === "number" &&
    typeof cast.newLeft === "number" &&
    typeof cast.newTop === "number" &&
    typeof cast.newWidth === "number" &&
    typeof cast.originalHeight === "number" &&
    typeof cast.originalLeft === "number" &&
    typeof cast.originalTop === "number" &&
    typeof cast.originalWidth === "number" &&
    typeof cast.resizeOriginal === "boolean"
  );
};

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
export type Options = ThenArg<ReturnType<typeof getOptions>>;
