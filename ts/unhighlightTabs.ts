export const unhighlightTabs = (tabs: chrome.tabs.Tab[]) => {
  for (const tab of tabs) {
    if (tab.id !== undefined) {
      void chrome.tabs.update(tab.id, { highlighted: false });
    }
  }
};
