import { queryTabs } from "./queryTabs.js";

export const getHighlightedTabs = (windowId: number) => queryTabs({ windowId, highlighted: true });
