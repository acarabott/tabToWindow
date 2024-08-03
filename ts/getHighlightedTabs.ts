import { queryTabs } from "./queryTabs.js";

export const getHighlightedTabs = (windowId: number) => {
  return queryTabs({ windowId, highlighted: true });
};
