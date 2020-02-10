/* global chrome */

import { options, isCloning } from "./options-storage.js";
import { getCloneBounds } from "./getCloneBounds.js";
import { WindowID, IBounds, windowProperties, WindowType, IOptions } from "./api.js";

// Helper functions
// -----------------------------------------------------------------------------

const getSizeAndPos = (winKey: WindowID, displayBounds: IBounds) => {
  // Convert percentages to pixel values
  return {
    left: Math.round(
      options.getForWindow(winKey, "left") * displayBounds.width + displayBounds.left,
    ),
    top: Math.round(options.getForWindow(winKey, "top") * displayBounds.height + displayBounds.top),
    width: Math.round(options.getForWindow(winKey, "width") * displayBounds.width),
    height: Math.round(options.getForWindow(winKey, "height") * displayBounds.height),
  };
};

const resizeOriginalWindow = (originalWindow: chrome.windows.Window, displayBounds: IBounds) => {
  const vals = getSizeAndPos("original", displayBounds);
  return new Promise<chrome.windows.Window>(resolve => {
    chrome.windows.update(
      originalWindow.id,
      {
        width: vals.width,
        height: vals.height,
        left: vals.left,
        top: vals.top,
      },
      win => resolve(win),
    );
  });
};

const getWindowBounds = (win: chrome.windows.Window): IBounds => {
  return { left: win.left!, top: win.top!, width: win.width!, height: win.height! };
};

