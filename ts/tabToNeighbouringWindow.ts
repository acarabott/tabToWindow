import { doBackgroundAction } from "./doBackgroundAction.js";
import { getNeighbouringWindowId } from "./getNeighbouringWindowId.js";
import { getTabsToUnhighlight } from "./getTabsToUnhighlight.js";
import { moveTabs } from "./moveTabs.js";
import { unhighlightTabs } from "./unhighlightTabs.js";

export const tabToNeighbouringWindow = (windowDistance: number) => {
  doBackgroundAction(async () => {
    const tabsToMove = await new Promise<chrome.tabs.Tab[]>((resolve) =>
      chrome.tabs.query({ currentWindow: true, highlighted: true }, (tabs) => resolve(tabs)),
    );

    if (tabsToMove.length === 0) {
      return;
    }

    const nextWindowId = await getNeighbouringWindowId(tabsToMove[0].windowId, windowDistance);
    if (nextWindowId === undefined) {
      return;
    }

    // focus on next window
    await new Promise((resolve) => {
      chrome.windows.update(nextWindowId, { focused: true }, (win) => resolve(win));
    });

    // store tabs to unhighlight
    const tabsToUnhighlight = await getTabsToUnhighlight(nextWindowId);

    // move and highlight selected tabs
    const moveIndex = -1;
    const movedTabs = await moveTabs(tabsToMove, nextWindowId, moveIndex);
    await Promise.all(
      movedTabs.map((tab, i) => {
        return new Promise((tabResolve) => {
          chrome.tabs.update(
            tab.id!,
            { highlighted: true, active: i === movedTabs.length - 1 },
            (tab) => tabResolve(tab),
          );
        });
      }),
    );

    // unlight old tabs
    unhighlightTabs(tabsToUnhighlight);
  });
};
