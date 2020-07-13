import {
  COMMAND_DISPLAY,
  COMMAND_NEXT,
  COMMAND_NORMAL,
  COMMAND_POPUP,
  COMMAND_PREVIOUS,
  IOptions,
  MENU_FOCUS_NEW_OPTION_ID,
  MENU_FOCUS_ORIGINAL_OPTION_ID,
  MENU_FOCUS_PARENT_ID,
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
  MENU_TYPE_PARENT_ID,
  MENU_WINDOW_OPTION_ID,
  WindowType,
} from "./api.js";
import { doBackgroundAction } from "./doBackgroundAction.js";
import { moveTabs } from "./moveTabs.js";
import { getOptions } from "./options-storage.js";
import { tabToWindow } from "./tabToWindow.js";

// Primary Functions
// -----------------------------------------------------------------------------

const getNeighbouringWindowId = async (currentWindowId: number, distance: number) => {
  const windows = await new Promise<chrome.windows.Window[]>((resolve) => {
    chrome.windows.getAll({ windowTypes: ["normal"] }, (windows) => resolve(windows));
  });

  const currentIndex = windows.findIndex((win) => win.id === currentWindowId);
  if (currentIndex === -1) {
    return;
  }

  const i = currentIndex + distance;
  const max = windows.length;
  const nextIndex = ((i % max) + max) % max; // wrapping in either direction
  if (nextIndex === currentIndex) {
    return undefined;
  }

  return windows[nextIndex].id;
};

const getTabsToUnhighlight = (windowId: number) => {
  return new Promise<chrome.tabs.Tab[]>((resolve) => {
    chrome.tabs.query({ windowId, highlighted: true }, (tabs) => {
      const tabsArray = Array.isArray(tabs) ? tabs : [tabs];
      resolve(tabsArray);
    });
  });
};

const unhighlightTabs = (tabs: chrome.tabs.Tab[]) => {
  for (const tab of tabs) {
    if (tab.id !== undefined) {
      chrome.tabs.update(tab.id!, { highlighted: false });
    }
  }
};

const tabToWindowNormal = () => tabToWindow("normal");
const tabToWindowPopup = () => tabToWindow("popup");
const tabToNextDisplay = () => tabToWindow(undefined, true);
const tabToNeighbouringWindow = (windowDistance: number) => {
  doBackgroundAction(async () => {
    const tabsToMove = await new Promise<chrome.tabs.Tab[]>((resolve) =>
      chrome.tabs.query({ currentWindow: true, highlighted: true }, (tabs) => resolve(tabs)),
    );

    if (tabsToMove.length === 0) {
      return;
    }

    const nextWindowId = await getNeighbouringWindowId(tabsToMove[0].windowId, windowDistance);
    if (nextWindowId === undefined) {
      return;
    }

    // focus on next window
    await new Promise((resolve) => {
      chrome.windows.update(nextWindowId, { focused: true }, (win) => resolve(win));
    });

    // store tabs to unhighlight
    const tabsToUnhighlight = await getTabsToUnhighlight(nextWindowId);

    // move and highlight selected tabs
    const moveIndex = -1;
    const movedTabs = await moveTabs(tabsToMove, nextWindowId, moveIndex);
    await Promise.all(
      movedTabs.map((tab, i) => {
        return new Promise((tabResolve) => {
          chrome.tabs.update(
            tab.id!,
            { highlighted: true, active: i === movedTabs.length - 1 },
            (tab) => tabResolve(tab),
          );
        });
      }),
    );

    // unlight old tabs
    unhighlightTabs(tabsToUnhighlight);
  });
};

const urlToWindow = (
  url: string,
  windowType: WindowType | undefined,
  moveToNextDisplay = false,
) => {
  doBackgroundAction(() => {
    chrome.tabs.create({ url, active: true }, () => {
      tabToWindow(windowType, moveToNextDisplay);
    });
  });
};

const urlToWindowNormal = (url: string) => urlToWindow(url, "normal");
const urlToWindowPopup = (url: string) => urlToWindow(url, "popup");
const urlToNextDisplay = (url: string) => urlToWindow(url, undefined, true);
const urlToNeighbouringWindow = (url: string, windowDistance: number) => {
  doBackgroundAction(async () => {
    const currentWindow = await new Promise<chrome.windows.Window>((resolve) => {
      chrome.windows.getCurrent({}, (window) => resolve(window));
    });

    const nextWindowId = await getNeighbouringWindowId(currentWindow.id, windowDistance);
    if (nextWindowId === undefined) {
      return;
    }

    unhighlightTabs(await getTabsToUnhighlight(nextWindowId));

    const opts = { windowId: nextWindowId, url };
    chrome.tabs.create(opts);
  });
};

// Chrome Listeners
// -----------------------------------------------------------------------------

chrome.storage.onChanged.addListener(async (changes) => {
  const update: Partial<IOptions> = {};

  const entries = Object.entries(changes) as Array<[keyof IOptions, chrome.storage.StorageChange]>;
  for (const [key, change] of entries) {
    update[key] = change.newValue;
  }

  (await getOptions()).update(update);
});

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

chrome.runtime.onInstalled.addListener((details) => {
  const previousMajorVersion = parseInt(details.previousVersion ?? "0", 10);
  const showUpdate =
    details.reason === "install" || (details.reason === "update" && previousMajorVersion < 3);

  if (showUpdate) {
    const url = "https://acarabott.github.io/tabToWindow";
    chrome.tabs.create({ url, active: true });
  }
});

// Extension Button
// -----------------------------------------------------------------------------

chrome.browserAction.onClicked.addListener(async () => {
  tabToWindow((await getOptions()).get("menuButtonType"));
});

