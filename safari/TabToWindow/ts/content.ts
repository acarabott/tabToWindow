import browser from "webextension-polyfill";
import {
  CommandName,
  COMMAND_DISPLAY,
  COMMAND_NEXT,
  COMMAND_NORMAL,
  COMMAND_POPUP,
  COMMAND_PREVIOUS,
} from "./api";

const getCommandFromKeyboardEvent = (event: KeyboardEvent): CommandName | undefined => {
  // TODO get shortcuts from user options
  if (event.altKey && event.code === "KeyZ") {
    return COMMAND_NEXT;
  } else if (event.altKey && event.shiftKey && event.code === "KeyZ") {
    return COMMAND_PREVIOUS;
  } else if (event.altKey && event.code === "KeyX") {
    return COMMAND_NORMAL;
  } else if (event.altKey && event.code === "KeyC") {
    return COMMAND_POPUP;
  } else if (event.altKey && event.code === "KeyD") {
    return COMMAND_DISPLAY;
  }

  return undefined;
};

document.addEventListener("keydown", (event) => {
  const command = getCommandFromKeyboardEvent(event);
  if (command !== undefined) {
    browser.runtime.sendMessage({ command }).then((response) => {
      // TODO provide feedback
      console.log("Received response: ", response);
    });
  }
});
