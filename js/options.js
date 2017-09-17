/* eslint browser: true */
/* global getStorageWindowPropKey, saveOptions, chrome, $ */

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
  const options = {
    focus: getFocusedName(),
    resizeOriginal: getFromId('resize-original').checked,
    cloneOriginal: getFromId('clone-original').checked,
    copyFullscreen: getFromId('copy-fullscreen').checked,
    clonePosition: getFromClass('clone-position-option').find(cp => cp.checked).id,
    menuButtonType: getFromClass('menu-button-option').find(mb => mb.checked).getAttribute('data-value')
  };

  // dimensions
  getFromClass('window').forEach(win => {
    [['Width', 'Width'],
     ['Height', 'Height'],
     ['Left', 'Width'],
     ['Top', 'Height']].forEach(([prop, dim]) => {
      const windowDimension = win[`offset${prop}`];
      const screenDimension = getFromId('screen')[`offset${dim}`];
      const value = windowDimension / screenDimension;
      options[getStorageWindowPropKey(win.id, prop)] = value;
    });
  });

  saveOptions(options);
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



// Each chunk has specifically *not* been broken out into a named function
// as then it's more difficult to tell when / where they are being called
// and if it's more than one
function main(options) {
  // display shortcuts
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


  // restore options
  {
    getFromClass('focus-option').forEach(opt => {
      opt.checked = opt.id.includes(options.focus);
    });
    getFromId('resize-original').checked = options.resizeOriginal;
    getFromId('clone-original').checked = options.cloneOriginal;
    getFromClass('clone-position-option').find(cp => {
      return cp.id === options.clonePosition;
    }).checked = true;
    getFromId('copy-fullscreen').checked = options.copyFullscreen;
    getFromClass('menu-button-option').forEach(opt => {
      opt.checked = opt.id.includes(options.menuButtonType);
    });
  }


  // setup windows
  {
    getFromClass('window').forEach(win => {
      // Restore positions from options
      ['width', 'height', 'left', 'top'].forEach(prop => {
        const key = getStorageWindowPropKey(win.id, prop);
        win.style[prop] = `${options[key] * 100}%`;
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


      let saveTimeout;
      function onChange() {
        resizeInnerWindow(win);
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(save, 200);
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
}
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadOptions().then(options => main(options));
});
