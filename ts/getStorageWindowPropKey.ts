import { WindowID, WindowProperty, StoredWindowProperty } from "./api";

/**
 * retrieve the storage key for a particular window property
 */
export const getStorageWindowPropKey = (
  id: WindowID,
  key: WindowProperty,
): StoredWindowProperty => (
    {
      original: {
        left: "originalLeft",
        top: "originalTop",
        width: "originalWidth",
        height: "originalHeight",
      },
      new: {
        left: "newLeft",
        top: "newTop",
        width: "newWidth",
        height: "newHeight",
      },
    } as const
  )[id][key];
