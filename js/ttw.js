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
    state:     isFullscreen ? "fullscreen" : "normal",
  };

  // shouldn't set width/height/left/top if fullscreen
  if (!isFullscreen) {
    Object.keys(windowBounds).forEach(key => opts[key] = windowBounds[key]);
  }

  // Move it to a new window
  return new Promise(resolve => {
    chrome.windows.create(opts, newWin => resolve([newWin, tab]));
  });
}

// Primary Functions
// -----------------------------------------------------------------------------

function tabToWindow(windowType, moveToNextDisplay=false) {
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

  Promise.all(promises).then(([displays, currentWindow, tabs]) => {
    moveToNextDisplay = moveToNextDisplay && displays.length > 1;

    const currentDisplay = displays.find(display => {
      const displayLeft = display.bounds.left;
      const displayRight = displayLeft + display.bounds.width;
      const displayTop = display.bounds.top;
      const displayBottom = displayTop + display.bounds.height;
      const isLeftOfFirstDisplay = displayLeft === 0 && currentWindow.left < 0;

      return (currentWindow.left >= displayLeft || isLeftOfFirstDisplay) &&
              currentWindow.left <  displayRight &&
              currentWindow.top  >= displayTop &&
              currentWindow.top  <  displayBottom;
    });
    const isFullscreen = !moveToNextDisplay &&
                         options.get("copyFullscreen") &&
                         currentWindow.state === "fullscreen";
    const isFocused = options.get("focus") === "new";

    const resizePromises = [];

    // (maybe) move and resize original window
    const destroyingOriginalWindow = tabs.length === 1;
    if (options.get("resizeOriginal") &&
        !isFullscreen &&
        !destroyingOriginalWindow &&
        !moveToNextDisplay) {
      resizePromises.push(resizeOriginalWindow(currentWindow,
                                               currentDisplay.workArea));
    }

    // move and resize new window
    const bothMoved = Promise.all(resizePromises).then(([updatedWin]) => {
      const origWindow = updatedWin === undefined ? currentWindow : updatedWin;
      const activeTab = tabs.find(tab => tab.active);

      function getNextDisplay() {
        const currentIndex = displays.findIndex(disp => disp === currentDisplay);
        const nextIndex = (currentIndex + 1) % displays.length;
        return displays[nextIndex];
      }

      // if it's just one tab, the only use case is to convert it into a popup
      // window, so just leave it where it was
      const windowBounds = moveToNextDisplay ? getNextDisplay().bounds
                         : tabs.length === 1 ? getWindowBounds(origWindow)
                         : getNewWindowBounds(origWindow, currentDisplay.workArea);

      return createNewWindow(activeTab, windowType, windowBounds, isFullscreen,
                             isFocused);
    });

    // move highlighted tabs
    const othersMoved = bothMoved.then(([newWin, movedTab]) => {
      // save parent id in case we want to pop in
      if (!destroyingOriginalWindow) {
        originWindowCache.set(movedTab, currentWindow);
      }

      // move other highlighted tabs
      const otherTabs = tabs.filter(tab => tab !== movedTab && tab.highlighted);
      if (otherTabs.length > 0) {
        otherTabs.forEach(tab => originWindowCache.set(tab, currentWindow));

        if (windowType === "normal") {
          return new Promise(resolve => {
            // move all tabs at once
            chrome.tabs.move(otherTabs.map(tab => tab.id), {
              windowId: newWin.id,
              index: 1
            }, tabs => resolve(tabs));
          });
        }
        else if (windowType === "popup") {
          // can't move tabs to a popup window, so create individual ones
          const tabPromises = otherTabs.map(tab => {
            return createNewWindow(tab, windowType, getWindowBounds(newWin),
              isFullscreen, isFocused);
          });
          return Promise.all(tabPromises);
        }
      }
    });

    othersMoved.then(() => {
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
    });
  },
  error => { console.error(error); });
}

function urlToWindow(url) {
  chrome.tabs.create({ url, active: true }, () => {
    tabToWindow(options.get("menuButtonType"));
  });
}

