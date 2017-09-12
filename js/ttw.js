function getSizeAndPos(winKey) {
  // Convert percentages to pixel values
  const properties = {};
  ['width', 'height', 'left', 'top'].forEach(pKey => {
    const value = localStorage[`ttw_${winKey}-${pKey}`];
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

function getCloneVals(orig) {
  const pos = localStorage.ttw_clone_position;
  const copyFullscreen = localStorage.ttw_copy_fullscreen === 'true';
  const vals = {};

  if (pos === 'clone-position-same') {
    vals.width = orig.width;
    vals.height = orig.height;
    vals.left = orig.left;
    vals.top = orig.top;

  } else if (pos === 'clone-position-horizontal') {
    const right = orig.left + orig.width;
    const hgap = screen.width - right;
    vals.height = orig.height;
    vals.top = orig.top;

    // position on right
    if (orig.left < hgap) {
      vals.width = Math.min(orig.width, hgap);
      vals.left = right;
    } else { // position on left
      const width = Math.min(orig.width, orig.left);
      vals.width = width;
      vals.left = orig.left - width;
    }

  } else if (pos === 'clone-position-vertical') {
    const bottom = orig.top + orig.height;
    const vgap = screen.height - bottom;

    vals.left = orig.left;
    vals.width = orig.width;

    // position below
    if (orig.top < vgap) {
      vals.top = bottom;
      vals.height = Math.min(orig.height, vgap);
    } else { // position above
      const height = Math.min(orig.height, orig.top);
      vals.height = height;
      vals.top = orig.top - height;
    }
  }

  vals.fullscreen = copyFullscreen && orig.state === 'fullscreen';

  return vals;
}

function getNewVals(orig) {
  const vals = getSizeAndPos('new');
  const copyFullscreen = localStorage.ttw_copy_fullscreen === 'true';

  vals.fullscreen = copyFullscreen && orig.state === 'fullscreen';

  return vals;
}

function moveTabOut(windowType) {
  chrome.windows.getCurrent({},  currentWindow => {
    const resizeOriginal = localStorage.ttw_resize_original === 'true';
    const copyFullscreen = localStorage.ttw_copy_fullscreen === 'true';
    const originalIsFullscreen = currentWindow.state === 'fullscreen';

    // resize original window
    if (resizeOriginal && !(copyFullscreen && originalIsFullscreen)) {
      const vals = getSizeAndPos('original');
      chrome.windows.update(currentWindow.id, {
        width: vals.width,
        height: vals.height,
        left: vals.left,
        top: vals.top
      });

    }

    // move out new window
    chrome.tabs.query({
      currentWindow: true,
      active: true
    }, tabs => {
      const tab = tabs[0];

      // If we are cloning the origin window, use the origin window values
      const vals = localStorage.ttw_clone_original === 'true'
        ? getCloneVals(currentWindow)
        : getNewVals(currentWindow);

      const createData = {
        tabId: tab.id,
        type: windowType,
        focused: localStorage.ttw_focus === 'new',
        incognito: tab.incognito
      };

      if (vals.fullscreen) {
        createData.state = vals.fullscreen ? 'fullscreen' : 'normal';
      }
      else {
        ['width', 'height', 'left', 'top'].forEach(key => createData[key] = vals[key]);
      }

      // Move it to a new window
      chrome.windows.create(createData, newWindow => {
        // save parent id in case we want to pop_in
        sessionStorage[getOriginId(tab.id)] = currentWindow.id;

        if (localStorage.ttw_focus === "original") {
          chrome.windows.update(currentWindow.id, { focused: true });
        }
      });
    });

  });
}

function tabToWindow(windowType) {
  // Check there are more than 1 tabs in current window
  chrome.tabs.query({
    currentWindow: true
  }, tabs => {
    if (tabs.length <= 1) { return; }
    moveTabOut(windowType);
  });
}

function windowToTab() {
  chrome.tabs.query({
    currentWindow: true,
    active:      true
  }, tabs => {
    const tab = tabs[0];

    const popped_key = getOriginId(tab.id);
    if (!sessionStorage.hasOwnProperty(popped_key)) { return; }

    const origin_window_id = parseInt(sessionStorage[popped_key]);

    // check original window still exists
    chrome.windows.get(origin_window_id, {}, originWindow => {
      if (chrome.runtime.lastError) { return; }

      // move the current tab
      chrome.tabs.move(tab.id, {
        windowId: origin_window_id,
        index:    -1
      }, () => {
        sessionStorage.removeItem(popped_key);
        chrome.tabs.update(tab.id, {
          active: true
        });
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

  if (lookup.hasOwnProperty(command)) {
    lookup[command]();
  }
});
