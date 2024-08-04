import type { IOptions, WindowID, WindowProperty } from "./api.js";
import { getCloneBounds } from "./getCloneBounds.js";
import { getStorageWindowPropKey } from "./getStorageWindowPropKey.js";
import { getOptions, isCloneMode, isMenuButtonType, isWindowID } from "./options.js";

const kMaxClonePercentage = 0.8;
const kMinClonePercentage = 1.0 - kMaxClonePercentage;
const kDefaultDimensionPx = 1000;

// Helper functions
// -----------------------------------------------------------------------------

const getFromId = <T extends HTMLElement>(id: string, root = document) =>
  root.getElementById(id) as T;

const getFromClass = <T extends HTMLElement>(className: string, root = document) =>
  Array.from(root.getElementsByClassName(className)) as T[];

const getFromTag = <T extends HTMLElement>(tagName: string, root = document) =>
  Array.from(root.getElementsByTagName(tagName)) as T[];

// window that will be focused on pop-out
const getFocusedName = (): WindowID => {
  const focused = getFromClass<HTMLInputElement>("focus-option").find((option) => option.checked);
  return focused === undefined || focused.id === "focus-original" ? "original" : "new";
};

void getOptions().then((options) => {
  // save current state
  const save = () => {
    const update: Partial<IOptions> = {
      focus: getFocusedName(),
      resizeOriginal: getFromId<HTMLInputElement>("resize-original").checked,
      copyFullscreen: getFromId<HTMLInputElement>("copy-fullscreen").checked,
    };

    const cloneModeEl = getFromClass<HTMLInputElement>("clone-mode-option").find(
      (cp) => cp.checked,
    );
    if (isCloneMode(cloneModeEl?.id)) {
      update.cloneMode = cloneModeEl.id;
    }

    const menuButtonEl = getFromClass<HTMLInputElement>("menu-button-option").find(
      (mb) => mb.checked,
    );
    const menuButtonValue = menuButtonEl?.getAttribute("data-value");
    if (isMenuButtonType(menuButtonValue)) {
      update.menuButtonType = menuButtonValue;
    }

    // window dimensions
    const screenEl = getFromId("screen");
    const screenOffsetWidth = screenEl.offsetWidth;
    const screenOffsetHeight = screenEl.offsetHeight;
    const windowEls = getFromClass("window");
    for (const windowEl of windowEls) {
      const windowId = windowEl.id;
      if (!isWindowID(windowId)) {
        throw new TypeError("Window element does not have a WindowID as its ID");
      }

      const windowWidth = windowEl.offsetWidth;
      const windowHeight = windowEl.offsetHeight;

      const left = windowEl.offsetLeft / screenOffsetWidth;
      const top = windowEl.offsetTop / screenOffsetHeight;
      const width = windowWidth / screenOffsetWidth;
      const height = windowHeight / screenOffsetHeight;

      switch (windowId) {
        case "original": {
          update.originalLeft = left;
          update.originalTop = top;
          update.originalWidth = width;
          update.originalHeight = height;
          break;
        }
        case "new": {
          update.newLeft = left;
          update.newTop = top;
          update.newWidth = width;
          update.newHeight = height;
          break;
        }
      }
    }

    void options.update(update);
  };

  // changing draggable/resizable windows, used when radio buttons override
  // resizing and positioning
  const updateWindowHandling = (inputId: string, windowId: WindowID, enableIfChecked: boolean) => {
    const checked = getFromId<HTMLInputElement>(inputId).checked;
    const action = enableIfChecked === checked ? "enable" : "disable";
    const $win = $(`#${windowId}`);
    $win.draggable(action);
    $win.resizable(action);
  };

  const updateResizeOriginal = () => {
    updateWindowHandling("resize-original", "original", true);
    const originalWin = getFromId("original");
    const isResizing = getFromId<HTMLInputElement>("resize-original").checked;
    if (isResizing) {
      originalWin.classList.remove("disabled");
    } else {
      originalWin.classList.add("disabled");
    }
  };

  const updateResizeNew = () => updateWindowHandling("clone-mode-no", "new", true);

  const updateClone = () => {
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

    (Object.entries(newBounds) as [WindowProperty, number][]).forEach(([key, value]) => {
      newWin.style[key] = `${value}px`;
    });
  };

  // update appearance of windows depending on if they are active or not
  const updateFocus = () => {
    getFromClass("window").forEach((win) => {
      const isBlurred = win.id !== getFocusedName();
      if (isBlurred) {
        win.classList.add("blurred");
      } else {
        win.classList.remove("blurred");
      }
    });
  };

  const setWindowAsCurrent = (win: HTMLElement) => {
    getFromClass("window").forEach((_win) => {
      if (_win === win) {
        _win.classList.add("current");
      } else {
        _win.classList.remove("current");
      }
    });
  };

  const updateMaxDimensions = () => {
    const cloneMode = options.get("cloneMode");
    const $original = $("#original");
    const $parent = $original.parent();

    let maxWidth = $parent.width() ?? kDefaultDimensionPx;
    if (cloneMode === "clone-mode-horizontal") {
      maxWidth *= kMaxClonePercentage;
    }
    $original.resizable("option", "maxWidth", maxWidth);

    let maxHeight = $parent.height() ?? kDefaultDimensionPx;
    if (cloneMode === "clone-mode-vertical") {
      maxHeight *= kMaxClonePercentage;
    }
    $original.resizable("option", "maxHeight", maxHeight);
  };

  // Main Function
  // ---------------------------------------------------------------------------
  // Each chunk has specifically *not* been broken out into a named function
  // as then it's more difficult to tell when / where they are being called
  // and if it's more than one

  const main = () => {
    {
      // display shortcuts
      // -----------------------------------------------------------------------
      void chrome.commands.getAll().then((cmds) => {
        if (cmds.length === 0) {
          return;
        }

        cmds
          .filter((cmd) => cmd.name !== "_execute_action")
          .forEach((cmd) => {
            const name = document.createElement("span");
            name.textContent = `${cmd.description}:`;
            name.classList.add("shortcut-label");

            const shortcut = document.createElement("span");
            shortcut.classList.add("shortcut");
            shortcut.textContent = cmd.shortcut ?? "";

            const li = document.createElement("li");
            [name, shortcut].forEach((el) => li.appendChild(el));

            getFromId("shortcut-list").appendChild(li);
          });
      });
    }

    const gridsize = 20; // px to use for window grid
    {
      // Set monitor aspect ratio to match user's
      // -----------------------------------------------------------------------
      const monitor = getFromId("monitor");
      const ratio = screen.height / screen.width;
      const height = Math.round((monitor.clientWidth * ratio) / gridsize) * gridsize;
      monitor.style.height = `${height}px`;
    }

    {
      // restore options
      // -----------------------------------------------------------------------
      getFromClass<HTMLInputElement>("focus-option").forEach((opt) => {
        opt.checked = opt.id.includes(options.get("focus"));
      });
      getFromId<HTMLInputElement>("resize-original").checked = options.get("resizeOriginal");
      const curCloneOption = getFromClass<HTMLInputElement>("clone-mode-option").find(
        (cp) => cp.id === options.get("cloneMode"),
      );
      if (curCloneOption !== undefined) {
        curCloneOption.checked = true;
      }
      getFromId<HTMLInputElement>("copy-fullscreen").checked = options.get("copyFullscreen");
      getFromClass<HTMLInputElement>("menu-button-option").forEach((opt) => {
        opt.checked = opt.id.includes(options.get("menuButtonType"));
      });
    }

    {
      // setup windows
      // -----------------------------------------------------------------------
      getFromClass("window").forEach((win) => {
        // Restore positions from options
        (["width", "height", "left", "top"] as WindowProperty[]).forEach((prop) => {
          const value = options.get(getStorageWindowPropKey(win.id as WindowID, prop));
          win.style[prop] = `${value * 100}%`;
        });

        const grid = (["clientWidth", "clientHeight"] as const).map(
          (d) => getFromId("screen")[d] / gridsize,
        );

        let saveTimeout: number;
        const update = () => {
          const shouldUpdateClone = win.id === "original" && options.isCloneEnabled;
          if (shouldUpdateClone) {
            updateClone();
          }

          clearTimeout(saveTimeout);
          saveTimeout = window.setTimeout(save, 200);
        };

        const $win = $(win);

        $win.draggable({
          containment: "parent",
          grid,
          drag: update,
          start: update,
          stop: update,
        });

        const $winParent = $win.parent();
        const winParentWidth = $winParent.width() ?? kDefaultDimensionPx;
        const winParentHeight = $winParent.height() ?? kDefaultDimensionPx;

        $win.resizable({
          containment: "parent",
          handles: "all",
          grid,
          minWidth: winParentWidth * kMinClonePercentage,
          minHeight: winParentHeight * kMinClonePercentage,
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
      if (options.isCloneEnabled) {
        updateClone();
      }
    }

    {
      // add input handlers
      // -----------------------------------------------------------------------
      getFromId("resize-original").onchange = updateResizeOriginal;
      getFromClass("focus-option").forEach((el) => (el.onchange = updateFocus));
      getFromTag("input").forEach((el) => (el.onclick = save));
      getFromId("commandsUrl").onclick = (event) => {
        void chrome.tabs.create({ url: (event.target as HTMLAnchorElement).href });
      };
      getFromClass("clone-mode-option").forEach((el) => {
        el.addEventListener(
          "change",
          () => {
            updateMaxDimensions();

            if (options.isCloneEnabled) {
              updateClone();
            }

            setWindowAsCurrent(getFromId("original"));
            updateResizeNew();
          },
          false,
        );
      });
    }
  };

  // Loading
  // ---------------------------------------------------------------------------

  const onReady = (action: () => void) => {
    if (document.readyState !== "loading") {
      action();
    } else {
      document.addEventListener("DOMContentLoaded", action);
    }
  };

  onReady(() => main());
});
