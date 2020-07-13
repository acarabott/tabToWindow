export const moveTabs = (tabs: chrome.tabs.Tab[], windowId: number, index: number) => {
  return new Promise<chrome.tabs.Tab[]>((resolve) => {
    const tabIds = tabs.reduce(
      (accum, tab) => (tab.id === undefined ? accum : [...accum, tab.id]),
      [] as number[],
    );

    chrome.tabs.move(tabIds, { windowId, index }, (movedTabs) =>
      resolve(Array.isArray(movedTabs) ? movedTabs : [movedTabs]),
    );
  });
};
