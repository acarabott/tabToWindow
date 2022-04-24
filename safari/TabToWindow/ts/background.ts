import browser from "webextension-polyfill";

import { COMMAND_NORMAL } from "./shared.js";

browser.runtime.onMessage.addListener((message, sender) => {
  console.log("message:", message);
  console.log("sender:", sender);
})

browser.commands.onCommand.addListener((command) => {
  switch (command) {
    case COMMAND_NORMAL:
      console.log("normal!");
      break;
    default:
      console.log("default");
      break;
  }
});
