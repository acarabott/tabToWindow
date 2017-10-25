/* eslint browser: true */
/* global getStorageWindowPropKey, loadOptions, chrome */

// Load
let options = defaults;

function getSizeAndPos(winKey) {
  // Convert percentages to pixel values
  const properties = {};
  ['width', 'height', 'left', 'top'].forEach(pKey => {
    const value = options[getStorageWindowPropKey(winKey, pKey)];
    const screenDimension = pKey === 'width' || pKey === 'left'
      ? screen.availWidth
      : screen.availHeight;
    properties[pKey] = Math.round(value * screenDimension);
  });

  return properties;
}

function getOriginId(id) {
  return `popOrigin_${id}`;
}

function tabToWindow(windowType) {
  // Helper functions
  // ---------------------------------------------------------------------------
  function getTabs() {
    return new Promise(resolve => {
      chrome.tabs.query({currentWindow: true}, t => {
        if (t.length > 1) { resolve(t); }
      });
    });
  }

  function getCurrentWindow() {
    return new Promise(resolve => {
      chrome.windows.getCurrent({}, win => resolve(win));
    });
  }

  function getOS() {
    return new Promise(resolve => {
      chrome.runtime.getPlatformInfo(info => resolve(info.os));
    });
  }

  function resizeOriginalWindow(originalWindow) {
    const vals = getSizeAndPos('original');
    chrome.windows.update(originalWindow.id, {
      width:  vals.width,
      height: vals.height,
      left:   vals.left,
      top:    vals.top
    });
  }

  function createNewWindow(tabs, windowType, fullscreen, os, win) {
    // TODO move multiple highlighted tabs
    const tab = tabs.find(tab => tab.active);
    // new window data
    const createData = {
      tabId: tab.id,
      type: windowType,
      focused: options.focus === 'new',
      incognito: tab.incognito,
      // On Mac, setting state to fullscreen when the current window is
      // already fullscreen results in a NON fullscreen window (guessing
      // chrome toggles the state after the window is created)
      state: fullscreen && os !== chrome.runtime.PlatformOs.MAC
        ? 'fullscreen'
        : 'normal'
    };

    // shouldn't set width/height/left/top if fullscreen
    if (!fullscreen) {
      const cloning = options.cloneOriginal && !fullscreen;
      if (cloning) {
        // copying all values covers the case of clone-position-same
        ['width', 'height', 'left', 'top'].forEach(k => createData[k] = win[k]);

        const pos = options.clonePosition;
        if (pos === 'clone-position-horizontal') {
          const right = win.left + win.width;
          const hgap = screen.availWidth - right;
          const positionOnRight = win.left < hgap;

          createData.width = Math.min(win.width, positionOnRight
                                                      ? hgap
                                                      : win.left);
          createData.left = positionOnRight
            ? right
            : win.left - Math.min(win.width, win.left);
        }
        else if (pos === 'clone-position-vertical') {
          const bottom = win.top + win.height;
          const vgap = screen.availHeight - bottom;
          const positionBelow = win.top < vgap;

          createData.top = positionBelow
            ? bottom
            : win.top - Math.min(win.height, win.top);
          createData.height = Math.min(win.height, positionBelow
                                                        ? vgap
                                                        : win.top);
        }
      }
      else {
        Object.entries(getSizeAndPos('new')).forEach(([k, v]) => {
          createData[k] = v
        });
      }

      // ensure all values are integers for Chrome APIs
      ['width', 'height', 'left', 'top'].forEach(k => {
        createData[k] = Math.round(createData[k]);
      });
    }

    // Move it to a new window
    chrome.windows.create(createData, () => {
      // save parent id in case we want to pop in
      sessionStorage[getOriginId(tab.id)] = win.id;
    });
  }

  // Here's the action
  // ---------------------------------------------------------------------------
  const toGet = [getTabs(), getCurrentWindow(), getOS];
  Promise.all(toGet).then(([tabs, currentWindow, os]) => {
    const fullscreen = options.copyFullscreen &&
                       currentWindow.state === 'fullscreen';

    // original window
    if (options.resizeOriginal && !fullscreen) {
      resizeOriginalWindow(currentWindow);
    }
    // new window
    createNewWindow(tabs, windowType, fullscreen, os, currentWindow);
    // focus
    if (options.focus === 'original') {
      chrome.windows.update(currentWindow.id, { focused: true });
    }
  });

}

function windowToTab() {
  chrome.tabs.query({
    currentWindow: true,
    active:      true
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
       if (command === 'tab-to-window-normal') tabToWindow('normal');
  else if (command === 'tab-to-window-popup') tabToWindow('popup');
  else if (command === 'window-to-tab') windowToTab();
});

chrome.browserAction.onClicked.addListener(tabs => {
  tabToWindow(options.menuButtonType);
});