const getNewWindowBounds = (origWindow: chrome.windows.Window, displayBounds: IBounds) => {
  const cloneMode = options.get("cloneMode");
  const newBounds = isCloning()
    ? getCloneBounds(getWindowBounds(origWindow), displayBounds, cloneMode)
    : getSizeAndPos("new", displayBounds);

  // ensure all values are integers for Chrome APIs
  windowProperties.forEach(key => {
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
    return new Promise(resolve => {
      chrome.windows.create(opts, newWin => {
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

  return new Promise(resolve => {
    chrome.windows.create(opts, newWin => resolve([newWin!, tab]));
  });
};

const moveTabs = (tabs: chrome.tabs.Tab[], windowId: number, index: number) => {
  return new Promise<chrome.tabs.Tab[]>(resolve => {
    chrome.tabs.move(
      tabs.map(tab => tab.id!),
      { windowId, index },
      movedTabs => {
        const tabsArray = Array.isArray(movedTabs) ? movedTabs : [movedTabs];
        resolve(tabsArray);
      },
    );
  });
};

// Primary Functions
// -----------------------------------------------------------------------------

const tabToWindow = async (windowType: WindowType | undefined, moveToNextDisplay = false) => {
  const displaysPromise = new Promise<chrome.system.display.DisplayInfo[]>(resolve => {
    chrome.system.display.getInfo(displays => resolve(displays));
  });

  const currentWindowPromise = new Promise<chrome.windows.Window>((resolve, reject) => {
    chrome.windows.getCurrent({}, win => {
      if (chrome.runtime.lastError === undefined) {
        resolve(win);
      } else {
        reject(new Error(chrome.runtime.lastError.message));
      }
    });
  });

  const tabsPromise = new Promise<chrome.tabs.Tab[]>(resolve => {
    chrome.tabs.query(
      {
        currentWindow: true,
      },
      tabs => {
        if (tabs.length > 0) {
          resolve(tabs);
        }
      },
    );
  });

  const [displays, currentWindow, tabs] = await Promise.all([
    displaysPromise,
    currentWindowPromise,
    tabsPromise,
  ]);

  moveToNextDisplay = moveToNextDisplay && displays.length > 1;

  const calcOverlapArea = (display: chrome.system.display.DisplayInfo) => {
    const wl = currentWindow.left!;
    const wt = currentWindow.top!;
    const wr = currentWindow.left! + currentWindow.width!;
    const wb = currentWindow.top! + currentWindow.height!;

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
    origWindow = await resizeOriginalWindow(currentWindow, currentDisplay.workArea);
  }

  // move and resize new window
  const activeTab = tabs.find(tab => tab.active)!;

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
    : getNewWindowBounds(origWindow, currentDisplay.workArea);

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
  const otherTabs = tabs.filter(tab => tab !== movedTab && tab.highlighted);
  if (otherTabs.length > 0) {
    if (newWindowType === "normal") {
      // move all tabs at once
      const moveIndex = 1;
      const movedTabs = await moveTabs(otherTabs, newWin.id, moveIndex);

      // highlight tabs in new window
      const tabPromises = movedTabs.map(tab => {
        return new Promise<chrome.tabs.Tab>(resolve => {
          chrome.tabs.update(tab.id!, { highlighted: true }, () => resolve(tab));
        });
      });

      await Promise.all(tabPromises);
    } else if (newWindowType === "popup") {
      // can't move tabs to a popup window, so create individual ones
      const tabPromises = otherTabs.map(tab => {
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
};

const tabToWindowNormal = () => tabToWindow("normal");
const tabToWindowPopup = () => tabToWindow("popup");
const tabToNextDisplay = () => tabToWindow(undefined, true);
const tabToNextWindow = async () => {
  const tabsPromise = new Promise<chrome.tabs.Tab[]>(resolve => {
    chrome.tabs.query(
      {
        currentWindow: true,
        highlighted: true,
      },
      tabs => {
        if (tabs.length > 0) {
          resolve(tabs);
        }
      },
    );
  });

  const windowsPromise = new Promise<chrome.windows.Window[]>(resolve => {
    chrome.windows.getAll({}, windows => resolve(windows));
  });

  const [tabsToMove, windows] = await Promise.all([tabsPromise, windowsPromise]);
  const windowIndex = windows.findIndex(win => win.id === tabsToMove[0].windowId);
  if (windowIndex === -1) {
    return;
  }

  const nextWindowIndex = (windowIndex + 1) % windows.length;
  if (nextWindowIndex !== windowIndex) {
    const windowId = windows[nextWindowIndex].id;

    await new Promise(resolve => {
      chrome.windows.update(windowId, { focused: true }, win => resolve(win));
    });

    const tabsToUnhighlight = await new Promise<chrome.tabs.Tab[]>(resolve => {
      chrome.tabs.query({ windowId, highlighted: true }, tabs => {
        const tabsArray = Array.isArray(tabs) ? tabs : [tabs];
        resolve(tabsArray);
      });
    });

    const moveIndex = -1;
    const movedTabs = await moveTabs(tabsToMove, windowId, moveIndex);

    const highlightTabPromises = movedTabs.map((tab, i) => {
      return new Promise(tabResolve => {
        chrome.tabs.update(
          tab.id!,
          {
            highlighted: true,
            active: i === movedTabs.length - 1,
          },
          tab => tabResolve(tab),
        );
      });
    });

    await Promise.all(highlightTabPromises);

    tabsToUnhighlight.forEach(tab => {
      chrome.tabs.update(tab.id!, { highlighted: false });
    });
  }
};

const urlToWindow = (
  url: string,
  windowType: WindowType | undefined,
  moveToNextDisplay = false,
) => {
  chrome.tabs.create({ url, active: true }, () => {
    tabToWindow(windowType, moveToNextDisplay);
  });
};

const urlToWindowNormal = (url: string) => urlToWindow(url, "normal");
const urlToWindowPopup = (url: string) => urlToWindow(url, "popup");
const urlToNextDisplay = (url: string) => urlToWindow(url, undefined, true);
const urlToNextWindow = async (url: string) => {
  const currentWindowPromise = await new Promise<chrome.windows.Window>(resolve => {
    chrome.windows.getCurrent({}, window => resolve(window));
  });

  const windowsPromise = new Promise<chrome.windows.Window[]>(resolve => {
    chrome.windows.getAll({}, windows => resolve(windows));
  });

  const [currentWindow, allWindows] = await Promise.all([currentWindowPromise, windowsPromise]);

  const windowIndex = allWindows.findIndex(win => win.id === currentWindow.id);
  if (windowIndex === -1) {
    return;
  }

  const nextWindowIndex = (windowIndex + 1) % allWindows.length;
  if (nextWindowIndex === windowIndex) {
    return;
  }

  const windowId = allWindows[nextWindowIndex].id;

  const tabsToUnhighlight = await new Promise<chrome.tabs.Tab[]>(resolve => {
    chrome.tabs.query({ windowId, highlighted: true }, tabs => {
      const tabsArray = Array.isArray(tabs) ? tabs : [tabs];
      resolve(tabsArray);
    });
  });

  tabsToUnhighlight.forEach(tab => {
    chrome.tabs.update(tab.id!, { highlighted: false });
  });

  const opts = { windowId, url };
  chrome.tabs.create(opts);
};

// Chrome Listeners
// -----------------------------------------------------------------------------

chrome.storage.onChanged.addListener(changes => {
  const entries = Object.entries(changes) as Array<[keyof IOptions, chrome.storage.StorageChange]>;
  for (const [key, change] of entries) {
    options.set(key, change.newValue);
  }
});

chrome.commands.onCommand.addListener(command => {
  if (command === "01-tab-to-window-normal") {
    tabToWindowNormal();
  } else if (command === "02-tab-to-window-popup") {
    tabToWindowPopup();
  } else if (command === "03-tab-to-window-next") {
    tabToNextWindow();
  } else if (command === "04-tab-to-window-display") {
    tabToNextDisplay();
  }
});

chrome.runtime.onInstalled.addListener(details => {
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

chrome.browserAction.onClicked.addListener(() => {
  tabToWindow(options.get("menuButtonType"));
});

// Context Menu Creation
// Options
// -------
const createMenu = async () => {
  const commandsPromise = new Promise<chrome.commands.Command[]>(resolve => {
    chrome.commands.getAll(commands => resolve(commands));
  });

  const [, commands] = await Promise.all([options.loadPromise, commandsPromise]);
  chrome.contextMenus.removeAll();

  // Actions
  // -------
  const normalCommand = commands.find(cmd => cmd.name === "01-tab-to-window-normal");
  const normalShortcut = normalCommand === undefined ? "" : `(${normalCommand.shortcut})`;

  chrome.contextMenus.create({
    type: "normal",
    id: "tab to window",
    title: `Tab to ${normalCommand!.description} ${normalShortcut}`,
    contexts: ["browser_action", "page"],
  });

  const popupCommand = commands.find(cmd => cmd.name === "02-tab-to-window-popup");
  const popupShortcut = popupCommand === undefined ? "" : `(${popupCommand.shortcut})`;

  chrome.contextMenus.create({
    type: "normal",
    id: "tab to popup",
    title: `Tab to ${popupCommand!.description} ${popupShortcut}`,
    contexts: ["browser_action", "page"],
  });

  const nextCommand = commands.find(cmd => cmd.name === "03-tab-to-window-next");
  const nextShortcut = nextCommand === undefined ? "" : `(${nextCommand.shortcut})`;

  chrome.contextMenus.create({
    type: "normal",
    id: "tab to next",
    title: `Tab to ${nextCommand!.description} ${nextShortcut}`,
    contexts: ["browser_action", "page"],
  });

  const displayCommand = commands.find(cmd => cmd.name === "04-tab-to-window-display");
  const displayShortcut = displayCommand === undefined ? "" : `(${displayCommand.shortcut})`;

  chrome.contextMenus.create({
    type: "normal",
    id: "tab to display",
    title: `Tab to ${displayCommand!.description} ${displayShortcut}`,
    contexts: ["browser_action", "page"],
  });

  // Type
  chrome.contextMenus.create({
    type: "normal",
    id: "type parent",
    title: "Window Type",
    contexts: ["browser_action"],
  });

  chrome.contextMenus.create({
    type: "radio",
    id: "window option",
    parentId: "type parent",
    title: "Window",
    checked: options.get("menuButtonType") === "normal",
    contexts: ["browser_action"],
  });

  chrome.contextMenus.create({
    type: "radio",
    id: "popup option",
    parentId: "type parent",
    title: "Popup",
    checked: options.get("menuButtonType") === "popup",
    contexts: ["browser_action"],
  });

  // Focus
  chrome.contextMenus.create({
    type: "normal",
    id: "focus parent",
    title: "Focus",
    contexts: ["browser_action"],
  });

  chrome.contextMenus.create({
    type: "radio",
    id: "focus original option",
    parentId: "focus parent",
    title: "Original",
    checked: options.get("focus") === "original",
    contexts: ["browser_action"],
  });

  chrome.contextMenus.create({
    type: "radio",
    id: "focus new option",
    parentId: "focus parent",
    title: "New",
    checked: options.get("focus") === "new",
    contexts: ["browser_action"],
  });

  // links on page
  chrome.contextMenus.create({
    type: "normal",
    id: "link to window",
    title: "Link To New Window",
    contexts: ["link"],
  });

  chrome.contextMenus.create({
    type: "normal",
    id: "link to popup",
    title: "Link To New Popup",
    contexts: ["link"],
  });

  chrome.contextMenus.create({
    type: "normal",
    id: "link to next",
    title: "Link To Next Window",
    contexts: ["link"],
  });

  chrome.contextMenus.create({
    type: "normal",
    id: "link to display",
    title: "Link To Next Display",
    contexts: ["link"],
  });

  // Context Menu action
  chrome.contextMenus.onClicked.addListener(info => {
    // actions
    if (info.menuItemId === "tab to window") {
      tabToWindowNormal();
    } else if (info.menuItemId === "tab to popup") {
      tabToWindowPopup();
    } else if (info.menuItemId === "tab to next") {
      tabToNextWindow();
    } else if (info.menuItemId === "tab to display") {
      tabToNextDisplay();
    } else if (info.menuItemId === "link to window") {
      urlToWindowNormal(info.linkUrl!);
    } else if (info.menuItemId === "link to popup") {
      urlToWindowPopup(info.linkUrl!);
    } else if (info.menuItemId === "link to next") {
      urlToNextWindow(info.linkUrl!);
    } else if (info.menuItemId === "link to display") {
      urlToNextDisplay(info.linkUrl!);
    }

    // options
    else if (info.menuItemId === "window option") {
      options.set("menuButtonType", "normal");
      options.save();
    } else if (info.menuItemId === "popup option") {
      options.set("menuButtonType", "popup");
      options.save();
    } else if (info.menuItemId === "focus original option") {
      options.set("focus", "original");
      options.save();
    } else if (info.menuItemId === "focus new option") {
      options.set("focus", "new");
      options.save();
    }
  });
};

createMenu();
