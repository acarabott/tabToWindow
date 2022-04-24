import browser from "webextension-polyfill";
import { COMMAND_NORMAL } from "./shared";

const onReady = (action: () => void) => {
  const isReady = document.readyState === "interactive" || document.readyState === "complete";
  isReady ? action() : document.addEventListener("DOMContentLoaded", action);
};

document.addEventListener("keydown", (event) => {
  if (event.altKey && event.code === "KeyX") {
    browser.runtime.sendMessage({ command: COMMAND_NORMAL }).then((response) => {
      console.log("Received response: ", response);
    });
  }
});

onReady(() => {
  console.log("tab to window content.ts");
});
