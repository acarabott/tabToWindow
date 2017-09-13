/* eslint browser: true */
/* global getLocalStorageWindowPropKey, chrome, $ */

// keystroke saving variables
// none of these are removed from the DOM, so can be relied on
// so don't be dumb and remove them from the DOM
// -----------------------------------------------------------------------------
const userScreen = document.getElementById('screen');
const windows = Array.from(document.getElementsByClassName('window'));
const focusOptions = Array.from(document.getElementsByClassName('focus-option'));
const resizeOriginal = document.getElementById('resize-original');
const cloneOriginal = document.getElementById('clone-original');
const clonePositions = Array.from(document.getElementsByName('clone-position'));
const copyFullscreen = document.getElementById('copy-fullscreen');


// Helper functions
// These should be functions that are called in more than one place
// -----------------------------------------------------------------------------

// window that will be focused on pop-out
function getFocusedName() {
  const focused = focusOptions.find(option => option.checked);
  return focused === undefined ? 'original' : focused.id.replace('focus-', '');
}

// save current state
function save() {
  localStorage.ttw_focus = getFocusedName();
  localStorage.ttw_resize_original = resizeOriginal.checked;
  localStorage.ttw_clone_original = cloneOriginal.checked;

  // Save to Local Storage

  // dimensions
  windows.forEach(win => {
    [['Width', 'Width'],
     ['Height', 'Height'],
     ['Left', 'Width'],
     ['Top', 'Height']].forEach(([prop, dim]) => {
      const windowDimension = win[`offset${prop}`];
      const screenDimension = userScreen[`offset${dim}`];
      const value = windowDimension / screenDimension;
      localStorage[getLocalStorageWindowPropKey(win.id, prop)] = value;
    });
  });

  // close position options
  localStorage.ttw_clone_position = clonePositions.find(cp => cp.checked).id;

  // fullscreen status
  localStorage.ttw_copy_fullscreen = copyFullscreen.checked;
}


function resizeInnerWindow(win) {
  const inner = win.getElementsByClassName('inner-window')[0];

  function getBorderWidth(keys) {
    const computed = getComputedStyle(inner);
    return keys.reduce((accumulator, key) => {
      return accumulator + parseInt(computed[`border${key}Width`], 10);
    }, 0);
  }

  const newInnerWidth = win.clientWidth - getBorderWidth(['Left', 'Right']);
  inner.style.width = `${newInnerWidth}px`;
  const newInnerHeight = win.clientHeight - getBorderWidth(['Top', 'Bottom']);
  inner.style.height = `${newInnerHeight}px`;
}



// changing draggable/resizable windows, used when radio buttons override
// resizing and positioning
function updateWindowHandling (inputId, windowId, enableIfChecked) {
  const $input =  $(inputId);
  const $win =    $(windowId);
  const checked = $input.prop('checked');
  const enable =  enableIfChecked ? checked : !checked;
  const action =  enable ? 'enable' : 'disable';

  $win.draggable(action);
  $win.resizable(action);
}

function updateResizeOriginal() {
  updateWindowHandling('#resize-original', '#original', true);
}

function updateCloneOriginal () {
  updateWindowHandling('#clone-original', '#new', false);

  // toggle clone position controls if cloning enabled/disabled
  Array.from(document.getElementsByClassName('clone-position-option')).forEach(opt => {
    opt.disabled = !cloneOriginal.checked;
  });

  const clonePositionOptions = document.getElementById('clone-position-options');
  clonePositionOptions.style.display = cloneOriginal.checked ? '' : 'none';
}


// update appearance of windows depending on if they are active or not
function updateFocus() {
  function getElements(id) {
    const parent = document.getElementById(id);
    return ['inner-window', 'button'].reduce((accumulator, className) => {
      return accumulator.concat(Array.from(parent.getElementsByClassName(className)));
    }, []);
  }

  ['original', 'new'].forEach(id => {
    getElements(id).forEach(element => {
      element.style.opacity = getFocusedName() === id
        ? 1.0
        : element.classList.contains('inner-window') ? 0.92 : 0.1;
    });
  });
}



// the "main function"
// Each chunk has specifically *not* been broken out into a named function
// as then it's more difficult to tell when / where they are being called
// and if it's more than one
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // display_shortcuts
  {
    chrome.commands.getAll(cmds => {
      if (cmds.length === 0) {
        return;
      }

      cmds.forEach(cmd => {
        const name = document.createElement('span');
        name.textContent = `${cmd.description}:`;
        name.classList.add('shortcut-label');

        const shortcut = document.createElement('span');
        shortcut.classList.add('shortcut');
        shortcut.textContent = cmd.shortcut;

        const li = document.createElement('li');
        [name, shortcut].forEach(el => li.appendChild(el));

        document.getElementById('shortcut-list').appendChild(li);
      });

    });
  }

  const gridsize = 20; // px to use for window grid

  // Set monitor aspect ratio to match user's
  {
    const monitor = document.getElementById('monitor');
    const ratio = screen.height / screen.width;
    const height = Math.round((monitor.clientWidth * ratio) / gridsize) * gridsize;
    monitor.style.height =  `${height}px`;
  }


  // restore_options
  {
    focusOptions.forEach(opt => opt.checked = opt.id.includes(localStorage.ttw_focus));
    resizeOriginal.checked = localStorage.ttw_resize_original === 'true';
    cloneOriginal.checked = localStorage.ttw_clone_original === 'true';
    clonePositions.find(cp => cp.id === localStorage.ttw_clone_position).checked = true;
    copyFullscreen.checked = localStorage.ttw_copy_fullscreen === 'true';
  }


  // setup windows
  {
    windows.forEach(win => {
      // Restore positions from options
      ['width', 'height', 'left', 'top'].forEach(prop => {
        const key = getLocalStorageWindowPropKey(win.id, prop);
        win.style[prop] = `${localStorage[key] * 100}%`;
      });

      const grid = [userScreen.clientWidth / gridsize, userScreen.clientHeight / gridsize];

      $(win).draggable({
        containment: "parent",
        grid: grid
      });

      $(win).resizable({
        containment: "parent",
        handles: "all",
        grid: grid,
        minWidth: $(win).parent().width() * 0.2,
        minHeight: $(win).parent().height() * 0.2
      });

      function onChange() {
        resizeInnerWindow(win);
        save();
      }

      win.onresize = onChange;
      win.ondrag = onChange;

      resizeInnerWindow(win);
    });

    updateResizeOriginal();
    updateCloneOriginal();
    updateFocus();
  }


  // add input handlers
  {
    resizeOriginal.onchange = updateResizeOriginal;
    cloneOriginal.onchange = updateCloneOriginal;
    focusOptions.forEach(el => el.onchange = updateFocus);
    Array.from(document.getElementsByTagName('input')).forEach(el => el.onclick = save);
    document.getElementById('commandsUrl').onclick = event => {
      chrome.tabs.create({ url: event.target.href });
    };
  }
});
