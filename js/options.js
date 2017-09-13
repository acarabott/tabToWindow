/* eslint browser: true */
/* global getLocalStorageWindowPropKey, chrome, $ */

// Helper functions
// These should be functions that are called in more than one place
// -----------------------------------------------------------------------------

function getFromId(id, root=document) {
  return root.getElementById(id);
}

function getFromClass(className, root=document) {
  return Array.from(root.getElementsByClassName(className));
}

function getFromTag(tagName, root=document) {
  return Array.from(root.getElementsByTagName(tagName));
}

// window that will be focused on pop-out
function getFocusedName() {
  const focused = getFromClass('focus-option').find(option => option.checked);
  return focused === undefined ? 'original' : focused.id.replace('focus-', '');
}

// save current state
function save() {
  localStorage.focus = getFocusedName();
  localStorage.resize_original = getFromId('resize-original').checked;
  localStorage.clone_original = getFromId('clone-original').checked;

  // Save to Local Storage

  // dimensions
  getFromClass('window').forEach(win => {
    [['Width', 'Width'],
     ['Height', 'Height'],
     ['Left', 'Width'],
     ['Top', 'Height']].forEach(([prop, dim]) => {
      const windowDimension = win[`offset${prop}`];
      const screenDimension = getFromId('screen')[`offset${dim}`];
      const value = windowDimension / screenDimension;
      localStorage[getLocalStorageWindowPropKey(win.id, prop)] = value;
    });
  });

  // close position options
  const clonePositions = getFromClass('clone-position-option');
  localStorage.clone_position = clonePositions.find(cp => cp.checked).id;

  // fullscreen status
  localStorage.copy_fullscreen = getFromId('copy-fullscreen').checked;
}


function resizeInnerWindow(win) {
  const inner = getFromClass('inner-window', win)[0];

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
  getFromClass('clone-position-option').forEach(opt => {
    opt.disabled = !getFromId('clone-original').checked;
  });

  const display = getFromId('clone-original').checked ? '' : 'none';
  getFromId('clone-position-options').style.display = display;
}


// update appearance of windows depending on if they are active or not
function updateFocus() {
  function getElements(id) {
    const parent = getFromId(id);
    return ['inner-window', 'button'].reduce((accumulator, className) => {
      return accumulator.concat(getFromClass(className, parent));
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
      if (cmds.length === 0) { return; }

      cmds
      .filter(cmd => cmd.name !== '_execute_browser_action')
      .forEach(cmd => {
        const name = document.createElement('span');
        name.textContent = `${cmd.description}:`;
        name.classList.add('shortcut-label');

        const shortcut = document.createElement('span');
        shortcut.classList.add('shortcut');
        shortcut.textContent = cmd.shortcut;

        const li = document.createElement('li');
        [name, shortcut].forEach(el => li.appendChild(el));

        getFromId('shortcut-list').appendChild(li);
      });

    });
  }

  const gridsize = 20; // px to use for window grid
  // Set monitor aspect ratio to match user's
  {
    const monitor = getFromId('monitor');
    const ratio = screen.height / screen.width;
    const height = Math.round((monitor.clientWidth * ratio) / gridsize) * gridsize;
    monitor.style.height =  `${height}px`;
  }


  // restore_options
  {
    getFromClass('focus-option').forEach(opt => {
      opt.checked = opt.id.includes(localStorage.focus);
    });
    getFromId('resize-original').checked = localStorage.resize_original === 'true';
    getFromId('clone-original').checked = localStorage.clone_original === 'true';
    getFromClass('clone-position-option').find(cp => {
      return cp.id === localStorage.clone_position;
    }).checked = true;
    getFromId('copy-fullscreen').checked = localStorage.copy_fullscreen === 'true';
  }


  // setup windows
  {
    getFromClass('window').forEach(win => {
      // Restore positions from options
      ['width', 'height', 'left', 'top'].forEach(prop => {
        const key = getLocalStorageWindowPropKey(win.id, prop);
        win.style[prop] = `${localStorage[key] * 100}%`;
      });

      const grid = ['clientWidth', 'clientHeight'].map(d => {
        return getFromId('screen')[d] / gridsize;
      });

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
    getFromId('resize-original').onchange = updateResizeOriginal;
    getFromId('clone-original').onchange = updateCloneOriginal;
    getFromClass('focus-option').forEach(el => el.onchange = updateFocus);
    getFromTag('input').forEach(el => el.onclick = save);
    getFromId('commandsUrl').onclick = event => {
      chrome.tabs.create({ url: event.target.href });
    };
  }
});
