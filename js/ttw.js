/* global chrome */

import { options, isCloning } from "./options-storage.js";
import { getCloneBounds } from "./clone.js";

// Session storage interface
// -----------------------------------------------------------------------------

const originWindowCache = {
  getOriginId(id) {
    return `popOrigin_${id}`;
  },

  has(tab) {
    return sessionStorage.hasOwnProperty(originWindowCache.getOriginId(tab.id));
  },

  set(tab, win) {
    sessionStorage[originWindowCache.getOriginId(tab.id)] = win.id;
  },

  get(tab) {
    return parseInt(sessionStorage[originWindowCache.getOriginId(tab.id)], 10);
  },

  delete(tab) {
    sessionStorage.removeItem(originWindowCache.getOriginId(tab.id));
  }
};

// Helper functions
// -----------------------------------------------------------------------------

function getSizeAndPos(winKey, displayBounds) {
  // Convert percentages to pixel values
  const values = {};
  ["left", "top", "width", "height"].forEach(propKey => {
    values[propKey] = options.getForWindow(winKey, propKey);
  });
  return {
    left:   Math.round(values.left   * displayBounds.width  + displayBounds.left),
    top:    Math.round(values.top    * displayBounds.height + displayBounds.top),
    width:  Math.round(values.width  * displayBounds.width),
    height: Math.round(values.height * displayBounds.height)
  };
}


function resizeOriginalWindow(originalWindow, displayBounds) {
  const vals = getSizeAndPos("original", displayBounds);
  return new Promise(resolve => {
    chrome.windows.update(originalWindow.id, {
      width:  vals.width,
      height: vals.height,
      left:   vals.left,
      top:    vals.top
    }, win => resolve(win));
  });
}


function getWindowBounds(win) {
  return { left: win.left, top: win.top, width: win.width, height: win.height };
}


function getNewWindowBounds(origWindow, displayBounds) {
  const cloneMode = options.get("cloneMode");
  const newBounds = isCloning()
    ? getCloneBounds(getWindowBounds(origWindow), displayBounds, cloneMode)
    : getSizeAndPos("new", displayBounds);


  // ensure all values are integers for Chrome APIs
  ["width", "height", "left", "top"].forEach(key => {
    newBounds[key] = Math.round(newBounds[key]);
  });

  return newBounds;
}


function createNewWindow(tab, windowType, windowBounds, isFullscreen, isFocused) {
  // new window options
  const opts = {
    tabId:     tab.id,
    type:      windowType,
    focused:   isFocused,
    incognito: tab.incognito,
  };

  Object.keys(windowBounds).forEach(key => opts[key] = windowBounds[key]);

  if (isFullscreen) {
    return new Promise(resolve => {
      chrome.windows.create(opts, newWin => {
        // this timeout is gross but necessary.
        // updating immediately fails
        setTimeout(() => {
          chrome.windows.update(newWin.id, { state: "fullscreen" }, () => {
            resolve([newWin, tab]);
          });
        }, 1000);
      });
    });
  }

  return new Promise(resolve => {
    chrome.windows.create(opts, newWin => resolve([newWin, tab]));
  });
}

function moveTabs(tabs, windowId, index) {
  return new Promise(resolve => {
    chrome.tabs.move(tabs.map(tab => tab.id), {
      windowId,
      index
    }, movedTabs => {
      const tabsArray = Array.isArray(movedTabs) ? movedTabs : [movedTabs];
      resolve(tabsArray);
    });
  });
}

// Primary Functions
// -----------------------------------------------------------------------------

