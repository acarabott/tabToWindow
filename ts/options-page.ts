import { CloneMode, IOptions, Options, WindowID, WindowProperty, WindowType } from "./api.js";
import { getCloneBounds } from "./getCloneBounds.js";
import { getOptions, getStorageWindowPropKey } from "./options-storage.js";

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
  const focused = getFromClass<HTMLInputElement>("focus-option").find(option => option.checked);
  return focused === undefined || focused.id === "focus-original" ? "original" : "new";
};

getOptions().then(options => {
  // save current state
  const save = () => {
    const update: Partial<IOptions> = {
      focus: getFocusedName(),
      resizeOriginal: getFromId<HTMLInputElement>("resize-original").checked,
      copyState: getFromId<HTMLInputElement>("copy-state").checked,
      cloneMode: getFromClass<HTMLInputElement>("clone-mode-option").find(cp => cp.checked)!
        .id as CloneMode,
      menuButtonType: getFromClass<HTMLInputElement>("menu-button-option")
        .find(mb => mb.checked)
        ?.getAttribute("data-value") as WindowType,
    };

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
        update[getStorageWindowPropKey(win.id as WindowID, setProp)] = value;
      });
    });

    options.update(update);
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
    isResizing ? originalWin.classList.remove("disabled") : originalWin.classList.add("disabled");
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

    (Object.entries(newBounds) as Array<[WindowProperty, number]>).forEach(([key, value]) => {
      newWin.style[key] = `${value}px`;
    });
  };

  // update appearance of windows depending on if they are active or not
  const updateFocus = () => {
    getFromClass("window").forEach(win => {
      const isBlurred = win.id !== getFocusedName();
      isBlurred ? win.classList.add("blurred") : win.classList.remove("blurred");
    });
  };

  const setWindowAsCurrent = (win: HTMLElement) => {
    getFromClass("window").forEach(_win => {
      _win === win ? _win.classList.add("current") : _win.classList.remove("current");
    });
  };

  const updateMaxDimensions = () => {
    const cloneMode = options.get("cloneMode");
    const $original = $("#original");

    const maxWidth =
      cloneMode === "clone-mode-horizontal" ? $original.parent().width()! * 0.8 : Infinity;

    $original.resizable("option", "maxWidth", maxWidth);

    const maxHeight =
      cloneMode === "clone-mode-vertical" ? $original.parent().height()! * 0.8 : Infinity;

    $original.resizable("option", "maxHeight", maxHeight);
  };

  // Main Function
  // ---------------------------------------------------------------------------
  // Each chunk has specifically *not* been broken out into a named function
  // as then it's more difficult to tell when / where they are being called
  // and if it's more than one

  const main = (options: Options) => {
    {
      // display shortcuts
      // -----------------------------------------------------------------------
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
      getFromClass<HTMLInputElement>("focus-option").forEach(opt => {
        opt.checked = opt.id.includes(options.get("focus"));
      });
      getFromId<HTMLInputElement>("resize-original").checked = options.get("resizeOriginal");
      const curCloneOption = getFromClass<HTMLInputElement>("clone-mode-option").find(
        cp => cp.id === options.get("cloneMode"),
      )!;
      curCloneOption.checked = true;
      getFromId<HTMLInputElement>("copy-state").checked = options.get("copyState");
      getFromClass<HTMLInputElement>("menu-button-option").forEach(opt => {
        opt.checked = opt.id.includes(options.get("menuButtonType"));
      });
    }

    {
      // setup windows
      // -----------------------------------------------------------------------
      getFromClass("window").forEach(win => {
        // Restore positions from options
        (["width", "height", "left", "top"] as WindowProperty[]).forEach(prop => {
          const value = options.get(getStorageWindowPropKey(win.id as WindowID, prop));
          win.style[prop] = `${value * 100}%`;
        });

        const grid = (["clientWidth", "clientHeight"] as const).map(d => {
          return getFromId("screen")[d] / gridsize;
        });

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
      if (options.isCloneEnabled) {
        updateClone();
      }
    }

    {
      // add input handlers
      // -----------------------------------------------------------------------
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

  onReady(() => main(options));
});
