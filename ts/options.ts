import type { CloneMode, IOptions, WindowID, WindowType } from "./api.js";
import { cloneModes, storedWindowBounds, windowIds, windowTypes } from "./api.js";

export const kDefaultOptions: Readonly<IOptions> = {
  focus: "new",
  resizeOriginal: true,
  cloneMode: "clone-mode-no",
  copyFullscreen: true,
  menuButtonType: "normal",
  originalWidth: 0.5,
  originalHeight: 1.0,
  originalLeft: 0.0,
  originalTop: 0.0,
  newWidth: 0.5,
  newHeight: 1.0,
  newLeft: 0.5,
  newTop: 0.0,
};

export const isCloneMode = (value: unknown): value is CloneMode =>
  typeof value === "string" && cloneModes.includes(value as CloneMode);

export const isCopyFullscreen = (value: unknown): value is boolean => typeof value === "boolean";

export const isFocus = (value: unknown): value is WindowID =>
  typeof value === "string" && windowIds.includes(value as WindowID);

export const isMenuButtonType = (value: unknown): value is WindowType =>
  typeof value === "string" && windowTypes.includes(value as WindowType);

export const isNumber = (value: unknown): value is number =>
  typeof value === "number" && !isNaN(value);

export const isNewHeight = (value: unknown): value is number => isNumber(value);
export const isNewLeft = (value: unknown): value is number => isNumber(value);
export const isNewTop = (value: unknown): value is number => isNumber(value);
export const isNewWidth = (value: unknown): value is number => isNumber(value);
export const isOriginalHeight = (value: unknown): value is number => isNumber(value);
export const isOriginalLeft = (value: unknown): value is number => isNumber(value);
export const isOriginalTop = (value: unknown): value is number => isNumber(value);
export const isOriginalWidth = (value: unknown): value is number => isNumber(value);
export const isResizeOriginal = (value: unknown): value is boolean => typeof value === "boolean";

export const isIOptions = (obj: unknown): obj is IOptions =>
  obj !== undefined &&
  obj !== null &&
  typeof obj === "object" &&
  isCloneMode((obj as IOptions).cloneMode) &&
  isCopyFullscreen((obj as IOptions).copyFullscreen) &&
  isFocus((obj as IOptions).focus) &&
  isMenuButtonType((obj as IOptions).menuButtonType) &&
  isNewHeight((obj as IOptions).newHeight) &&
  isNewLeft((obj as IOptions).newLeft) &&
  isNewTop((obj as IOptions).newTop) &&
  isNewWidth((obj as IOptions).newWidth) &&
  isOriginalHeight((obj as IOptions).originalHeight) &&
  isOriginalLeft((obj as IOptions).originalLeft) &&
  isOriginalTop((obj as IOptions).originalTop) &&
  isOriginalWidth((obj as IOptions).originalWidth) &&
  isResizeOriginal((obj as IOptions).resizeOriginal);

export const createOptionsUpdateFromChanges = (changes: {
  [key: string]: chrome.storage.StorageChange;
}) => {
  const update: Partial<IOptions> = {};
  for (const [key, change] of Object.entries(changes)) {
    if (!(key in kDefaultOptions)) {
      continue;
    }

    switch (key) {
      case "cloneMode": {
        if (isCloneMode(change.newValue)) {
          update.cloneMode = change.newValue;
        }
        break;
      }
      case "copyFullscreen": {
        if (isCopyFullscreen(change.newValue)) {
          update.copyFullscreen = change.newValue;
        }
        break;
      }
      case "focus": {
        if (isFocus(change.newValue)) {
          update.focus = change.newValue;
        }
        break;
      }
      case "menuButtonType": {
        if (isMenuButtonType(change.newValue)) {
          update.menuButtonType = change.newValue;
        }
        break;
      }
      case "newHeight": {
        if (isNewHeight(change.newValue)) {
          update.newHeight = change.newValue;
        }
        break;
      }
      case "newLeft": {
        if (isNewLeft(change.newValue)) {
          update.newLeft = change.newValue;
        }
        break;
      }
      case "newTop": {
        if (isNewTop(change.newValue)) {
          update.newTop = change.newValue;
        }
        break;
      }
      case "newWidth": {
        if (isNewWidth(change.newValue)) {
          update.newWidth = change.newValue;
        }
        break;
      }
      case "originalHeight": {
        if (isOriginalHeight(change.newValue)) {
          update.originalHeight = change.newValue;
        }
        break;
      }
      case "originalLeft": {
        if (isOriginalLeft(change.newValue)) {
          update.originalLeft = change.newValue;
        }
        break;
      }
      case "originalTop": {
        if (isOriginalTop(change.newValue)) {
          update.originalTop = change.newValue;
        }
        break;
      }
      case "originalWidth": {
        if (isOriginalWidth(change.newValue)) {
          update.originalWidth = change.newValue;
        }
        break;
      }
      case "resizeOriginal": {
        if (isResizeOriginal(change.newValue)) {
          update.resizeOriginal = change.newValue;
        }
        break;
      }
      default:
    }
  }

  return update;
};

export const getOptions = async () => {
  const loadedOptions = await chrome.storage.sync.get(kDefaultOptions);

  let options = isIOptions(loadedOptions) ? loadedOptions : { ...kDefaultOptions };

  return {
    get<K extends keyof IOptions, V extends IOptions[K]>(key: K) {
      return options[key] as V;
    },

    update(update: Partial<IOptions>) {
      options = { ...options, ...update };

      // clamp number values
      for (const key of storedWindowBounds) {
        options[key] = Math.max(0, Math.min(options[key], 1));
      }

      return chrome.storage.sync.set(options);
    },

    get isCloneEnabled() {
      return options.cloneMode !== "clone-mode-no";
    },
  };
};
