export const getNeighbouringWindowId = async (currentWindowId: number, distance: number) => {
  const windows = await chrome.windows.getAll({ windowTypes: ["normal"] });

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
