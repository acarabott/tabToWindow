import browser from "webextension-polyfill";

const title = document.createElement("h1");
title.textContent = "init";
document.body.appendChild(title);

const testButton = document.createElement("button");
testButton.textContent = "Test";
testButton.addEventListener("click", async () => {
  title.textContent = `${Math.random().toFixed(2)}`;

  try {
    const origWindow = await browser.windows.getCurrent({ populate: true });
    if (origWindow.tabs !== undefined) {
      const activeTab = origWindow.tabs.find((tab) => tab.active);

      if (activeTab !== undefined && origWindow.id !== undefined) {
        // try {
        //   const updatePromise = browser.windows.update(origWindow.id, {
        //     state: "normal",
        //     left: 0,
        //     top: 0,
        //     width: screen.availWidth * 0.5,
        //     height: screen.availHeight,
        //   });
        //   browser.windows.create({
        //     tabId: activeTab.id,
        //     incognito: activeTab.incognito,
        //     state: "normal",
        //     left: screen.availWidth * 0.5,
        //     top: 0,
        //     width: screen.availWidth * 0.5,
        //     height: screen.availHeight,
        //   });
        // } catch (error) {
        //   console.error(error);
        // }
      }
    }
  } catch (error) {
    // console.error(error);
  }
});
document.body.appendChild(testButton);
