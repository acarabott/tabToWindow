import {
  COMMAND_DISPLAY,
  COMMAND_NEXT,
  COMMAND_NORMAL,
  COMMAND_POPUP,
  COMMAND_PREVIOUS,
  IBounds,
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
  Options,
  WindowID,
  windowProperties,
  WindowType,
} from "./api.js";
import { getCloneBounds } from "./getCloneBounds.js";
import { getOptions, getStorageWindowPropKey } from "./options-storage.js";

// Helper functions
// -----------------------------------------------------------------------------

/**
 * Convert normalised values into pixel values
 */
const getSizeAndPos = async (options: Options, winKey: WindowID, displayBounds: IBounds) => {
  return {
    left: Math.round(
      options.get(getStorageWindowPropKey(winKey, "left")) * displayBounds.width +
        displayBounds.left,
    ),
    top: Math.round(
      options.get(getStorageWindowPropKey(winKey, "top")) * displayBounds.height +
        displayBounds.top,
    ),
    width: Math.round(options.get(getStorageWindowPropKey(winKey, "width")) * displayBounds.width),
    height: Math.round(
      options.get(getStorageWindowPropKey(winKey, "height")) * displayBounds.height,
    ),
  };
};

const getWindowBounds = (win: chrome.windows.Window): IBounds => {
  return {
    left: win.left ?? 0,
    top: win.top ?? 0,
    width: win.width ?? screen.availWidth,
    height: win.height ?? screen.availHeight,
  };
};

const getNewWindowBounds = async (
  options: Options,
  origWindow: chrome.windows.Window,
  displayBounds: IBounds,
) => {
  const newBounds = options.isCloneEnabled
    ? getCloneBounds(getWindowBounds(origWindow), displayBounds, options.get("cloneMode"))
    : await getSizeAndPos(options, "new", displayBounds);

  // ensure all values are integers for Chrome APIs
  windowProperties.forEach((key) => {
    newBounds[key] = Math.round(newBounds[key]);
  });

  return newBounds;
};

const createNewWindow = (
  tab: chrome.tabs.Tab,
  windowType: WindowType,
  windowBounds: IBounds,
  isFullscreen: boolean,
  isFocused: boolean,
): Promise<[chrome.windows.Window, chrome.tabs.Tab]> => {
  // new window options
  const opts: chrome.windows.CreateData = {
    tabId: tab.id,
    type: windowType,
    focused: isFocused,
    incognito: tab.incognito,
    ...windowBounds,
  };

  if (isFullscreen) {
    return new Promise((resolve) => {
      chrome.windows.create(opts, (newWin) => {
        if (newWin !== undefined) {
          // this timeout is gross but necessary.
          // updating immediately fails
          setTimeout(() => {
            chrome.windows.update(newWin.id, { state: "fullscreen" }, () => {
              resolve([newWin, tab]);
            });
          }, 1000);
        }
      });
    });
  }

  return new Promise((resolve, reject) => {
    chrome.windows.create(opts, (newWin) => {
      if (newWin !== undefined) {
        resolve([newWin, tab]);
      } else {
        reject("Could not create new window");
      }
    });
  });
};

const moveTabs = (tabs: chrome.tabs.Tab[], windowId: number, index: number) => {
  return new Promise<chrome.tabs.Tab[]>((resolve) => {
    const tabIds = tabs.reduce(
      (accum, tab) => (tab.id === undefined ? accum : [...accum, tab.id]),
      [] as number[],
    );

    chrome.tabs.move(tabIds, { windowId, index }, (movedTabs) =>
      resolve(Array.isArray(movedTabs) ? movedTabs : [movedTabs]),
    );
  });
};

/** Helper to perform actions once the background page has been activated
 * Without this, the first action (e.g. keyboard shortcut) will only wake up
 * the background page, and not perform the action
 */
const doBackgroundAction = (action: () => void) => {
  chrome.runtime.getBackgroundPage((_backgroundPage) => {
    action();
  });
};

// Primary Functions
// -----------------------------------------------------------------------------

