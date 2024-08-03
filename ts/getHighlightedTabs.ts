export const getHighlightedTabs = (windowId: number) => {
  return chrome.tabs.query({ windowId, highlighted: true });
};
