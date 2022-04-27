import browser from "webextension-polyfill";
import { tabToNeighbouringWindow, tabToNextDisplay, tabToWindowNormal, tabToWindowPopup } from "./actions-tabs";
import {
  COMMAND_DISPLAY,
  COMMAND_NEXT,
  COMMAND_NORMAL,
  COMMAND_POPUP,
  COMMAND_PREVIOUS,
  isCommandMessage
} from "./api";

browser.runtime.onMessage.addListener((message, _sender) => {
  if (isCommandMessage(message)) {
    switch (message.command) {
      case COMMAND_NORMAL:
        void tabToWindowNormal();
        break;

      case COMMAND_NORMAL:
        void tabToWindowNormal();
        break;
      case COMMAND_POPUP:
        void tabToWindowPopup();
        break;
      case COMMAND_NEXT:
        void tabToNeighbouringWindow(1);
        break;
      case COMMAND_PREVIOUS:
        void tabToNeighbouringWindow(-1);
        break;
      case COMMAND_DISPLAY:
        void tabToNextDisplay();
        break;

      default:
        break;
    }
  }
});
