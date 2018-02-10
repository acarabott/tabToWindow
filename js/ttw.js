/* global chrome */

import { defaults, loadOptions, getStorageWindowPropKey } from "./storage.js";

// Load
let options = defaults;

function getSizeAndPos(winKey, displayBounds) {
  // Convert percentages to pixel values
  const values = {};
  ["left", "top", "width", "height"].forEach(propKey => {
    values[propKey] = options[getStorageWindowPropKey(winKey, propKey)];
  });
  return {
    left:   Math.round(values.left   * displayBounds.width  + displayBounds.left),
    top:    Math.round(values.top    * displayBounds.height + displayBounds.top),
    width:  Math.round(values.width  * displayBounds.width),
    height: Math.round(values.height * displayBounds.height)
  };
}

function getOriginId(id) {
  return `popOrigin_${id}`;
}

function tabToWindow(windowType) {
  // Helper functions
  // ---------------------------------------------------------------------------
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

  function createNewWindow(tabs, windowType, isFullscreen, os, win, displayBounds) {
    const tab = tabs.find(tab => tab.active);

    // new window data
    const createData = {
      tabId: tab.id,
      type: windowType,
      focused: options.focus === "new",
      incognito: tab.incognito,
      state: isFullscreen ? "fullscreen" : "normal"
    };

    // shouldn't set width/height/left/top if fullscreen
    if (!isFullscreen) {
      if (options.cloneOriginal) {
        // copying all values covers the case of clone-position-same
        ["width", "height", "left", "top"].forEach(k => createData[k] = win[k]);

        // find the position that has the most space and return the position
        // and length to fill it.
        // e.g. when cloning horizontally and the window is left: 25% width: 25%
        // there is more space on the right side than the left, so use the right
        // pos is left/top opposite is right/bottom
        const getPosAndLength = (winPos, winLength, displayPos, displayLength) => {
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
        };

        if (options.clonePosition === "clone-position-horizontal") {
          const { pos, length } = getPosAndLength(win.left, win.width,
                                                  displayBounds.left,
                                                  displayBounds.width);
          createData.left = pos;
          createData.width = length;

        }
        else if (options.clonePosition === "clone-position-vertical") {
          const { pos, length } = getPosAndLength(win.top, win.height,
                                                  displayBounds.top,
                                                  displayBounds.height);
          createData.top = pos;
          createData.height = length;
        }
      }
      else { // not cloning
        Object.entries(getSizeAndPos("new", displayBounds)).forEach(([k, v]) => {
          createData[k] = v;
        });
      }

      // ensure all values are integers for Chrome APIs
      ["width", "height", "left", "top"].forEach(k => {
        createData[k] = Math.round(createData[k]);
      });
    }

    // Move it to a new window
    return new Promise(resolve => {
      chrome.windows.create(createData, newWin => {
        // save parent id in case we want to pop in
        sessionStorage[getOriginId(tab.id)] = win.id;
        resolve(newWin, tab);
      });
    });
  }

  // Here's the action
  // ---------------------------------------------------------------------------
  const osPromise = new Promise(resolve => {
    chrome.runtime.getPlatformInfo(info => resolve(info.os));
  });

  const displaysPromise = new Promise(resolve => {
    chrome.system.display.getInfo(displays => resolve(displays));
  });

  const currentWindowPromise = new Promise(resolve => {
    chrome.windows.getCurrent({}, win => resolve(win));
  });

  const tabsPromise = new Promise(resolve => {
    chrome.tabs.query({ currentWindow: true }, t => {
      if (t.length > 1) { resolve(t); }
    });
  });

  const promises = [osPromise, displaysPromise, currentWindowPromise,
    tabsPromise];

  Promise.all(promises).then(([os, displays, currentWindow, tabs]) => {
    const display = displays.find(display => {
      const displayLeft = display.bounds.left;
      const displayRight = displayLeft + display.bounds.width;
      const displayTop = display.bounds.top;
      const displayBottom = displayTop + display.bounds.height;
      const isLeftOfFirstDisplay = displayLeft === 0 && currentWindow.left < 0;

      return (currentWindow.left >= displayLeft || isLeftOfFirstDisplay) &&
              currentWindow.left < displayRight &&
              currentWindow.top >= displayTop &&
              currentWindow.top < displayBottom;
    });
    const isFullscreen = options.copyFullscreen &&
                         currentWindow.state === "fullscreen";

    const resizePromises = [];

    // (maybe) move and resize original window
    if (options.resizeOriginal && !isFullscreen) {
      resizePromises.push(resizeOriginalWindow(currentWindow, display.workArea));
    }

    // move and resize new window
    const bothMoved = Promise.all(resizePromises).then(([updatedWin]) => {
      const origWin = updatedWin === undefined ? currentWindow : updatedWin;
      return createNewWindow(tabs, windowType, isFullscreen, os, origWin,
                             display.workArea);
    });

    // move highlighted tabs
    bothMoved.then((newWin, movedTab) => {
      const otherTabs = tabs.filter(tab => tab !== movedTab && tab.highlighted);
      const otherTabIds = otherTabs.map(tab => tab.id);
      chrome.tabs.move(otherTabIds, {
        windowId: newWin.id,
        index: 1
      });
    });

    // focus
    if (options.focus === "original") {
      chrome.windows.update(currentWindow.id, { focused: true });
    }
  });
}

// TODO move multiple back
function windowToTab() {
  chrome.tabs.query({
    currentWindow: true,
    active:        true
  }, tabs => {
    const tab = tabs[0];

    const poppedKey = getOriginId(tab.id);
    if (!sessionStorage.hasOwnProperty(poppedKey)) { return; }

    const originalWindowId = parseInt(sessionStorage[poppedKey], 10);

    // check original window still exists
    chrome.windows.get(originalWindowId, {}, () => {
      if (chrome.runtime.lastError) { return; }
      // move the current tab
      chrome.tabs.move(tab.id, {
        windowId: originalWindowId,
        index:    -1
      }, () => {
        sessionStorage.removeItem(poppedKey);
        chrome.tabs.update(tab.id, { active: true });
      });
    });
  });
}

function setup(loadedOptions) {
  options = loadedOptions;
}

// loadOptions will return defaults on fail, so can use same setup function
loadOptions().then(setup, setup);

chrome.storage.onChanged.addListener((changes, areaName) => {
  Object.entries(changes).forEach(([k, v]) => options[k] = v.newValue);
});

chrome.commands.onCommand.addListener(command => {
       if (command === "tab-to-window-normal") { tabToWindow("normal"); }
  else if (command === "tab-to-window-popup")  { tabToWindow("popup"); }
  else if (command === "window-to-tab")        { windowToTab(); }
});

chrome.browserAction.onClicked.addListener(tabs => {
  tabToWindow(options.menuButtonType);
});
