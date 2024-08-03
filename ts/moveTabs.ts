export const moveTabs = (tabs: chrome.tabs.Tab[], windowId: number, index: number) => {
  const tabIds: number[] = [];
  for (const tab of tabs) {
    if (tab.id !== undefined) {
      tabIds.push(tab.id);
    }
  }

  const movedTabs = chrome.tabs.move(tabIds, { windowId, index });
  return movedTabs;
};
