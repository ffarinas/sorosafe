import type { TourPlacement } from "./types";

export type TourRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};
export type TourPosition = {
  top: number;
  left: number;
  placement?: TourPlacement;
  arrowOffset?: number;
};
const MARGIN = 16;
const GAP = 16;
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(n, Math.max(min, max)));

/** Keep both the spotlight and the measured card inside the visible viewport. */
export function spotlightRect(
  rect: TourRect,
  viewport: { width: number; height: number },
): TourRect {
  const left = clamp(rect.left - 7, 8, viewport.width - 8);
  const top = clamp(rect.top - 7, 8, viewport.height - 8);
  return {
    left,
    top,
    width: Math.max(
      0,
      clamp(rect.left + rect.width + 7, 8, viewport.width - 8) - left,
    ),
    height: Math.max(
      0,
      clamp(rect.top + rect.height + 7, 8, viewport.height - 8) - top,
    ),
  };
}

export function positionTour(
  target: TourRect | null,
  viewport: { width: number; height: number },
  card: { width: number; height: number },
  preferred: TourPlacement = "bottom",
): TourPosition {
  const limitX = viewport.width - card.width - MARGIN;
  const limitY = viewport.height - card.height - MARGIN;
  const center = {
    left: clamp((viewport.width - card.width) / 2, MARGIN, limitX),
    top: clamp((viewport.height - card.height) / 2, MARGIN, limitY),
  };
  if (!target) return center;
  const candidates: TourPlacement[] =
    viewport.width < 600
      ? ["bottom", "top"]
      : [preferred, "bottom", "top", "right", "left"];
  for (const placement of new Set(candidates)) {
    const horizontal = placement === "left" || placement === "right";
    const left =
      placement === "left"
        ? target.left - GAP - card.width
        : placement === "right"
          ? target.left + target.width + GAP
          : clamp(
              target.left + target.width / 2 - card.width / 2,
              MARGIN,
              limitX,
            );
    const top =
      placement === "top"
        ? target.top - GAP - card.height
        : placement === "bottom"
          ? target.top + target.height + GAP
          : clamp(
              target.top + target.height / 2 - card.height / 2,
              MARGIN,
              limitY,
            );
    if (left < MARGIN || left > limitX || top < MARGIN || top > limitY)
      continue;
    return {
      top,
      left,
      placement,
      arrowOffset: horizontal
        ? clamp(target.top + target.height / 2 - top, 28, card.height - 28)
        : clamp(target.left + target.width / 2 - left, 28, card.width - 28),
    };
  }
  // A tall target or a small screen may not fit both. Dock the readable card;
  // do not point an arrow at a section hidden behind it.
  return {
    left: center.left,
    top: clamp(viewport.height - card.height - MARGIN, MARGIN, limitY),
  };
}
