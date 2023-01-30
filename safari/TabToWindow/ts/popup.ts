import {
  CloneMode,
  CommandName,
  COMMANDS,
  IOptions,
  Keybindings,
  PopupState,
  WindowID,
  WindowProperty,
  WindowType,
} from "./api.js";
import { defAtom } from "./defAtom.js";
import { getFromClass, getFromId, getFromIdOrThrow, getFromTag } from "./domUtils.js";
import { getCloneBounds } from "./getCloneBounds.js";
import {
  OnKeybindingAlreadyAssigned,
  OnKeybindingsUpdated,
  setupKeybinding,
} from "./keybinding.js";
import { keybindingToString } from "./keybindingToString.js";
import { getOptions, getStorageWindowPropKey, Options } from "./options-storage.js";

// Helper functions
// -----------------------------------------------------------------------------

// window that will be focused on pop-out
const getFocusedName = (): WindowID => {
  const focused = getFromClass<HTMLInputElement>("focus-option").find((option) => option.checked);
  return focused === undefined || focused.id === "focus-original" ? "original" : "new";
};

getOptions()
  .then((options) => {
    // save current state
    const save = () => {
      const update: Partial<IOptions> = {
        focus: getFocusedName(),
        resizeOriginal: getFromId<HTMLInputElement>("resize-original").checked,
        copyFullscreen: getFromId<HTMLInputElement>("copy-fullscreen").checked,
        cloneMode: getFromClass<HTMLInputElement>("clone-mode-option").find((cp) => cp.checked)!
          .id as CloneMode,
        menuButtonType: getFromClass<HTMLInputElement>("menu-button-option")
          .find((mb) => mb.checked)
          ?.getAttribute("data-value") as WindowType,
      };

      // dimensions
      getFromClass("window").forEach((win) => {
        (
          [
            ["offsetWidth", "offsetWidth", "width"],
            ["offsetHeight", "offsetHeight", "height"],
            ["offsetLeft", "offsetWidth", "left"],
            ["offsetTop", "offsetHeight", "top"],
          ] as const
        ).forEach(([prop, dim, setProp]) => {
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
    const updateWindowHandling = (
      inputId: string,
      windowId: WindowID,
      enableIfChecked: boolean,
    ) => {
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
      getFromClass("window").forEach((win) => {
        const isBlurred = win.id !== getFocusedName();
        isBlurred ? win.classList.add("blurred") : win.classList.remove("blurred");
      });
    };

    const setWindowAsCurrent = (win: HTMLElement) => {
      getFromClass("window").forEach((_win) => {
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

    const main = async (options: Options) => {
      {
        const ASSIGN_CLASS = "shortcut-assign";
        const SHORTCUT_CLASS = "shortcut";
        // display shortcuts
        // -----------------------------------------------------------------------
        const db = defAtom<PopupState>({ commandBeingAssignedTo: undefined });

        const getShortcutElId = (commandName: CommandName) => `shortcut-${commandName}`;
        const getAssignElId = (commandName: CommandName) => `${ASSIGN_CLASS}-${commandName}`;
        const getClearElId = (commandName: CommandName) => `clear-${commandName}`;

        const updateKeybindingsView = (newKeybindings: Keybindings) => {
          for (const command of COMMANDS) {
            const keybinding = newKeybindings[command.name];

            const shortcutEl = getFromIdOrThrow(getShortcutElId(command.name));
            shortcutEl.textContent = keybindingToString(keybinding);

            const clearEl = getFromIdOrThrow<HTMLButtonElement>(getClearElId(command.name));
            const isEnabled = keybinding !== undefined;
            clearEl.disabled = !isEnabled;
            clearEl.style.opacity = `${isEnabled ? 1.0 : 0.5}`;
          }
        };

        const startAssigning = (commandName: CommandName) =>
          db.set({ commandBeingAssignedTo: commandName });

        const clearAssignment = (commandName: CommandName) => {
          const newKeybindings: Keybindings = {
            ...options.get("keybindings"),
            [commandName]: undefined,
          };

          options.update({ keybindings: newKeybindings });

          updateKeybindingsView(newKeybindings);

          db.set({ commandBeingAssignedTo: undefined });
        };

        {
          // create elements
          const keybindings = options.get("keybindings");

          const shortcutList = getFromId("shortcut-list");

          for (const command of COMMANDS) {
            const li = document.createElement("li");
            shortcutList.appendChild(li);

            const name = document.createElement("span");
            name.textContent = `${command.description}:`;
            name.classList.add("shortcut-label");
            li.appendChild(name);

            const shortcut = document.createElement("span");
            shortcut.id = getShortcutElId(command.name);
            shortcut.classList.add(SHORTCUT_CLASS);
            li.appendChild(shortcut);

            const assign = document.createElement("button");
            assign.id = getAssignElId(command.name);
            assign.textContent = "🔴";
            assign.classList.add(ASSIGN_CLASS);
            assign.addEventListener("click", () => startAssigning(command.name));
            li.appendChild(assign);

            const clear = document.createElement("button");
            clear.id = getClearElId(command.name);
            clear.textContent = "❌";
            clear.addEventListener("click", () => clearAssignment(command.name));
            li.appendChild(clear);
          }

          updateKeybindingsView(keybindings);
        }

        db.addListener((state) => {
          if (state.commandBeingAssignedTo === undefined) {
            for (const el of getFromClass(ASSIGN_CLASS)) {
              el.style.backgroundColor = "white";
            }
          } else {
            const el = getFromIdOrThrow(getAssignElId(state.commandBeingAssignedTo));
            el.style.background = "red";
          }
        });

        // setup updates
        const onUpdated: OnKeybindingsUpdated = (newKeybindings: Keybindings) => {
          updateKeybindingsView(newKeybindings);
        };

        const onAlreadyAssigned: OnKeybindingAlreadyAssigned = (failed, existing) => {
          // TODO do this with better CSS
          const failedEl = getFromIdOrThrow(getShortcutElId(failed));
          failedEl.style.background = "red";
          failedEl.textContent = "Keys in use!";

          const existingEl = getFromIdOrThrow(getShortcutElId(existing));
          existingEl.style.background = "orange";

          setTimeout(() => {
            failedEl.style.background = "white";
            existingEl.style.background = "white";
          }, 3000);
        };

        setupKeybinding(db, onUpdated, onAlreadyAssigned);
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
        )!;
        curCloneOption.checked = true;
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

          const grid = (["clientWidth", "clientHeight"] as const).map((d) => {
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
        getFromClass("focus-option").forEach((el) => (el.onchange = updateFocus));
        getFromTag("input").forEach((el) => (el.onclick = save));
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

    onReady(() => main(options));
  })
  .catch((_reason) => {
    // TODO handle this
  });
