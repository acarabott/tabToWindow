/** Helper to perform actions once the background page has been activated
 * Without this, the first action (e.g. keyboard shortcut) will only wake up
 * the background page, and not perform the action
 */
export const doBackgroundAction = (action: () => void) => {
  chrome.runtime.getBackgroundPage((_backgroundPage) => action());
};
