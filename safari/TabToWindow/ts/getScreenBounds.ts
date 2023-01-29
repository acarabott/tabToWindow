import { IBounds } from "./api";

export const getScreenBounds = (): IBounds => {
  const bounds: IBounds = {
    left: 0,
    top: 0,
    width: screen.availWidth,
    height: screen.availHeight,
  };

  return bounds;
};
