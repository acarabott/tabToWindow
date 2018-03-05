/* global chrome */

import { options } from "./options-storage.js";

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


function getNewWindowBounds(origWindow, displayBounds, cloneOriginal, clonePosition) {
  const bounds = { left: 0, top: 0, width: 0, height: 0 };

  // find the position that has the most space and return the position
  // and length to fill it.
  // e.g. when cloning horizontally and the window is left: 25% width: 25%
  // there is more space on the right side than the left, so use the right
  // pos is left/top opposite is right/bottom
  function getPosAndLength (winPos, winLength, displayPos, displayLength) {
    const normWinPos = winPos - displayPos;
    const oppositeEdge = normWinPos + winLength;
    const oppositeGap = displayLength - oppositeEdge;
    const useOppositeGap = normWinPos < oppositeGap;

    const pos = useOppositeGap
      ? displayPos + oppositeEdge
      : winPos - Math.min(winLength, normWinPos);

    const length = Math.min(winLength,
                            useOppositeGap ? oppositeGap : normWinPos);

    return { pos, length };
  }

  function getHorzPosAndLength() {
    return getPosAndLength(origWindow.left, origWindow.width,
                           displayBounds.left, displayBounds.width);
  }

  function getVertPosAndLength() {
    return getPosAndLength(origWindow.top, origWindow.height,
                           displayBounds.top, displayBounds.height);
  }

  if (cloneOriginal) {
    // copying all values covers the case of clone-position-same
    ["width", "height", "left", "top"].forEach(k => bounds[k] = origWindow[k]);

    if (clonePosition === "clone-position-horizontal") {
      const { pos, length } = getHorzPosAndLength();
      bounds.left = pos;
      bounds.width = length;
    }
    else if (clonePosition === "clone-position-vertical") {
      const { pos, length } = getVertPosAndLength();
      bounds.top = pos;
      bounds.height = length;
    }
  }
  else { // not cloning
    Object.entries(getSizeAndPos("new", displayBounds)).forEach(([k, v]) => {
      bounds[k] = v;
    });
  }

  // ensure all values are integers for Chrome APIs
  ["width", "height", "left", "top"].forEach(k => {
    bounds[k] = Math.round(bounds[k]);
  });

  return bounds;
}


