import {
  IOptions,
  WindowID,
  WindowProperty,
  StoredWindowProperty,
  storedWindowBounds,
  isIOptions,
} from "./api.js";

const defaultOptions: IOptions = {
  focus: "new",
  resizeOriginal: true,
  cloneMode: "clone-mode-no",
  copyState: true,
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

// retrieve the storage key for a particular window property
export const getStorageWindowPropKey = (
  id: WindowID,
  key: WindowProperty,
): StoredWindowProperty => {
  return ({
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
  } as const)[id][key];
};

export const getOptions = async () => {
  let options = await new Promise<IOptions>((resolve, reject) =>
    chrome.storage.sync.get(defaultOptions, loadedOptions => {
      if (chrome.runtime.lastError !== undefined) {
        reject(chrome.runtime.lastError);
        return;
      }

      resolve(isIOptions(loadedOptions) ? loadedOptions : defaultOptions);
    }),
  );

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

      return new Promise<boolean>((resolve, reject) => {
        chrome.storage.sync.set(options, () => {
          if (chrome.runtime.lastError === undefined) {
            resolve(true);
          } else {
            reject(chrome.runtime.lastError);
          }
        });
      });
    },

    get isCloneEnabled() {
      return options.cloneMode !== "clone-mode-no";
    },
  };
};
