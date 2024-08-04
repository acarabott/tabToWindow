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
import type {
  IOptions} from "./api.js";
import {
  COMMAND_DISPLAY,
  COMMAND_NEXT,
  COMMAND_NORMAL,
  COMMAND_POPUP,
  COMMAND_PREVIOUS,
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
import { updateActionButton } from "./updateActionButton.js";

// Installation
// -----------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener((details) => {
  const previousMajorVersion = parseInt(details.previousVersion ?? "0", 10);
  const showUpdate =
    details.reason === "install" || (details.reason === "update" && previousMajorVersion < 3);

  if (showUpdate) {
    const url = "https://acarabott.github.io/tabToWindow";
    void chrome.tabs.create({ url, active: true });
  }
});

// Storage
// -----------------------------------------------------------------------------

chrome.storage.onChanged.addListener(async (changes) => {
  const update: Partial<IOptions> = {};

  const entries = Object.entries(changes) as [keyof IOptions, chrome.storage.StorageChange][];
  for (const [key, change] of entries) {
    update[key] = change.newValue;
  }

  const options = await getOptions();
  options.update(update);

  void updateActionButton();
});

// Commands
// -----------------------------------------------------------------------------

chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case COMMAND_NORMAL:
      void tabToWindowNormal();
      break;
    case COMMAND_POPUP:
      void tabToWindowPopup();
      break;
    case COMMAND_NEXT:
      void tabToNeighbouringWindow(1);
      break;
    case COMMAND_PREVIOUS:
      void tabToNeighbouringWindow(-1);
      break;
    case COMMAND_DISPLAY:
      void tabToNextDisplay();
      break;
    default:
      break;
  }
});

// Extension Button
// -----------------------------------------------------------------------------
chrome.action.onClicked.addListener(() => {
  void getOptions().then((options) => {
    const menuButtonType = options.get("menuButtonType");
    void tabToWindow(menuButtonType);
  });
});

void updateActionButton();

// Context Menu
// -----------------------------------------------------------------------------

void createMenu();

chrome.contextMenus.onClicked.addListener((info) => {
  void getOptions().then((options) => {
    // prettier-ignore
    switch (info.menuItemId) {

      // tab actions
      case MENU_TAB_TO_WINDOW_ID:   void tabToWindowNormal(); break;
      case MENU_TAB_TO_POPUP_ID:    void tabToWindowPopup(); break;
      case MENU_TAB_TO_NEXT_ID:     void tabToNeighbouringWindow(1); break;
      case MENU_TAB_TO_PREVIOUS_ID: void tabToNeighbouringWindow(-1); break;
      case MENU_TAB_TO_DISPLAY_ID:  void tabToNextDisplay(); break;

      // options
      case MENU_WINDOW_OPTION_ID:         void options.update({ menuButtonType: "normal" }); break;
      case MENU_POPUP_OPTION_ID:          void options.update({ menuButtonType: "popup" }); break;
      case MENU_FOCUS_ORIGINAL_OPTION_ID: void options.update({ focus: "original" }); break;
      case MENU_FOCUS_NEW_OPTION_ID:      void options.update({ focus: "new" }); break;

      default: break;
    }

    // link actions
    // prettier-ignore
    if (info.linkUrl !== undefined) {
      switch(info.menuItemId) {
        case MENU_LINK_TO_WINDOW_ID:    void urlToWindowNormal(info.linkUrl); break;
        case MENU_LINK_TO_POPUP_ID:     void urlToWindowPopup(info.linkUrl); break;
        case MENU_LINK_TO_NEXT_ID:      void urlToNeighbouringWindow(info.linkUrl, 1); break;
        case MENU_LINK_TO_PREVIOUS_ID:  void urlToNeighbouringWindow(info.linkUrl, -1); break;
        case MENU_LINK_TO_DISPLAY_ID:   void urlToNextDisplay(info.linkUrl); break;

        default: break;
      }
    }
  });
});
