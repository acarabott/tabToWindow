import { options, isCloning } from "./options-storage.js";
import { getCloneBounds } from "./clone.js";
import { WindowID, IOptions, WindowType, WindowProperty } from "./api.js";

// Helper functions
// These should be functions that are called in more than one place
// -----------------------------------------------------------------------------

function getFromId<T extends HTMLElement>(id: string, root = document) {
  return root.getElementById(id) as T;
}

function getFromClass<T extends HTMLElement>(className: string, root = document) {
  return Array.from(root.getElementsByClassName(className)) as T[];
}

function getFromTag<T extends HTMLElement>(tagName: string, root = document) {
  return Array.from(root.getElementsByTagName(tagName)) as T[];
}

// window that will be focused on pop-out
function getFocusedName(): WindowID {
  const focused = getFromClass<HTMLInputElement>("focus-option").find(option => option.checked);
  return focused === undefined || focused.id === "focus-original" ? "original" : "new";
}

// save current state
function save() {
  options.set("focus", getFocusedName());
  options.set("resizeOriginal", getFromId<HTMLInputElement>("resize-original").checked);
  options.set("copyFullscreen", getFromId<HTMLInputElement>("copy-fullscreen").checked);
  options.set(
    "cloneMode",
    getFromClass<HTMLInputElement>("clone-mode-option").find(cp => cp.checked)!
      .id as IOptions["cloneMode"],
  );
  options.set(
    "menuButtonType",
    getFromClass<HTMLInputElement>("menu-button-option")
      .find(mb => mb.checked)
      ?.getAttribute("data-value") as WindowType,
  );

  // dimensions
  getFromClass("window").forEach(win => {
    ([
      ["offsetWidth", "offsetWidth", "width"],
      ["offsetHeight", "offsetHeight", "height"],
      ["offsetLeft", "offsetWidth", "left"],
      ["offsetTop", "offsetHeight", "top"],
    ] as const).forEach(([prop, dim, setProp]) => {
      const windowDimension = win[prop];
      const screenDimension = getFromId("screen")[dim];
      const value = windowDimension / screenDimension;
      options.setForWindow(win.id as WindowID, setProp, value);
    });
  });

  options.save();
}

// changing draggable/resizable windows, used when radio buttons override
// resizing and positioning
function updateWindowHandling(inputId: string, windowId: WindowID, enableIfChecked: boolean) {
  const checked = getFromId<HTMLInputElement>(inputId).checked;
  const action = enableIfChecked === checked ? "enable" : "disable";
  const $win = $(`#${windowId}`);
  $win.draggable(action);
  $win.resizable(action);
}

function updateResizeOriginal() {
  updateWindowHandling("resize-original", "original", true);
  const originalWin = getFromId("original");
  const isResizing = getFromId<HTMLInputElement>("resize-original").checked;
  isResizing ? originalWin.classList.remove("disabled") : originalWin.classList.add("disabled");
}

function updateResizeNew() {
  const inputId = "clone-mode-no";
  const windowId = "new";
  const enableIfChecked = true;
  updateWindowHandling(inputId, windowId, enableIfChecked);
}

function updateClone() {
  const originalWin = getFromId("original");
  const newWin = getFromId("new");
  newWin.style.width = originalWin.style.width;
  newWin.style.height = originalWin.style.height;

  const monitor = getFromId("monitor");
  const displayBounds = {
    left: 0,
    top: 0,
    width: monitor.clientWidth,
    height: monitor.clientHeight,
  };

  const origBounds = {
    left: originalWin.offsetLeft,
    top: originalWin.offsetTop,
    width: originalWin.offsetWidth,
    height: originalWin.offsetHeight,
  };

  const newBounds = getCloneBounds(origBounds, displayBounds, options.get("cloneMode"));

  (Object.entries(newBounds) as Array<[WindowProperty, number]>).forEach(([key, value]) => {
    newWin.style[key] = `${value}px`;
  });
}

// update appearance of windows depending on if they are active or not
function updateFocus() {
  getFromClass("window").forEach(win => {
    const isBlurred = win.id !== getFocusedName();
    isBlurred ? win.classList.add("blurred") : win.classList.remove("blurred");
  });
}

function setWindowAsCurrent(win: HTMLElement) {
  getFromClass("window").forEach(_win => {
    _win === win ? _win.classList.add("current") : _win.classList.remove("current");
  });
}

