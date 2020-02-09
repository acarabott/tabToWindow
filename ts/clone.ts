import { IBounds, IOptions } from "./api";

function getPosAndLength(
  winPos: number,
  winLength: number,
  displayPos: number,
  displayLength: number,
) {
  const normWinPos = winPos - displayPos;
  const oppositeEdge = normWinPos + winLength;
  const oppositeGap = displayLength - oppositeEdge;
  const doesFit = winLength <= oppositeGap;
  const useOppositeGap = doesFit || normWinPos < oppositeGap;

  const pos = useOppositeGap ? displayPos + oppositeEdge : winPos - Math.min(winLength, normWinPos);

  const length = Math.min(winLength, useOppositeGap ? oppositeGap : normWinPos);

  return { pos, length };
}

function getHorzPosAndLength(winBounds: IBounds, displayBounds: IBounds) {
  return getPosAndLength(winBounds.left, winBounds.width, displayBounds.left, displayBounds.width);
}

function getVertPosAndLength(winBounds: IBounds, displayBounds: IBounds) {
  return getPosAndLength(winBounds.top, winBounds.height, displayBounds.top, displayBounds.height);
}

// find the position that has the most space and return the position
// and length to fill it.
// e.g. when cloning horizontally and the window is left: 25% width: 25%
// there is more space on the right side than the left, so use the right
// pos is left/top opposite is right/bottom

export function getCloneBounds(
  winBounds: IBounds,
  displayBounds: IBounds,
  cloneMode: IOptions["cloneMode"],
) {
  // copying all values covers the case of clone-mode-same
  const bounds = Object.assign({}, winBounds);
  if (cloneMode === "clone-mode-horizontal") {
    const { pos, length } = getHorzPosAndLength(bounds, displayBounds);
    bounds.left = pos;
    bounds.width = length;
  } else if (cloneMode === "clone-mode-vertical") {
    const { pos, length } = getVertPosAndLength(bounds, displayBounds);
    bounds.top = pos;
    bounds.height = length;
  }

  return bounds;
}
