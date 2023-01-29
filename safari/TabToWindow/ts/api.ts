import browser from "webextension-polyfill";
import { ScanCode } from "./ScanCode";
export const windowIds = ["original", "new"] as const;
export type WindowID = typeof windowIds[number];

export const windowProperties = ["width", "height", "left", "top"] as const;
export type WindowProperty = typeof windowProperties[number];

type Extends<T, U extends T> = U;
export type WindowType = Extends<browser.Windows.CreateType, "normal" | "popup">;
export const windowTypes = ["normal", "popup"] as const;

export const cloneModes = [
  "clone-mode-no",
  "clone-mode-same",
  "clone-mode-horizontal",
  "clone-mode-vertical",
] as const;
export type CloneMode = typeof cloneModes[number];

export const storedWindowBounds = [
  "originalWidth",
  "originalHeight",
  "originalLeft",
  "originalTop",
  "newWidth",
  "newHeight",
  "newLeft",
  "newTop",
] as const;
export type StoredWindowProperty = typeof storedWindowBounds[number];

export interface IBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface IKeybinding {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  altGraphKey: boolean;
  code: ScanCode;
  display: string;
}

export const COMMAND_NORMAL = "01-tab-to-window-normal";
export const COMMAND_POPUP = "02-tab-to-window-popup";
export const COMMAND_NEXT = "03-tab-to-window-next";
export const COMMAND_PREVIOUS = "04-tab-to-window-previous";
export const COMMAND_DISPLAY = "05-tab-to-window-display";
export type CommandName =
  | typeof COMMAND_NORMAL
  | typeof COMMAND_POPUP
  | typeof COMMAND_NEXT
  | typeof COMMAND_PREVIOUS
  | typeof COMMAND_DISPLAY;

export interface IOptions {
  cloneMode: CloneMode;
  copyFullscreen: boolean;
  focus: WindowID;
  menuButtonType: WindowType;
  newHeight: number;
  newLeft: number;
  newTop: number;
  newWidth: number;
  originalHeight: number;
  originalLeft: number;
  originalTop: number;
  originalWidth: number;
  resizeOriginal: boolean;
  keybindings: {
    [COMMAND_NORMAL]: IKeybinding | undefined;
    [COMMAND_POPUP]: IKeybinding | undefined;
    [COMMAND_NEXT]: IKeybinding | undefined;
    [COMMAND_PREVIOUS]: IKeybinding | undefined;
    [COMMAND_DISPLAY]: IKeybinding | undefined;
  };
}

export const isIOptions = (obj: unknown): obj is IOptions => {
  const cast = obj as IOptions;
  return (
    cast !== undefined &&
    cloneModes.includes(cast.cloneMode) &&
    typeof cast.copyFullscreen === "boolean" &&
    windowIds.includes(cast.focus) &&
    (cast.menuButtonType === "normal" || cast.menuButtonType === "popup") &&
    typeof cast.newHeight === "number" &&
    typeof cast.newLeft === "number" &&
    typeof cast.newTop === "number" &&
    typeof cast.newWidth === "number" &&
    typeof cast.originalHeight === "number" &&
    typeof cast.originalLeft === "number" &&
    typeof cast.originalTop === "number" &&
    typeof cast.originalWidth === "number" &&
    typeof cast.resizeOriginal === "boolean"
  );
};

// Constants
export const MENU_TAB_TO_WINDOW_ID = "tab to window";
export const MENU_TAB_TO_POPUP_ID = "tab to popup";
export const MENU_TAB_TO_NEXT_ID = "tab to next";
export const MENU_TAB_TO_PREVIOUS_ID = "tab to previous";
export const MENU_TAB_TO_DISPLAY_ID = "tab to display";
export const MENU_TYPE_PARENT_ID = "type parent";
export const MENU_WINDOW_OPTION_ID = "window option";
export const MENU_POPUP_OPTION_ID = "popup option";
export const MENU_FOCUS_PARENT_ID = "focus parent";
export const MENU_FOCUS_ORIGINAL_OPTION_ID = "focus original option";
export const MENU_FOCUS_NEW_OPTION_ID = "focus new option";
export const MENU_LINK_TO_WINDOW_ID = "link to window";
export const MENU_LINK_TO_POPUP_ID = "link to popup";
export const MENU_LINK_TO_NEXT_ID = "link to next";
export const MENU_LINK_TO_PREVIOUS_ID = "link to previous";
export const MENU_LINK_TO_DISPLAY_ID = "link to display";

export interface Command {
  name: CommandName;
  description: string;
}

export const COMMANDS: Command[] = [
  { name: COMMAND_NORMAL, description: "Window" },
  { name: COMMAND_POPUP, description: "Popup" },
  { name: COMMAND_NEXT, description: "Next Window" },
  { name: COMMAND_PREVIOUS, description: "Previous Window" },
  { name: COMMAND_DISPLAY, description: "Next Display" },
];

const COMMAND_NAMES = [
  COMMAND_NORMAL,
  COMMAND_POPUP,
  COMMAND_NEXT,
  COMMAND_PREVIOUS,
  COMMAND_DISPLAY,
] as const;

export interface CommandMessage {
  commandName: CommandName;
}

export const isCommandMessage = (obj: unknown): obj is CommandMessage => {
  const cast = obj as CommandMessage;
  return cast !== undefined && COMMAND_NAMES.includes(cast.commandName);
};

export interface PopupState {
  commandBeingAssignedTo: CommandName | undefined;
}