async function tabToWindow(windowType, moveToNextDisplay=false) {
  const displaysPromise = new Promise(resolve => {
    chrome.system.display.getInfo(displays => resolve(displays));
  });

  const currentWindowPromise = new Promise((resolve, reject) => {
    chrome.windows.getCurrent({}, win => {
      if (chrome.runtime.lastError === undefined) {
        resolve(win);
      }
      else {
        reject(new Error(chrome.runtime.lastError.message));
      }
    });
  });

  const tabsPromise = new Promise(resolve => {
    chrome.tabs.query({
      currentWindow: true,
    }, tabs => {
      if (tabs.length > 0) { resolve(tabs); }
    });
  });

  const promises = [displaysPromise, currentWindowPromise, tabsPromise];

  const [displays, currentWindow, tabs] = await Promise.all(promises);

  moveToNextDisplay = moveToNextDisplay && displays.length > 1;

  function calcOverlapArea(display) {
    const wl = currentWindow.left;
    const wt = currentWindow.top;
    const wr = currentWindow.left + currentWindow.width;
    const wb = currentWindow.top + currentWindow.height;

    const dl = display.bounds.left;
    const dt = display.bounds.top;
    const dr = display.bounds.left + display.bounds.width;
    const db = display.bounds.top + display.bounds.height;

    return Math.max(0, Math.min(wr, dr) - Math.max(wl, dl)) *
           Math.max(0, Math.min(wb, db) - Math.max(wt, dt));
  }

  const currentDisplay = displays.reduce((accum, current) => {
    const accumOverlap = calcOverlapArea(accum);
    const curOverlap = calcOverlapArea(current);
    return curOverlap > accumOverlap ? current : accum;
  }, displays[0]);

  const isFullscreen = options.get("copyFullscreen") &&
                       currentWindow.state === "fullscreen";
  const isFocused = options.get("focus") === "new";


  // (maybe) move and resize original window
  let origWindow = currentWindow;
  const destroyingOriginalWindow = tabs.length === 1;
  if (options.get("resizeOriginal") &&
      !isFullscreen &&
      !destroyingOriginalWindow &&
      !moveToNextDisplay) {
    origWindow = await resizeOriginalWindow(currentWindow, currentDisplay.workArea);
  }

  // move and resize new window
  const activeTab = tabs.find(tab => tab.active);

  function getNextDisplay() {
    const currentIndex = displays.indexOf(currentDisplay);
    const nextIndex = (currentIndex + 1) % displays.length;
    return displays[nextIndex];
  }

  // if it's just one tab, the only use case is to convert it into a popup
  // window, so just leave it where it was
  const windowBounds = moveToNextDisplay ? getNextDisplay().bounds
                     : tabs.length === 1 ? getWindowBounds(origWindow)
                     : getNewWindowBounds(origWindow, currentDisplay.workArea);

  if (windowType === undefined) { windowType = currentWindow.type; }
  const [newWin, movedTab] = await createNewWindow(activeTab, windowType,
    windowBounds, isFullscreen, isFocused);

  // move highlighted tabs
  // save parent id in case we want to pop in
  if (!destroyingOriginalWindow) {
    originWindowCache.set(movedTab, currentWindow);
  }

  // move other highlighted tabs
  const otherTabs = tabs.filter(tab => tab !== movedTab && tab.highlighted);
  if (otherTabs.length > 0) {
    otherTabs.forEach(tab => originWindowCache.set(tab, currentWindow));

    if (windowType === "normal") {
      // move all tabs at once
      const moveIndex = 1;
      const movedTabs = await moveTabs(otherTabs, newWin.id, moveIndex);

      // highlight tabs in new window
      const tabPromises = movedTabs.map(tab => {
        return new Promise(resolve => {
          chrome.tabs.update(tab.id, { highlighted: true }, resolve(tab));
        });
      });

      await Promise.all(tabPromises);
    }
    else if (windowType === "popup") {
      // can't move tabs to a popup window, so create individual ones
      const tabPromises = otherTabs.map(tab => {
        return createNewWindow(tab, windowType, getWindowBounds(newWin),
          isFullscreen, isFocused);
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
      }
      else {
        throw new Error(chrome.runtime.lastError.message);
      }
    });
  }
}