function createNewWindow(tab, windowType, windowBounds, isFullscreen, isFocused) {
  // new window options
  const opts = {
    tabId:           tab.id,
    type:            windowType,
    focused:         isFocused,
    incognito:       tab.incognito,
    state:           isFullscreen ? "fullscreen" : "normal",
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

function tabToWindow(windowType) {
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

  const proms = [displaysPromise, currentWindowPromise, tabsPromise];

  Promise.all(proms).then(([displays, currentWindow, tabs]) => {
    const display = displays.find(display => {
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
    const isFullscreen = options.get("copyFullscreen") &&
                         currentWindow.state === "fullscreen";
    const isFocused = options.get("focus") === "new";

    const resizePromises = [];

    // (maybe) move and resize original window
    const destroyingOriginalWindow = tabs.length === 1;
    if (options.get("resizeOriginal") &&
        !isFullscreen &&
        !destroyingOriginalWindow) {
      resizePromises.push(resizeOriginalWindow(currentWindow, display.workArea));
    }

    // move and resize new window
    const bothMoved = Promise.all(resizePromises).then(([updatedWin]) => {
      const origWindow = updatedWin === undefined ? currentWindow : updatedWin;
      const activeTab = tabs.find(tab => tab.active);
      // if it's just one tab, the only use case is to convert it into a popup
      // window, so just leave it where it was
      const windowBounds = tabs.length === 1
        ? getWindowBounds(origWindow)
        : getNewWindowBounds(origWindow,
                             display.workArea,
                             options.get("cloneOriginal"),
                             options.get("clonePosition"));

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


function windowToTab() {
  const getTabs = new Promise(resolve => {
    chrome.tabs.query({
      currentWindow: true,
      highlighted: true
    }, tabs => resolve(tabs));
  });

  const checkOriginalWindowsExist = getTabs.then(tabs => {
    const tabsWithWindow = tabs.filter(tab => originWindowCache.has(tab));
    const promises = tabsWithWindow.map(tab => {
      const originalWindowId = originWindowCache.get(tab);

      return new Promise((resolve, reject) => {
        chrome.windows.get(originalWindowId, {}, () => {
          if (chrome.runtime.lastError === undefined) {
            resolve([tab, originalWindowId]);
          }
          else {
            reject(new Error(chrome.runtime.lastError.message));
          }
        });
      });
    });

    return Promise.all(promises);
  });

  const moveTabs = checkOriginalWindowsExist.then(tabResults => {
    const movePromises = tabResults.map(([tab, windowId]) => {
      return new Promise(resolve => {
        chrome.tabs.move(tab.id, { windowId, index: -1 }, () => resolve(tab));
      });
    });

    return Promise.all(movePromises);
  },
  error => { console.error(error); });

  moveTabs.then(moveResults => {
    moveResults.forEach((tab) => {
      originWindowCache.delete(tab);
      if (tab.active) { chrome.tabs.update(tab.id, { active: true }); }
    });
  });
}

// Chrome Listeners
// -----------------------------------------------------------------------------

chrome.storage.onChanged.addListener(changes => {
  Object.entries(changes).forEach(([k, v]) => options.set(k, v.newValue));
});

chrome.commands.onCommand.addListener(command => {
       if (command === "tab-to-window-normal") { tabToWindow("normal"); }
  else if (command === "tab-to-window-popup")  { tabToWindow("popup"); }
  else if (command === "window-to-tab")        { windowToTab(); }
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
  const normalCommand = commands.find(cmd => cmd.name === "tab-to-window-normal");
  const normalShortcut = normalCommand === undefined ? "" : `(${normalCommand.shortcut})`;
  chrome.contextMenus.create({
    type:     "normal",
    id:       "Tab To Window",
    title:    `Tab To Window ${normalShortcut}`,
    contexts: ["browser_action", "page"],   // "link"
  });

  const popupCommand = commands.find(cmd => cmd.name === "tab-to-window-popup");
  const popupShortcut = popupCommand === undefined ? "" : `(${popupCommand.shortcut})`;
  chrome.contextMenus.create({
    type:     "normal",
    id:       "Tab To Popup",
    title:    `Tab To Popup ${popupShortcut}`,
    contexts: ["browser_action", "page"],   // "link"
  });

  const undoCommand = commands.find(cmd => cmd.name === "window-to-tab");
  const undoShortcut = undoCommand === undefined ? "" : `(${undoCommand.shortcut})`;
  chrome.contextMenus.create({
    type:     "normal",
    id:       "Move tab back",
    title:    `Move tab back ${undoShortcut}`,
    contexts: ["browser_action", "page"],
  });

  chrome.contextMenus.create({
    type: "separator", id: "action option separator", contexts: ["browser_action"],
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
    id:       "Window Option",
    parentId: "type parent",
    title:    "Window",
    checked:  options.get("menuButtonType") === "normal",
    contexts: ["browser_action"],
  });

  chrome.contextMenus.create({
    type:     "radio",
    id:       "Popup Option",
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
    id:       "Focus Original Option",
    parentId: "focus parent",
    title:    "Original",
    checked:  options.get("focus") === "original",
    contexts: ["browser_action"],
  });

  chrome.contextMenus.create({
    type:     "radio",
    id:       "Focus New Option",
    parentId: "focus parent",
    title:    "New",
    checked:  options.get("focus") === "new",
    contexts: ["browser_action"],
  });

  // Context Menu action
  chrome.contextMenus.onClicked.addListener(info => {
         if (info.menuItemId === "Tab To Window") { tabToWindow("normal"); }
    else if (info.menuItemId === "Tab To Popup")  { tabToWindow("popup"); }
    else if (info.menuItemId === "Move tab back") { windowToTab(); }

    else if (info.menuItemId === "Window Option") {
      options.set("menuButtonType", "normal");
      options.save();
    }
    else if (info.menuItemId === "Popup Option") {
      options.set("menuButtonType", "popup");
      options.save();
    }
    else if (info.menuItemId === "Focus Original Option") {
      options.set("focus", "original");
      options.save();
    }
    else if (info.menuItemId === "Focus New Option") {
      options.set("focus", "new");
      options.save();
    }
  });
});
