import { IOptions, WindowID, WindowProperty } from "./api";

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
function getStorageWindowPropKey(windowId: WindowID, propKey: WindowProperty) {
  return `${windowId}${propKey
    .slice(0)
    .charAt(0)
    .toUpperCase()}${propKey.slice(1)}`;
}

function validateOptions(options: IOptions) {
  if (!Object.keys(options).every(key => Object.keys(defaults).includes(key))) {
    console.error("not all options are present!");
    console.error(Object.keys(options).filter(key => !Object.keys(defaults).includes(key)));
    return false;
  }

  function isValidStringOption(option, validOptions) {
    const result = validOptions.includes(options[option]);
    if (!result) {
      console.error(`"${option}" is invalid, should be in ${validOptions}`);
    }
    return result;
  }

  function isValidBoolOption(key) {
    const result = typeof options[key] === "boolean";
    if (!result) {
      console.error(`"${key}" option is invalid, should be boolean`);
    }
    return result;
  }

  function isValidNumberOption(key, min, max) {
    const result = typeof options[key] === "number" && options[key] >= min && options[key] <= max;
    if (!result) {
      console.error(`${key} should be between ${min} and ${max}`);
    }
    return result;
  }

  if (!isValidStringOption("focus", ["original", "new"])) {
    return false;
  }
  if (!isValidBoolOption("resizeOriginal")) {
    return false;
  }
  if (
    !isValidStringOption("cloneMode", [
      "clone-mode-no",
      "clone-mode-same",
      "clone-mode-horizontal",
      "clone-mode-vertical",
    ])
  ) {
    return false;
  }
  if (!isValidBoolOption("copyFullscreen")) {
    return false;
  }
  if (!isValidStringOption("menuButtonType", ["normal", "popup"])) {
    return false;
  }

  const numberOpts = [
    "originalWidth",
    "originalHeight",
    "originalLeft",
    "originalTop",
    "newWidth",
    "newHeight",
    "newLeft",
    "newTop",
  ];
  if (numberOpts.some(opt => !isValidNumberOption(opt, 0.0, 1.0))) {
    return false;
  }

  return true;
}

function saveOptions(options: IOptions) {
  if (!validateOptions(options)) {
    return;
  }

  chrome.storage.sync.set(options, () => {
    if (chrome.runtime.lastError !== undefined) {
      console.error(chrome.runtime.lastError);
    }
  });
}

const values = defaults;

export const options = {
  defaults,

  get(key) {
    return values[key];
  },

  getForWindow(windowId, key) {
    return options.get(getStorageWindowPropKey(windowId, key));
  },

  set(key, value) {
    values[key] = value;
  },

  setForWindow(windowId, key, value) {
    options.set(getStorageWindowPropKey(windowId, key), value);
  },

  save() {
    saveOptions(values);
  },

  loadPromise: new Promise((resolve, reject) => {
    chrome.storage.sync.get(defaults, loadedOptions => {
      if (chrome.runtime.lastError === undefined) {
        Object.entries(loadedOptions).forEach(([key, value]) => {
          values[key] = value;
        });
        resolve(options);
      } else {
        reject(chrome.runtime.lastError);
      }
    });
  }),
};

export function isCloning() {
  return options.get("cloneMode") !== "clone-mode-no";
}
