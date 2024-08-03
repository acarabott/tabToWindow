// Installation
// -----------------------------------------------------------------------------

import {
  tabToNeighbouringWindow,
  tabToNextDisplay,
  tabToWindow,
  tabToWindowNormal,
  tabToWindowPopup,
} from "./actionsTabs.js";
import {
  COMMAND_DISPLAY,
  COMMAND_NEXT,
  COMMAND_NORMAL,
  COMMAND_POPUP,
  COMMAND_PREVIOUS,
  IOptions,
} from "./api.js";
import { getOptions } from "./options-storage.js";

chrome.runtime.onInstalled.addListener((details) => {
  const previousMajorVersion = parseInt(details.previousVersion ?? "0", 10);
  const showUpdate =
    details.reason === "install" || (details.reason === "update" && previousMajorVersion < 3);

  if (showUpdate) {
    const url = "https://acarabott.github.io/tabToWindow";
    chrome.tabs.create({ url, active: true });
  }
});

// Storage
// -----------------------------------------------------------------------------

chrome.storage.onChanged.addListener(async (changes) => {
  const update: Partial<IOptions> = {};

  const entries = Object.entries(changes) as Array<[keyof IOptions, chrome.storage.StorageChange]>;
  for (const [key, change] of entries) {
    update[key] = change.newValue;
  }

  const options = await getOptions();
  options.update(update);
});

// Commands
// -----------------------------------------------------------------------------

chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case COMMAND_NORMAL:
      tabToWindowNormal();
      break;
    case COMMAND_POPUP:
      tabToWindowPopup();
      break;
    case COMMAND_NEXT:
      tabToNeighbouringWindow(1);
      break;
    case COMMAND_PREVIOUS:
      tabToNeighbouringWindow(-1);
      break;
    case COMMAND_DISPLAY:
      tabToNextDisplay();
      break;
    default:
      console.assert(false);
      break;
  }
});

// Extension Button
// -----------------------------------------------------------------------------
chrome.action.onClicked.addListener(async () => {
  const options = await getOptions();
  const menuButtonType = options.get("menuButtonType");
  tabToWindow(menuButtonType);
});