const tabToWindow = async (windowType: WindowType | undefined, moveToNextDisplay = false) => {
  doBackgroundAction(async () => {
    const displaysPromise = new Promise<chrome.system.display.DisplayInfo[]>((resolve) => {
      chrome.system.display.getInfo((displays) => resolve(displays));
    });

    const currentWindowPromise = new Promise<chrome.windows.Window>((resolve, reject) => {
      chrome.windows.getCurrent({}, (win) => {
        if (chrome.runtime.lastError === undefined) {
          resolve(win);
        } else {
          reject(new Error(chrome.runtime.lastError.message));
        }
      });
    });

    const tabsPromise = new Promise<chrome.tabs.Tab[]>((resolve) => {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          resolve(tabs);
        }
      });
    });

    const [displays, currentWindow, tabs] = await Promise.all([
      displaysPromise,
      currentWindowPromise,
      tabsPromise,
    ]);

    moveToNextDisplay = moveToNextDisplay && displays.length > 1;

    const calcOverlapArea = (display: chrome.system.display.DisplayInfo) => {
      const wl = currentWindow.left ?? 0;
      const wt = currentWindow.top ?? 0;
      const wr = wl + (currentWindow.width ?? screen.availWidth);
      const wb = wt + (currentWindow.height ?? screen.availWidth);

      const dl = display.bounds.left;
      const dt = display.bounds.top;
      const dr = display.bounds.left + display.bounds.width;
      const db = display.bounds.top + display.bounds.height;

      return (
        Math.max(0, Math.min(wr, dr) - Math.max(wl, dl)) *
        Math.max(0, Math.min(wb, db) - Math.max(wt, dt))
      );
    };

    const currentDisplay = displays.reduce((accum, current) => {
      const accumOverlap = calcOverlapArea(accum);
      const curOverlap = calcOverlapArea(current);
      return curOverlap > accumOverlap ? current : accum;
    }, displays[0]);

    const options = await getOptions();

    const isFullscreen = options.get("copyFullscreen") && currentWindow.state === "fullscreen";
    const isFocused = options.get("focus") === "new";

    // (maybe) move and resize original window
    let origWindow = currentWindow;
    const destroyingOriginalWindow = tabs.length === 1;
    if (
      options.get("resizeOriginal") &&
      !isFullscreen &&
      !destroyingOriginalWindow &&
      !moveToNextDisplay
    ) {
      const vals = await getSizeAndPos(options, "original", currentDisplay.workArea);
      origWindow = await new Promise<chrome.windows.Window>((resolve) => {
        chrome.windows.update(
          origWindow.id,
          {
            width: vals.width,
            height: vals.height,
            left: vals.left,
            top: vals.top,
            state: "normal",
          },
          (win) => resolve(win),
        );
      });
    }

    // move and resize new window
    const activeTab = tabs.find((tab) => tab.active)!;

    const getNextDisplay = () => {
      const currentIndex = displays.indexOf(currentDisplay);
      const nextIndex = (currentIndex + 1) % displays.length;
      return displays[nextIndex];
    };

    // if it's just one tab, the only use case is to convert it into a popup
    // window, so just leave it where it was
    const windowBounds = moveToNextDisplay
      ? getNextDisplay().bounds
      : tabs.length === 1
      ? getWindowBounds(origWindow)
      : await getNewWindowBounds(options, origWindow, currentDisplay.workArea);

    const newWindowType =
      windowType === undefined ? (currentWindow.type === "popup" ? "popup" : "normal") : windowType;

    const [newWin, movedTab] = await createNewWindow(
      activeTab,
      newWindowType,
      windowBounds,
      isFullscreen,
      isFocused,
    );

    // move other highlighted tabs
    const otherTabs = tabs.filter((tab) => tab !== movedTab && tab.highlighted);
    if (otherTabs.length > 0) {
      if (newWindowType === "normal") {
        // move all tabs at once
        const moveIndex = 1;
        const movedTabs = await moveTabs(otherTabs, newWin.id, moveIndex);

        // highlight tabs in new window
        const tabPromises = movedTabs.map((tab) => {
          return new Promise<chrome.tabs.Tab>((resolve) => {
            chrome.tabs.update(tab.id!, { highlighted: true }, () => resolve(tab));
          });
        });

        await Promise.all(tabPromises);
      } else if (newWindowType === "popup") {
        // can't move tabs to a popup window, so create individual ones
        const tabPromises = otherTabs.map((tab) => {
          return createNewWindow(
            tab,
            newWindowType,
            getWindowBounds(newWin),
            isFullscreen,
            isFocused,
          );
        });
        await Promise.all(tabPromises);
      }
    }

    // focus on original window if specified, and it still exists
    // (popping a single tab will destroy the original window)
    if (options.get("focus") === "original" && !destroyingOriginalWindow) {
      chrome.windows.get(currentWindow.id, {}, () => {
        if (chrome.runtime.lastError === undefined) {
          chrome.windows.update(currentWindow.id, { focused: true });
        } else {
          throw new Error(chrome.runtime.lastError.message);
        }
      });
    }
  });
};

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
