export const getNeighbouringWindowId = async (currentWindowId: number, distance: number) => {
  const windows = await chrome.windows.getAll({ windowTypes: ["normal"] });
  const currentIndex = windows.findIndex((win) => win.id === currentWindowId);

  let nextIndex: number;
  // If the current window is a popup, it won't exist in the windows array.
  // TODO make this based on window left position instead of index
  if (currentIndex !== -1) {
    const i = currentIndex + distance;
    const max = windows.length;
    nextIndex = ((i % max) + max) % max; // wrapping in either direction
  } else {
    nextIndex = 0;
  }

  return windows[nextIndex]?.id;
};
