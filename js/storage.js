/* eslint browser: true */
/* global chrome */
/* TODO this really wants to become a module when google fix the bug with them*/

const defaults = {
  // 'original' or 'new'
  'focus': 'new',
  // boolean
  'resizeOriginal': true,
  // boolean
  'cloneOriginal': false,
  // 'clone-position-same', 'clone-position-horizontal', 'clone-position-vertical'
  'clonePosition': 'clone-position-horizontal',
  // boolean
  'copyFullscreen': true,
  // these are all percentage 0.0 - 1.0
  'original_width': 0.5,
  'original_height': 1.0,
  'original_left': 0.0,
  'original_top': 0.0,
  'new_width': 0.5,
  'new_height': 1.0,
  'new_left': 0.5,
  'new_top': 0.0
};

// retrieve the localStorage key for a particular window property
// @windowId: 'original', 'new'
// @propertyKey: 'width', 'height', 'left', 'top'
function getStorageWindowPropKey(windowId, propertyKey) {
 return `${windowId}_${propertyKey.toLowerCase()}`;
}

function validateOptions(options) {
  if (!Object.keys(options).every(key => Object.keys(defaults).includes(key))) {
    console.error('not all options are present!');
    return false;
  }

  function validStringOption(key, validOptions) {
    const result = validOptions.includes(options[key]);
    if (!result) console.error(`"${key}" is invalid, should be in ${validOptions}`);
    return result;
  }

  function validBoolOption(key) {
    const result = typeof options[key] === 'boolean';
    if (!result) console.error(`"${key}" option is invalid, should be boolean`);
    return result;
  }

  function validNumberOption(key, min, max) {
    const result =  typeof options[key] === 'number' &&
                           options[key] >= min &&
                           options[key] <= max;
    if (!result) console.error(`${key} should be between ${min} and ${max}`);
    return result;
  }

  if (!validStringOption('focus', ['original', 'new'])) return false;
  if (!validBoolOption('resizeOriginal')) return false;
  if (!validBoolOption('cloneOriginal')) return false;
  if (!validStringOption('clonePosition', ['clone-position-same',
                                            'clone-position-horizontal',
                                            'clone-position-vertical'])) return false;
  if (!validBoolOption('copyFullscreen')) return false;

  const numberOpts = ['original_width', 'original_height', 'original_left',
                      'original_top', 'new_width', 'new_height', 'new_left',
                      'new_top'];
  if (numberOpts.some(opt => !validNumberOption(opt, 0.0, 1.0))) return false;

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
