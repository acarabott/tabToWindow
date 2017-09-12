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
    'ttw_original-width': 50,
    'ttw_original-height': 100,
    'ttw_original-left': 0,
    'ttw_original-top': 0,
    'ttw_original-min_top': 0,
    'ttw_new-width': 50,
    'ttw_new-height': 100,
    'ttw_new-left': 50,
    'ttw_new-top': 0,
    'ttw_new-min_top': 0
  };

  Object.keys(localStorageDefaults).forEach(key => {
    if (!localStorage.hasOwnProperty(key)) {
      localStorage[key] = localStorageDefaults[key];
    }
  });
})();
