(() => {
  const localStorageDefaults = {
    // 'original' or 'new'
    'ttw_focus': 'new',
    // 'true' or 'false'
    'ttw_resize_original': 'true',
    // 'true' or 'false'
    'ttw_clone_original': 'false',
    // 'clone-position-same', 'clone-position-horizontal', 'clone-position-vertical'
    'ttw_clone_position': 'clone-position-horizontal',
    // 'true' or 'false'
    'ttw_copy_fullscreen': 'true',
    // these are all percentage 0.0 - 1.0
    'ttw_original_width': 0.5,
    'ttw_original_height': 1.0,
    'ttw_original_left': 0.0,
    'ttw_original_top': 0.0,
    'ttw_new_width': 0.5,
    'ttw_new_height': 1.0,
    'ttw_new_left': 0.5,
    'ttw_new_top': 0.0
  };

  Object.keys(localStorageDefaults).forEach(key => {
    if (!localStorage.hasOwnProperty(key)) {
      localStorage[key] = localStorageDefaults[key];
    }
  });
})();

// retrieve the localStorage key for a particular window property
// @windowId: 'original', 'new'
// @propertyKey: 'width', 'height', 'left', 'top'
function getLocalStorageWindowPropKey(windowId, propertyKey) {
 return `ttw_${windowId}_${propertyKey.toLowerCase()}`;
}
