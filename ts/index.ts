import {
  tabToNeighbouringWindow,
  tabToNextDisplay,
  tabToWindow,
  tabToWindowNormal,
  tabToWindowPopup,
} from "./actionsTabs.js";
import {
  urlToNeighbouringWindow,
  urlToNextDisplay,
  urlToWindowNormal,
  urlToWindowPopup,
} from "./actionsURLs.js";
import {
  COMMAND_DISPLAY,
  COMMAND_NEXT,
  COMMAND_NORMAL,
  COMMAND_POPUP,
  COMMAND_PREVIOUS,
  IOptions,
  MENU_FOCUS_NEW_OPTION_ID,
  MENU_FOCUS_ORIGINAL_OPTION_ID,
  MENU_LINK_TO_DISPLAY_ID,
  MENU_LINK_TO_NEXT_ID,
  MENU_LINK_TO_POPUP_ID,
  MENU_LINK_TO_PREVIOUS_ID,
  MENU_LINK_TO_WINDOW_ID,
  MENU_POPUP_OPTION_ID,
  MENU_TAB_TO_DISPLAY_ID,
  MENU_TAB_TO_NEXT_ID,
  MENU_TAB_TO_POPUP_ID,
  MENU_TAB_TO_PREVIOUS_ID,
  MENU_TAB_TO_WINDOW_ID,
  MENU_WINDOW_OPTION_ID,
} from "./api.js";
import { createMenu } from "./createMenu.js";
import { getOptions } from "./options-storage.js";

// Storage
// -----------------------------------------------------------------------------

chrome.storage.onChanged.addListener(async (changes) => {
  const update: Partial<IOptions> = {};

  const entries = Object.entries(changes) as Array<[keyof IOptions, chrome.storage.StorageChange]>;
  for (const [key, change] of entries) {
    update[key] = change.newValue;
  }

  (await getOptions()).update(update);
});

// Commands
// -----------------------------------------------------------------------------

chrome.commands.onCommand.addListener((command) => {
  chrome.runtime.getBackgroundPage(() => {
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
});

// Extension Button
// -----------------------------------------------------------------------------
chrome.browserAction.onClicked.addListener(async () => {
  tabToWindow((await getOptions()).get("menuButtonType"));
});

// Context Menu
// -----------------------------------------------------------------------------

createMenu();

chrome.contextMenus.onClicked.addListener(async (info) => {
  const options = await getOptions();

  // prettier-ignore
  switch (info.menuItemId) {

    // tab actions
    case MENU_TAB_TO_WINDOW_ID:   tabToWindowNormal(); break;
    case MENU_TAB_TO_POPUP_ID:    tabToWindowPopup(); break;
    case MENU_TAB_TO_NEXT_ID:     tabToNeighbouringWindow(1); break;
    case MENU_TAB_TO_PREVIOUS_ID: tabToNeighbouringWindow(-1); break;
    case MENU_TAB_TO_DISPLAY_ID:  tabToNextDisplay(); break;

    // options
    case MENU_WINDOW_OPTION_ID:         options.update({ menuButtonType: "normal" }); break;
    case MENU_POPUP_OPTION_ID:          options.update({ menuButtonType: "popup" }); break;
    case MENU_FOCUS_ORIGINAL_OPTION_ID: options.update({ focus: "original" }); break;
    case MENU_FOCUS_NEW_OPTION_ID:      options.update({ focus: "new" }); break;

    default: break;
  }

  // link actions
  // prettier-ignore
  if (info.linkUrl !== undefined) {
    switch(info.menuItemId) {
      case MENU_LINK_TO_WINDOW_ID:    urlToWindowNormal(info.linkUrl); break;
      case MENU_LINK_TO_POPUP_ID:     urlToWindowPopup(info.linkUrl); break;
      case MENU_LINK_TO_NEXT_ID:      urlToNeighbouringWindow(info.linkUrl, 1); break;
      case MENU_LINK_TO_PREVIOUS_ID:  urlToNeighbouringWindow(info.linkUrl, -1); break;
      case MENU_LINK_TO_DISPLAY_ID:   urlToNextDisplay(info.linkUrl); break;

      default: break;
    }
  }
});
