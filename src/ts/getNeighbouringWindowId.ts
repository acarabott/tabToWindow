export const getNeighbouringWindowId = async (currentWindowId: number, distance: number) => {
  const windows = await new Promise<chrome.windows.Window[]>((resolve) => {
    chrome.windows.getAll({ windowTypes: ["normal"] }, (windows) => resolve(windows));
  });

  const currentIndex = windows.findIndex((win) => win.id === currentWindowId);
  if (currentIndex === -1) {
    return;
  }

  const i = currentIndex + distance;
  const max = windows.length;
  const nextIndex = ((i % max) + max) % max; // wrapping in either direction
  if (nextIndex === currentIndex) {
    return undefined;
  }

  return windows[nextIndex].id;
};
