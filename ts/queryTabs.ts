export const queryTabs = async (queryInfo: chrome.tabs.QueryInfo) => {
  const tabs = await chrome.tabs.query(queryInfo);
  const tabsArray = Array.isArray(tabs) ? tabs : [tabs];
  return tabsArray;
};
