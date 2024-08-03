import type { IOptions} from "./api.js";
import { isIOptions, storedWindowBounds } from "./api.js";

const kDefaultOptions: Readonly<IOptions> = {
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