function tabToWindowNormal() { tabToWindow("normal");        }
function tabToWindowPopup()  { tabToWindow("popup");         }
function tabToNextDisplay()  { tabToWindow(undefined, true); }
async function tabToNextWindow() {
  const tabsPromise = new Promise(resolve => {
    chrome.tabs.query({
      currentWindow: true,
      highlighted: true,
    }, tabs => {
      if (tabs.length > 0) { resolve(tabs); }
    });
  });

  const windowsPromise = new Promise(resolve => {
    chrome.windows.getAll({}, windows => resolve(windows));
  });

  const [tabsToMove, windows] = await Promise.all([tabsPromise, windowsPromise]);
  const windowIndex = windows.findIndex(win => win.id === tabsToMove[0].windowId);
  if (windowIndex === -1) { return; }

  const nextWindowIndex = (windowIndex + 1) % windows.length;
  if (nextWindowIndex !== windowIndex) {
    const windowId = windows[nextWindowIndex].id;

    await new Promise(resolve => {
      chrome.windows.update(windowId, { focused: true }, win => resolve(win));
    });

    const tabsToUnhighlight = await new Promise(resolve => {
      chrome.tabs.query({ windowId, highlighted: true }, tabs => {
        const tabsArray = Array.isArray(tabs) ? tabs : [tabs];
        resolve(tabsArray);
      });
    });

    const moveIndex = -1;
    const movedTabs = await moveTabs(tabsToMove, windowId, moveIndex);

    const highlightTabPromises = movedTabs.map((tab, i) => {
      return new Promise(tabResolve => {
        chrome.tabs.update(tab.id, {
          highlighted: true,
          active: i === movedTabs.legth - 1
        }, tab => tabResolve(tab));
      });
    });

    await Promise.all(highlightTabPromises);

    tabsToUnhighlight.forEach(tab => {
      chrome.tabs.update(tab.id, { highlighted: false });
    });
  }
}

function urlToWindow(url, windowType, moveToNextDisplay=false) {
  chrome.tabs.create({ url, active: true }, () => {
    tabToWindow(windowType, moveToNextDisplay);
  });
}

function urlToWindowNormal(url) { urlToWindow(url, "normal");        }
function urlToWindowPopup(url)  { urlToWindow(url, "popup");         }
function urlToNextDisplay(url)  { urlToWindow(url, undefined, true); }
async function urlToNextWindow(url) {
  const currentWindowPromise = await new Promise(resolve => {
    chrome.windows.getCurrent({}, windows => resolve(windows));
  });

  const windowsPromise = new Promise(resolve => {
    chrome.windows.getAll({}, windows => resolve(windows));
  });

  const promises = [currentWindowPromise, windowsPromise];
  const [currentWindow, allWindows] = await Promise.all(promises);

  const windowIndex = allWindows.findIndex(win => win.id === currentWindow.id);
  if (windowIndex === -1) { return; }

  const nextWindowIndex = (windowIndex + 1) % allWindows.length;
  if (nextWindowIndex === windowIndex) { return; }

  const windowId = allWindows[nextWindowIndex].id;

  const tabsToUnhighlight = await new Promise(resolve => {
    chrome.tabs.query({ windowId, highlighted: true }, tabs => {
      const tabsArray = Array.isArray(tabs) ? tabs : [tabs];
      resolve(tabsArray);
    });
  });
  tabsToUnhighlight.forEach(tab => {
    chrome.tabs.update(tab.id, { highlighted: false });
  });

  const opts = { windowId, url };
  chrome.tabs.create(opts);
}


// Chrome Listeners
// -----------------------------------------------------------------------------

chrome.storage.onChanged.addListener(changes => {
  Object.entries(changes).forEach(([k, v]) => options.set(k, v.newValue));
});

chrome.commands.onCommand.addListener(command => {
       if (command === "01-tab-to-window-normal")  { tabToWindowNormal(); }
  else if (command === "02-tab-to-window-popup")   { tabToWindowPopup();  }
  else if (command === "03-tab-to-window-next")    { tabToNextWindow();   }
  else if (command === "04-tab-to-window-display") { tabToNextDisplay();  }
});

