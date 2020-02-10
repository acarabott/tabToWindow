import {
  IOptions,
  WindowID,
  WindowProperty,
  StoredWindowProperty,
  storedWindowBounds,
} from "./api.js";

const defaults: IOptions = {
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

// retrieve the storage key for a particular window property
const getStorageWindowPropKey = (id: WindowID, key: WindowProperty): StoredWindowProperty => {
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

const saveOptions = (options: IOptions) => {
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
};

let values = defaults;

export const options = {
  get<K extends keyof IOptions, V extends IOptions[K]>(key: K) {
    return values[key] as V;
  },

  getForWindow(windowId: WindowID, key: WindowProperty) {
    return options.get(getStorageWindowPropKey(windowId, key));
  },

  set<T extends keyof IOptions, V extends IOptions[T]>(key: T, value: V) {
    values[key] = value;
  },

  setForWindow(windowId: WindowID, key: WindowProperty, value: number) {
    options.set(getStorageWindowPropKey(windowId, key), value);
  },

  save() {
    saveOptions(values).catch(console.error);
  },

  get loadPromise() {
    return new Promise<typeof options>((resolve, reject) => {
      chrome.storage.sync.get(defaults, loadedOptions => {
        if (chrome.runtime.lastError === undefined) {
          values = { ...values, ...(loadedOptions as IOptions) };
          resolve(options);
        } else {
          reject(chrome.runtime.lastError);
        }
      });
    });
  },
};

export const isCloning = () => options.get("cloneMode") !== "clone-mode-no";