function updateMaxDimensions() {
  const cloneMode = options.get("cloneMode");
  const $original = $("#original");

  const maxWidth =
    cloneMode === "clone-mode-horizontal" ? $original.parent().width()! * 0.8 : Infinity;

  $original.resizable("option", "maxWidth", maxWidth);

  const maxHeight =
    cloneMode === "clone-mode-vertical" ? $original.parent().height()! * 0.8 : Infinity;

  $original.resizable("option", "maxHeight", maxHeight);
}

// Main Function
// -----------------------------------------------------------------------------
// Each chunk has specifically *not* been broken out into a named function
// as then it's more difficult to tell when / where they are being called
// and if it's more than one

function main() {
  // display shortcuts
  {
    chrome.commands.getAll(cmds => {
      if (cmds.length === 0) {
        return;
      }

      cmds
        .filter(cmd => cmd.name !== "_execute_browser_action")
        .forEach(cmd => {
          const name = document.createElement("span");
          name.textContent = `${cmd.description}:`;
          name.classList.add("shortcut-label");

          const shortcut = document.createElement("span");
          shortcut.classList.add("shortcut");
          shortcut.textContent = cmd.shortcut!;

          const li = document.createElement("li");
          [name, shortcut].forEach(el => li.appendChild(el));

          getFromId("shortcut-list").appendChild(li);
        });
    });
  }

  const gridsize = 20; // px to use for window grid
  // Set monitor aspect ratio to match user's
  {
    const monitor = getFromId("monitor");
    const ratio = screen.height / screen.width;
    const height = Math.round((monitor.clientWidth * ratio) / gridsize) * gridsize;
    monitor.style.height = `${height}px`;
  }

  // restore options
  {
    getFromClass<HTMLInputElement>("focus-option").forEach(opt => {
      opt.checked = opt.id.includes(options.get("focus"));
    });
    getFromId<HTMLInputElement>("resize-original").checked = options.get("resizeOriginal");
    const curCloneOption = getFromClass<HTMLInputElement>("clone-mode-option").find(
      cp => cp.id === options.get("cloneMode"),
    )!;
    curCloneOption.checked = true;
    getFromId<HTMLInputElement>("copy-fullscreen").checked = options.get("copyFullscreen");
    getFromClass<HTMLInputElement>("menu-button-option").forEach(opt => {
      opt.checked = opt.id.includes(options.get("menuButtonType"));
    });
  }

  // setup windows
  {
    getFromClass("window").forEach(win => {
      // Restore positions from options
      (["width", "height", "left", "top"] as WindowProperty[]).forEach(prop => {
        win.style[prop] = `${options.getForWindow(win.id as WindowID, prop) * 100}%`;
      });

      const grid = (["clientWidth", "clientHeight"] as const).map(d => {
        return getFromId("screen")[d] / gridsize;
      });

      let saveTimeout: number;
      function update() {
        const shouldUpdateClone = win.id === "original" && isCloning();
        if (shouldUpdateClone) {
          updateClone();
        }

        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(save, 200);
      }

      const $win = $(win);

      $win.draggable({
        containment: "parent",
        grid,
        drag: update,
        start: update,
        stop: update,
      });

      $win.resizable({
        containment: "parent",
        handles: "all",
        grid: grid,
        minWidth: $win.parent().width()! * 0.2,
        minHeight: $win.parent().height()! * 0.2,
        resize: update,
        start: update,
        stop: update,
      });

      win.addEventListener("mousedown", () => setWindowAsCurrent(win), false);
      win.addEventListener("touchstart", () => setWindowAsCurrent(win), false);
    });

    updateResizeOriginal();
    updateResizeNew();
    updateFocus();
    updateMaxDimensions();
    if (isCloning()) {
      updateClone();
    }
  }

  // add input handlers
  {
    getFromId("resize-original").onchange = updateResizeOriginal;
    getFromClass("focus-option").forEach(el => (el.onchange = updateFocus));
    getFromTag("input").forEach(el => (el.onclick = save));
    getFromId("commandsUrl").onclick = event => {
      chrome.tabs.create({ url: (event.target as HTMLAnchorElement).href });
    };
    getFromClass("clone-mode-option").forEach(el => {
      el.addEventListener(
        "change",
        () => {
          updateMaxDimensions();

          if (isCloning()) {
            updateClone();
          }

          setWindowAsCurrent(getFromId("original"));
          updateResizeNew();
        },
        false,
      );
    });
  }
}

// Loading
// -----------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  options.loadPromise.then(main);
});
