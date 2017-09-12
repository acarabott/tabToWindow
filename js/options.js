// keystroke saving variables
// none of these are removed from the DOM, so can be relied on
// so don't be dumb and remove them from the DOM
// -----------------------------------------------------------------------------
const focusOptions = Array.from(document.getElementsByClassName('focus-option'));
const resizeOriginal = document.getElementById('resize-original');
const cloneOriginal = document.getElementById('clone-original');
const clonePositions = Array.from(document.getElementsByName('clone-position'));
const copyFullscreen = document.getElementById('copy-fullscreen');


// Helper functions
// These should be functions that are called in more than one place
// -----------------------------------------------------------------------------

// window that will be focused on pop-out
function get_focus_name() {
  const focused = focusOptions.find(option => option.checked);
  return focused === undefined ? 'original' : focused.id.replace('focus-', '');
}


// save current state
function save() {
  localStorage.ttw_focus = get_focus_name();
  localStorage.ttw_resize_original = resizeOriginal.checked;
  localStorage.ttw_clone_original = cloneOriginal.checked;

  // Save to Local Storage

  // dimensions
  Array.from(document.getElementsByClassName('option')).forEach(input => {
    localStorage[`ttw_${input.id}`] = input.valueAsNumber;
  });

  // close position options
  localStorage.ttw_clone_position = clonePositions.find(cp => cp.checked).id;

  // fullscreen status
  localStorage.ttw_copy_fullscreen = copyFullscreen.checked;
}



// TODO refactor into two functions
function update_window_size_and_position(win) {
  // update view
  const userScreen = document.getElementById('screen');
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


  // update form fields
  [['Width'], ['Height'], ['Left', 'Width'], ['Top', 'Height']].forEach(pair => {
    const windowDimension = win[`offset${pair[0]}`];
    const screenDimension = userScreen[`offset${pair[1 % pair.length]}`];
    const value = Math.floor((windowDimension / screenDimension) * 100);
    document.getElementById(`${win.id}-${pair[0].toLowerCase()}`).value = value;
  });
}


// initial setup of windows
function setup_windows(gridsize) {
  const userScreen = document.getElementById('screen');
  const screenHeight = userScreen.clientHeight;

  Array.from(document.getElementsByClassName('window')).forEach(win => {
    // Restore positions from options
    ['width', 'height', 'left', 'top'].forEach(prop => {
      win.style[prop] = `${document.getElementById(`${win.id}-${prop}`).value}%`;
    });

    const grid = [userScreen.clientWidth / gridsize,
                  userScreen.clientHeight / gridsize];

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

    function onChange(event) {
       update_window_size_and_position(win);
       save();
    }

    win.onresize = onChange;
    win.ondrag = onChange;

  });
}


// changing draggable/resizable windows, used when radio buttons override
// resizing and positioning
function update_window_handling (input_id, window_id, enable_if_checked) {
  const $input =  $(input_id);
  const $win =    $(window_id);
  const checked = $input.prop('checked');
  const enable =  enable_if_checked ? checked : !checked;
  const action =  enable ? 'enable' : 'disable';

  $win.draggable(action);
  $win.resizable(action);
}

function update_resize_original() {
  update_window_handling('#resize-original', '#original', true);
}

function update_clone_original () {
  update_window_handling('#clone-original', '#new', false);

  // toggle clone position controls if cloning enabled/disabled
  Array.from(document.getElementsByClassName('clone-position-option')).forEach(opt => {
    opt.disabled = !cloneOriginal.checked;
  });

  const clonePositionOptions = document.getElementById('clone-position-options');
  clonePositionOptions.style.display = cloneOriginal.checked ? '' : 'none';
}


// update appearance of windows depending on if they are active or not
function update_focus() {
  function getElements(id) {
    const parent = document.getElementById(id);
    return ['inner-window', 'button'].reduce((accumulator, className) => {
      return accumulator.concat(Array.from(parent.getElementsByClassName(className)));
    }, []);
  }

  ['original', 'new'].forEach(id => {
    getElements(id).forEach(element => {
      element.style.opacity = get_focus_name() === id
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

  const defaults = {
    "original": { width: 50, height: 100, left: 0, top: 0 },
    "new": { width: 50, height: 100, left: 50, top: 0 }
  };
  Object.keys(defaults).forEach(wKey => {
    Object.keys(defaults[wKey]).forEach(pKey => {
      const id = `${wKey}-${pKey}`;
      const localId = `ttw_${id}`;
      document.getElementById(id).value = localStorage.hasOwnProperty(localId)
        ? localStorage[localId]
        : defaults[wKey][pKey];
    });
  });
}


// add input handlers
{
  resizeOriginal.onchange = update_resize_original;
  cloneOriginal.onchange = update_clone_original;
  focusOptions.forEach(el => el.onchange = update_focus);
}


// setup windows
{
  setup_windows(gridsize);
  update_resize_original();
  update_clone_original();
  update_focus();
}

// display_shortcuts
{
  chrome.commands.getAll(cmds => {
    if (cmds.length === 0) {
      return;
    }
    const $shortcuts = $('#shortcuts');
    const $ul = $('#shortcut-list');

    cmds.forEach((cmd, i) => {
      const $li = $('<li>');
      const desc = cmd.description;
      const $shortcuts = $('<span>');
      $shortcuts.addClass('shortcut');
      $shortcuts.text(cmd.shortcut);
      $li.append(desc);
      $li.append(': ');
      $li.append($shortcuts);
      $ul.append($li);
    });
  });
}

{
  $('.window').trigger('resize');
  $('#extensions').click(event => {
    chrome.tabs.update({
      url: $(this).attr('href')
    });
  });

  [
  '#sub', '.focus-option', '#resize-original', '#clone-original',
   '#clone-position-same', '#clone-position-horizontal',
   '#clone-position-vertical', '#copy-fullscreen'
  ].forEach((item, i) => $(item).click(save));
}