function tabToNextWindow() {
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

  Promise.all([tabsPromise, windowsPromise]).then(([tabsToMove, windows]) => {
    const windowIndex = windows.findIndex(win => win.id === tabsToMove[0].windowId);
    if (windowIndex === -1) { return; }

    const nextWindowIndex = (windowIndex + 1) % windows.length;
    if (nextWindowIndex !== windowIndex) {
      const windowId = windows[nextWindowIndex].id;
      const focusWindow = new Promise(resolve => {
        chrome.windows.update(windowId, { focused: true }, win => resolve(win));
      });

      const getTabsToUnhighlight = new Promise(resolve => {
        chrome.tabs.query({ windowId, highlighted: true }, tabs => {
          resolve(tabs);
        });
      });

      const focusWindowAndGetTabsToUnhighlight = new Promise(resolve => {
        return Promise.all([focusWindow, getTabsToUnhighlight]).then(([_win, tabsToUnhighlight]) => {
          if (!Array.isArray((tabsToUnhighlight))) { tabsToUnhighlight = [tabsToUnhighlight]; }
          resolve(tabsToUnhighlight);
        });
      });

      const moveTabs = new Promise(resolve => {
        focusWindowAndGetTabsToUnhighlight.then(tabsToUnhighlight => {
          chrome.tabs.move(tabsToMove.map(tab => tab.id), {
            windowId,
            index: -1
          }, movedTabs => {
            if (!Array.isArray(movedTabs)) {
              movedTabs = [movedTabs];
            }
            resolve([movedTabs, tabsToUnhighlight]);
          });
        });
      });

      const highlightMovedTabs = new Promise(resolve => {
        moveTabs.then(([movedTabs, tabsToUnhighlight]) => {
          const highlightMovedTabs = movedTabs.map((tab, i) => {
            return new Promise(tabResolve => {
              chrome.tabs.update(tab.id, {
                highlighted: true,
                active: i === movedTabs.legth - 1
              }, tab => tabResolve(tab));
            });
          });

          Promise.all(highlightMovedTabs).then(() => resolve(tabsToUnhighlight));
        });
      });

      highlightMovedTabs.then(tabsToUnhighlight => {
        tabsToUnhighlight.forEach(tab => {
          chrome.tabs.update(tab.id, { highlighted: false });
        });
      });
    }
  });
}

// Chrome Listeners
// -----------------------------------------------------------------------------

chrome.storage.onChanged.addListener(changes => {
  Object.entries(changes).forEach(([k, v]) => options.set(k, v.newValue));
});

chrome.commands.onCommand.addListener(command => {
       if (command === "01-tab-to-window-normal")  { tabToWindow("normal"); }
  else if (command === "02-tab-to-window-popup")   { tabToWindow("popup"); }
  else if (command === "03-tab-to-window-next")    { tabToNextWindow(); }
  else if (command === "04-tab-to-window-display") {
    tabToWindow(options.get("menuButtonType"), true);
  }
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
const commandsPromise = new Promise(resolve => {
  chrome.commands.getAll(commands => resolve(commands));
});

Promise.all([options.loadPromise, commandsPromise]).then(([_options, commands]) => {
  chrome.contextMenus.removeAll();

  // Actions
  // -------
  const normalCommand = commands.find(cmd => cmd.name === "01-tab-to-window-normal");
  const normalShortcut = normalCommand === undefined
    ? ""
    : normalCommand.shortcut === ""
      ? ""
      : `(${normalCommand.shortcut})`;
  chrome.contextMenus.create({
    type:     "normal",
    id:       "tab to window",
    title:    `${normalCommand.description} ${normalShortcut}`,
    contexts: ["browser_action", "page"],   // "link"
  });

  const popupCommand = commands.find(cmd => cmd.name === "02-tab-to-window-popup");
  const popupShortcut = popupCommand === undefined
    ? ""
    : popupCommand.shortcut === ""
      ? ""
      : `(${popupCommand.shortcut})`;
  chrome.contextMenus.create({
    type:     "normal",
    id:       "tab to popup",
    title:    `${popupCommand.description} ${popupShortcut}`,
    contexts: ["browser_action", "page"],   // "link"
  });

  const nextCommand = commands.find(cmd => cmd.name === "03-tab-to-window-next");
  const nextShortcut = nextCommand === undefined
    ? ""
    : nextCommand.shortcut === ""
      ? ""
      : `(${nextCommand.shortcut})`;
  chrome.contextMenus.create({
    type:     "normal",
    id:       "tab to next",
    title:    `${nextCommand.description} ${nextShortcut}`,
    contexts: ["browser_action", "page"],
  });

  const displayCommand = commands.find(cmd => cmd.name === "04-tab-to-window-display");
  const displayShortcut = displayCommand === undefined
    ? ""
    : displayCommand.shortcut === ""
      ? ""
      : `(${displayCommand.shortcut})`;
  chrome.contextMenus.create({
    type:     "normal",
    id:       "tab to display",
    title:    `${displayCommand.description} ${displayShortcut}`,
    contexts: ["browser_action", "page"],
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

  // Context Menu action
  chrome.contextMenus.onClicked.addListener(info => {
    // actions
         if (info.menuItemId === "tab to window")  { tabToWindow("normal"); }
    else if (info.menuItemId === "tab to popup")   { tabToWindow("popup"); }
    else if (info.menuItemId === "tab to next")    { tabToNextWindow(); }
    else if (info.menuItemId === "tab to display") {
      tabToWindow(options.get("menuButtonType"), true);
    }
    else if (info.menuItemId === "link to window") {
      urlToWindow(info.linkUrl);
    }

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
});
