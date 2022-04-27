import browser from "webextension-polyfill";

/**
 * Helper to perform actions once the background page has been activated
 * Without this, the first action (e.g. keyboard shortcut) will only wake up
 * the background page, and not perform the action
 * @param action action to perform once the background page is activated
 */
export const doBackgroundAction = (action: () => void) => {
  browser.runtime.getBackgroundPage().then((_backgroundPage) => action());
};
