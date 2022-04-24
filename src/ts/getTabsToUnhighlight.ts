export const getTabsToUnhighlight = (windowId: number) => {
  return new Promise<chrome.tabs.Tab[]>((resolve) => {
    chrome.tabs.query({ windowId, highlighted: true }, (tabs) => {
      const tabsArray = Array.isArray(tabs) ? tabs : [tabs];
      resolve(tabsArray);
    });
  });
};
