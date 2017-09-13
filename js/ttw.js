/* eslint browser: true */
/* global getLocalStorageWindowPropKey, chrome */

function getSizeAndPos(winKey) {
  // Convert percentages to pixel values
  const properties = {};
  ['width', 'height', 'left', 'top'].forEach(pKey => {
    const value = localStorage[getLocalStorageWindowPropKey(winKey, pKey)];
    const screenDimension = pKey === 'width' || pKey === 'left'
      ? screen.availWidth
      : screen.availHeight;
    properties[pKey] = Math.round(value * screenDimension);
  });

  return properties;
}

function getOriginId(id) {
  return `ttw_pop_origin_${id}`;
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

  function getOs() {
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
      focused: localStorage.ttw_focus === 'new',
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
      const cloning = localStorage.ttw_clone_original === 'true' && !fullscreen;
      if (cloning) {
        // copying all values covers the case of clone-position-same
        ['width', 'height', 'left', 'top'].forEach(k => createData[k] = win[k]);

        const pos = localStorage.ttw_clone_position;
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
      // save parent id in case we want to pop_in
      sessionStorage[getOriginId(tab.id)] = win.id;
    });
  }

  // Here's the action
  const toGet = [getTabs(), getCurrentWindow(), getOs];
  Promise.all(toGet).then(([tabs, currentWindow, os]) => {
    const fullscreen = localStorage.ttw_copy_fullscreen === 'true' &&
                       currentWindow.state === 'fullscreen';

    // original window
    if (localStorage.ttw_resize_original === 'true' && !fullscreen) {
      resizeOriginalWindow(currentWindow);
    }
    // new window
    createNewWindow(tabs, windowType, fullscreen, os, currentWindow);
    // focus
    if (localStorage.ttw_focus === 'original') {
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

    const origin_window_id = parseInt(sessionStorage[poppedKey], 10);

    // check original window still exists
    chrome.windows.get(origin_window_id, {}, () => {
      if (chrome.runtime.lastError) { return; }

      // move the current tab
      chrome.tabs.move(tab.id, {
        windowId: origin_window_id,
        index:    -1
      }, () => {
        sessionStorage.removeItem(poppedKey);
        chrome.tabs.update(tab.id, { active: true });
      });
    });
  });
}

chrome.commands.onCommand.addListener(command => {
  const lookup = {
    'tab-to-window-normal': () => tabToWindow('normal'),
    'tab-to-window-popup':  () => tabToWindow('popup'),
    'window-to-tab':        windowToTab
  };

  if (lookup.hasOwnProperty(command)) { lookup[command](); }
});

chrome.browserAction.onClicked.addListener(tabs => {
  tabToWindow('normal');
});
