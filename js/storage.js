/* eslint browser: true */
/* global chrome */
/* TODO this really wants to become a module when google fix the bug with them*/

const defaults = {
  // 'original' or 'new'
  focus: 'new',
  // boolean
  resizeOriginal: true,
  // boolean
  cloneOriginal: false,
  // clone-position-same', 'clone-position-horizontal', 'clone-position-vertical'
  clonePosition: 'clone-position-horizontal',
  // boolean
  copyFullscreen: true,
  // 'normal', 'popup'
  menuButtonType: 'normal',
  // these are all percentage 0.0 - 1.0
  originalWidth:  0.5,
  originalHeight: 1.0,
  originalLeft:   0.0,
  originalTop:    0.0,
  newWidth:       0.5,
  newHeight:      1.0,
  newLeft:        0.5,
  newTop:         0.0
};

// retrieve the localStorage key for a particular window property
// @windowId: 'original', 'new'
// @propertyKey: 'width', 'height', 'left', 'top'
function getStorageWindowPropKey(windowId, propKey) {
  return `${windowId}${propKey.slice(0).charAt().toUpperCase()}${propKey.slice(1)}`;
}

function validateOptions(options) {
  if (!Object.keys(options).every(key => Object.keys(defaults).includes(key))) {
    console.error('not all options are present!');
    console.error(Object.keys(options).filter(key => !Object.keys(defaults).includes(key)));
    return false;
  }

  function isValidStringOption(option, validOptions) {
    const result = validOptions.includes(options[option]);
    if (!result) console.error(`"${option}" is invalid, should be in ${validOptions}`);
    return result;
  }

  function isValidBoolOption(key) {
    const result = typeof options[key] === 'boolean';
    if (!result) console.error(`"${key}" option is invalid, should be boolean`);
    return result;
  }

  function isValidNumberOption(key, min, max) {
    const result = typeof options[key] === 'number' &&
                          options[key] >= min &&
                          options[key] <= max;
    if (!result) console.error(`${key} should be between ${min} and ${max}`);
    return result;
  }

  if (!isValidStringOption('focus', ['original', 'new'])) return false;
  if (!isValidBoolOption('resizeOriginal')) return false;
  if (!isValidBoolOption('cloneOriginal')) return false;
  if (!isValidStringOption('clonePosition', ['clone-position-same',
                                             'clone-position-horizontal',
                                             'clone-position-vertical'])) return false;
  if (!isValidBoolOption('copyFullscreen')) return false;
  if (!isValidStringOption('menuButtonType', ['normal', 'popup'])) return false;

  const numberOpts = ['originalWidth', 'originalHeight', 'originalLeft',
                      'originalTop', 'newWidth', 'newHeight', 'newLeft',
                      'newTop'];
  if (numberOpts.some(opt => !isValidNumberOption(opt, 0.0, 1.0))) return false;

  return true;
}

function saveOptions(options) {
  if (!validateOptions(options)) return;

  chrome.storage.sync.set(options, () => {
    if (chrome.runtime.lastError !== undefined) {
      console.error(chrome.runtime.lastError);
    }
  });
}

// this returns defaults on fail
function loadOptions() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(defaults, options => {
      if (chrome.runtime.lastError === undefined) resolve(options);
      else reject(chrome.runtime.lastError);
    });
  });
}