// Context Menu Creation
// Options
// -------
const createMenu = async () => {
  const optionsPromise = getOptions();

  const commandsPromise = new Promise<chrome.commands.Command[]>((resolve) => {
    chrome.commands.getAll((commands) => resolve(commands));
  });

  const [options, commands] = await Promise.all([optionsPromise, commandsPromise]);
  chrome.contextMenus.removeAll();

  // Actions
  // -------
  const actionDefs = [
    { commandName: COMMAND_NORMAL, menuId: MENU_TAB_TO_WINDOW_ID },
    { commandName: COMMAND_POPUP, menuId: MENU_TAB_TO_POPUP_ID },
    { commandName: COMMAND_NEXT, menuId: MENU_TAB_TO_NEXT_ID },
    { commandName: COMMAND_PREVIOUS, menuId: MENU_TAB_TO_PREVIOUS_ID },
    { commandName: COMMAND_DISPLAY, menuId: MENU_TAB_TO_DISPLAY_ID },
  ];

  for (const { commandName: commandId, menuId } of actionDefs) {
    const command = commands.find((cmd) => cmd.name === commandId);
    if (command !== undefined) {
      chrome.contextMenus.create({
        type: "normal",
        id: menuId,
        title: `Tab to ${command.description} ${command.shortcut}`,
        contexts: ["browser_action", "page"],
      });
    }
  }

  // Type
  chrome.contextMenus.create({
    type: "normal",
    id: MENU_TYPE_PARENT_ID,
    title: "Window Type",
    contexts: ["browser_action"],
  });

  chrome.contextMenus.create({
    type: "radio",
    id: MENU_WINDOW_OPTION_ID,
    parentId: MENU_TYPE_PARENT_ID,
    title: "Window",
    checked: options.get("menuButtonType") === "normal",
    contexts: ["browser_action"],
  });

  chrome.contextMenus.create({
    type: "radio",
    id: MENU_POPUP_OPTION_ID,
    parentId: MENU_TYPE_PARENT_ID,
    title: "Popup",
    checked: options.get("menuButtonType") === "popup",
    contexts: ["browser_action"],
  });

  // Focus
  chrome.contextMenus.create({
    type: "normal",
    id: MENU_FOCUS_PARENT_ID,
    title: "Focus",
    contexts: ["browser_action"],
  });

  chrome.contextMenus.create({
    type: "radio",
    id: MENU_FOCUS_ORIGINAL_OPTION_ID,
    parentId: MENU_FOCUS_PARENT_ID,
    title: "Original",
    checked: options.get("focus") === "original",
    contexts: ["browser_action"],
  });

  chrome.contextMenus.create({
    type: "radio",
    id: MENU_FOCUS_NEW_OPTION_ID,
    parentId: MENU_FOCUS_PARENT_ID,
    title: "New",
    checked: options.get("focus") === "new",
    contexts: ["browser_action"],
  });

  // links on page
  const linkDefs = [
    { id: MENU_LINK_TO_WINDOW_ID, title: "Link To New Window" },
    { id: MENU_LINK_TO_POPUP_ID, title: "Link To New Popup" },
    { id: MENU_LINK_TO_NEXT_ID, title: "Link To Next Window" },
    { id: MENU_LINK_TO_PREVIOUS_ID, title: "Link To Previous Window" },
    { id: MENU_LINK_TO_DISPLAY_ID, title: "Link To Next Display" },
  ];

  for (const { id, title } of linkDefs) {
    chrome.contextMenus.create({
      type: "normal",
      id,
      title,
      contexts: ["link"],
    });
  }

  // Context Menu action
  chrome.contextMenus.onClicked.addListener((info) => {
    // actions
    if (info.menuItemId === MENU_TAB_TO_WINDOW_ID) {
      tabToWindowNormal();
    } else if (info.menuItemId === MENU_TAB_TO_POPUP_ID) {
      tabToWindowPopup();
    } else if (info.menuItemId === MENU_TAB_TO_NEXT_ID) {
      tabToNeighbouringWindow(1);
    } else if (info.menuItemId === MENU_TAB_TO_PREVIOUS_ID) {
      tabToNeighbouringWindow(-1);
    } else if (info.menuItemId === MENU_TAB_TO_DISPLAY_ID) {
      tabToNextDisplay();
    } else if (info.menuItemId === MENU_LINK_TO_WINDOW_ID && info.linkUrl !== undefined) {
      urlToWindowNormal(info.linkUrl);
    } else if (info.menuItemId === MENU_LINK_TO_POPUP_ID && info.linkUrl !== undefined) {
      urlToWindowPopup(info.linkUrl);
    } else if (info.menuItemId === MENU_LINK_TO_NEXT_ID && info.linkUrl !== undefined) {
      urlToNeighbouringWindow(info.linkUrl, 1);
    } else if (info.menuItemId === MENU_LINK_TO_PREVIOUS_ID && info.linkUrl !== undefined) {
      urlToNeighbouringWindow(info.linkUrl, -1);
    } else if (info.menuItemId === MENU_LINK_TO_DISPLAY_ID && info.linkUrl !== undefined) {
      urlToNextDisplay(info.linkUrl);
    }

    // options
    else if (info.menuItemId === MENU_WINDOW_OPTION_ID) {
      options.update({ menuButtonType: "normal" });
    } else if (info.menuItemId === MENU_POPUP_OPTION_ID) {
      options.update({ menuButtonType: "popup" });
    } else if (info.menuItemId === MENU_FOCUS_ORIGINAL_OPTION_ID) {
      options.update({ focus: "original" });
    } else if (info.menuItemId === MENU_FOCUS_NEW_OPTION_ID) {
      options.update({ focus: "new" });
    }
  });
};

createMenu();
