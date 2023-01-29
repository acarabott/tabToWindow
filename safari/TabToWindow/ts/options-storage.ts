import browser from "webextension-polyfill";

import {
  IOptions,
  WindowID,
  WindowProperty,
  StoredWindowProperty,
  storedWindowBounds,
  isIOptions,
  COMMAND_DISPLAY,
  COMMAND_NEXT,
  COMMAND_NORMAL,
  COMMAND_POPUP,
  COMMAND_PREVIOUS,
  // isIOptions,
} from "./api.js";

const defaultOptions: IOptions = {
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
  keybindings: {
    [COMMAND_NORMAL]: undefined,
    [COMMAND_POPUP]: undefined,
    [COMMAND_NEXT]: undefined,
    [COMMAND_PREVIOUS]: undefined,
    [COMMAND_DISPLAY]: undefined, 
  }
};

// retrieve the storage key for a particular window property
export const getStorageWindowPropKey = (
  id: WindowID,
  key: WindowProperty,
): StoredWindowProperty => {
  return (
    {
      original: {
        left: "originalLeft",
        top: "originalTop",
        width: "originalWidth",
        height: "originalHeight",
      },
      new: {
        left: "newLeft",
        top: "newTop",
        width: "newWidth",
        height: "newHeight",
      },
    } as const
  )[id][key];
};

export const getOptions = async () => {
  const loadedOptions = await browser.storage.sync.get(defaultOptions);
  let options = isIOptions(loadedOptions) ? loadedOptions : defaultOptions;

  return {
    get<K extends keyof IOptions, V extends IOptions[K]>(key: K) {
      return options[key] as V;
    },

    getAll() {
      return Object.freeze(options);
    },

    update(update: Partial<IOptions>) {
      options = { ...options, ...update };

      // clamp number values
      for (const key of storedWindowBounds) {
        options[key] = Math.max(0, Math.min(options[key], 1));
      }

      return browser.storage.sync.set(options);
    },

    get isCloneEnabled() {
      return options.cloneMode !== "clone-mode-no";
    },
  };
};

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
export type Options = ThenArg<ReturnType<typeof getOptions>>;
