/* eslint browser: true */
/* global chrome */

(() => {
  const defaults = {
    // 'original' or 'new'
    'focus': 'new',
    // 'true' or 'false'
    'resize_original': 'true',
    // 'true' or 'false'
    'clone_original': 'false',
    // 'clone-position-same', 'clone-position-horizontal', 'clone-position-vertical'
    'clone_position': 'clone-position-horizontal',
    // 'true' or 'false'
    'copy_fullscreen': 'true',
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

  Object.entries(defaults).forEach(([key, value]) => {
    if (!localStorage.hasOwnProperty(key)) {
      localStorage[key] = value;
    }
  });
})();

// retrieve the localStorage key for a particular window property
// @windowId: 'original', 'new'
// @propertyKey: 'width', 'height', 'left', 'top'
function getLocalStorageWindowPropKey(windowId, propertyKey) {
 return `${windowId}_${propertyKey.toLowerCase()}`;
}
