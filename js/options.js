(() => {
  const winGrid = 20; // px to use for window grid
  const defaults = {
    "original": {
      width:  50,
      height: 100,
      left:   0,
      top:    0,
    },
    "new": {
      width:  50,
      height: 100,
      left:   50,
      top:    0
    }
  };

  const focusOptions = Array.from(document.getElementsByClassName('focus-option'));
  const resizeOriginal = document.getElementById('resize-original');
  const cloneOriginal = document.getElementById('clone-original');
  const clonePositions = Array.from(document.getElementsByName('clone-position'));
  const copyFullscreen = document.getElementById('copy-fullscreen');

  function restore_options() {
    focusOptions.forEach(option => {
      option.checked = option.id.includes(localStorage.ttw_focus);
    });

    resizeOriginal.checked = localStorage.ttw_resize_original === 'true';
    cloneOriginal.checked = localStorage.ttw_clone_original === 'true';

    clonePositions.find(cp => cp.id === localStorage.ttw_clone_position).checked = true;

    copyFullscreen.checked = localStorage.ttw_copy_fullscreen === 'true';

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

  function get_focus_name() {
    const focused = focusOptions.find(option => option.checked);
    return focused === undefined ? 'original' : focused.id.replace('focus-', '');
  }

  function save(event) {
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

  function update_window_handling (input_id, window_id, enable_if_checked) {
    const $input =  $(input_id);
    const $win =    $(window_id);
    const checked = $input.prop('checked');
    const enable =  enable_if_checked ? checked : !checked;
    const action =  enable ? 'enable' : 'disable';

    $win.draggable(action);
    $win.resizable(action);
  }

  function update_resize_original () {
    update_window_handling('#resize-original', '#original', true);
  }

  function update_clone_original () {
    update_window_handling('#clone-original', '#new', false);

    const input = document.getElementById('clone-original');
    // toggle clone position controls if cloning enabled/disabled
    Array.from(document.getElementsByClassName('clone-position-option')).forEach(opt => {
      opt.disabled = !input.checked;
    });

    const clonePositionOptions = document.getElementById('clone-position-options');
    clonePositionOptions.style.display = input.checked ? '' : 'none';
  }

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

  function resize_screen() {
    const userScreen = document.getElementById('monitor'),
      width = userScreen.clientWidth,
      ratio = screen.height / screen.width,
      height = Math.round(width * ratio / winGrid) * winGrid;

    userScreen.style.height =  `${height}`;
  }

  function open_extensions() {
    chrome.tabs.update({
      url: $(this).attr('href')
    });
  }

  function update_window_size_and_position(win, ui) {
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
    ['Width', 'Height'].forEach(dimension => {
      const property = `offset${dimension}`;
      const value = Math.floor((win[property] / userScreen[property]) * 100);
      document.getElementById(`${win.id}-${dimension.toLowerCase()}`).value = value;
    });

    if (ui !== undefined) {
      const left = Math.floor((ui.position.left / userScreen.offsetWidth) * 100);
      document.getElementById(`${win.id}-left`).value = left;
      const top = Math.floor((ui.position.top / userScreen.offsetHeight) * 100);
      document.getElementById(`${win.id}-top`).value = top;
    }
  }

  function setup_windows() {
    const $windows = $('.window'),
      $userScreen = $('#screen'),
      screenWidth = $userScreen.width(),
      screenHeight = $userScreen.height();

    // Restore positions from options
    $('.window').each(function () {
      const $this = $(this);
      const id = $this.attr('id');
      $this.width(`${$(`#${id}-width`).val()}%`);
      $this.height(`${$(`#${id}-height`).val()}%`);
      $this.css('left', `${$(`#${id}-left`).val()}%`);
      $this.css('top', `${$(`#${id}-top`).val()}%`);

      $this.draggable({
        containment: "parent",
        grid: [screenWidth / winGrid, screenHeight / winGrid]
      });

      $this.resizable({
        containment: "parent",
        handles: "all",
        grid: [screenWidth / winGrid, screenHeight / winGrid],
        minWidth: $this.parent().width() * 0.2,
        minHeight: $this.parent().height() * 0.2
      });

      $this.on('resize', (event, ui) => {
        update_window_size_and_position(this, ui);
        save();
      });

      $this.on('drag', (event, ui) => {
        update_window_size_and_position(this, ui);
        save();
      });
    });

    update_resize_original();
    update_clone_original();
    update_focus();
  }

  function display_shortcuts () {
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

  jQuery(document).ready(($) => {
    resize_screen();
    restore_options();

    // add input handlers
    document.getElementById('resize-original').onchange = update_resize_original;
    document.getElementById('clone-original').onchange = update_clone_original;
    Array.from(document.getElementsByClassName('focus-option')).forEach(el => {
      el.onchange = update_focus;
    });

    setup_windows();
    display_shortcuts();

    $('.window').trigger('resize');
    $('#extensions').click(open_extensions);

    [
    '#sub', '.focus-option', '#resize-original', '#clone-original',
     '#clone-position-same', '#clone-position-horizontal',
     '#clone-position-vertical', '#copy-fullscreen'
    ].forEach((item, i) => $(item).click(save));
  });
})();