chrome.runtime.onInstalled.addListener(details => {
  const previousMajorVersion = parseInt(details.previousVersion, 10);
  const showUpdate = details.reason === "install" ||
                     (details.reason === "update" && previousMajorVersion < 3);

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
async function createMenu(masterMenuContexts) {
  const commandsPromise = new Promise(resolve => {
    chrome.commands.getAll(commands => resolve(commands));
  });

  const [, commands] = await Promise.all([options.loadPromise, commandsPromise]);
  chrome.contextMenus.removeAll();

  // Actions
  // -------
  const normalCommand = commands.find(cmd => cmd.name === "01-tab-to-window-normal");
  const normalShortcut = normalCommand === undefined
    ? ""
    : `(${normalCommand.shortcut})`;

  chrome.contextMenus.create({
    type:     "normal",
    id:       "tab to window",
    title:    `Tab to ${normalCommand.description} ${normalShortcut}`,
    contexts: masterMenuContexts,
  });

  const popupCommand = commands.find(cmd => cmd.name === "02-tab-to-window-popup");
  const popupShortcut = popupCommand === undefined
    ? ""
    : `(${popupCommand.shortcut})`;

  chrome.contextMenus.create({
    type:     "normal",
    id:       "tab to popup",
    title:    `Tab to ${popupCommand.description} ${popupShortcut}`,
    contexts: masterMenuContexts,
  });

  const nextCommand = commands.find(cmd => cmd.name === "03-tab-to-window-next");
  const nextShortcut = nextCommand === undefined
    ? ""
    : `(${nextCommand.shortcut})`;

  chrome.contextMenus.create({
    type:     "normal",
    id:       "tab to next",
    title:    `Tab to ${nextCommand.description} ${nextShortcut}`,
    contexts: masterMenuContexts,
  });

  const displayCommand = commands.find(cmd => cmd.name === "04-tab-to-window-display");
  const displayShortcut = displayCommand === undefined
    ? ""
    : `(${displayCommand.shortcut})`;

  chrome.contextMenus.create({
    type:     "normal",
    id:       "tab to display",
    title:    `Tab to ${displayCommand.description} ${displayShortcut}`,
    contexts: masterMenuContexts,
  });


  // Type
  chrome.contextMenus.create({
    type:  "normal",
    id:    "type parent",
    title: "Window Type",
    contexts: ["browser_action"]
  });

  chrome.contextMenus.create({
    type:     "radio",
    id:       "window option",
    parentId: "type parent",
    title:    "Window",
    checked:  options.get("menuButtonType") === "normal",
    contexts: ["browser_action"],
  });

  chrome.contextMenus.create({
    type:     "radio",
    id:       "popup option",
    parentId: "type parent",
    title:    "Popup",
    checked:  options.get("menuButtonType") === "popup",
    contexts: ["browser_action"],
  });

  // Focus
  chrome.contextMenus.create({
    type:  "normal",
    id:    "focus parent",
    title: "Focus",
    contexts: ["browser_action"]
  });

  chrome.contextMenus.create({
    type:     "radio",
    id:       "focus original option",
    parentId: "focus parent",
    title:    "Original",
    checked:  options.get("focus") === "original",
    contexts: ["browser_action"],
  });

  chrome.contextMenus.create({
    type:     "radio",
    id:       "focus new option",
    parentId: "focus parent",
    title:    "New",
    checked:  options.get("focus") === "new",
    contexts: ["browser_action"],
  });


  // links on page
  chrome.contextMenus.create({
    type:     "normal",
    id:       "link to window",
    title:    "Link To New Window",
    contexts: ["link"]
  });

  chrome.contextMenus.create({
    type:     "normal",
    id:       "link to popup",
    title:    "Link To New Popup",
    contexts: ["link"]
  });

  chrome.contextMenus.create({
    type:     "normal",
    id:       "link to next",
    title:    "Link To Next Window",
    contexts: ["link"]
  });

  chrome.contextMenus.create({
    type:     "normal",
    id:       "link to display",
    title:    "Link To Next Display",
    contexts: ["link"]
  });

  // Context Menu action
  chrome.contextMenus.onClicked.addListener(info => {
    // actions
         if (info.menuItemId === "tab to window")   { tabToWindowNormal(); }
    else if (info.menuItemId === "tab to popup")    { tabToWindowPopup();  }
    else if (info.menuItemId === "tab to next")     { tabToNextWindow();   }
    else if (info.menuItemId === "tab to display")  { tabToNextDisplay();  }
    else if (info.menuItemId === "link to window")  { urlToWindowNormal(info.linkUrl); }
    else if (info.menuItemId === "link to popup")   { urlToWindowPopup(info.linkUrl); }
    else if (info.menuItemId === "link to next")    { urlToNextWindow(info.linkUrl); }
    else if (info.menuItemId === "link to display") { urlToNextDisplay(info.linkUrl); }

    // options
    else if (info.menuItemId === "window option") {
      options.set("menuButtonType", "normal");
      options.save();
    }
    else if (info.menuItemId === "popup option") {
      options.set("menuButtonType", "popup");
      options.save();
    }
    else if (info.menuItemId === "focus original option") {
      options.set("focus", "original");
      options.save();
    }
    else if (info.menuItemId === "focus new option") {
      options.set("focus", "new");
      options.save();
    }
  });
}

createMenu(options.get("showMenu") ? ["browser_action", "page"] : ["browser_action"]);
