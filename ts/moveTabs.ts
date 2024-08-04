export const moveTabs = async (tabs: chrome.tabs.Tab[], windowId: number, index: number) => {
  const tabIds: number[] = [];
  for (const tab of tabs) {
    if (tab.id !== undefined) {
      tabIds.push(tab.id);
    }
  }

  const movedTabs = await chrome.tabs.move(tabIds, { windowId, index });
  const movedTabsArray = Array.isArray(movedTabs) ? movedTabs : [movedTabs];
  return movedTabsArray;
};
