/** Portrait canvas → vertical stack; landscape → horizontal (pills run along the long axis). */
export function stackDirectionForAspectRatio(
  w: number,
  h: number,
): "horizontal" | "vertical" {
  return h > w ? "vertical" : "horizontal";
}

/** Largest axis-aligned rect with aspect arW:arH inside maxW×maxH (preview slot). */
export function fitAspectInsideBox(
  maxW: number,
  maxH: number,
  arW: number,
  arH: number,
): { w: number; h: number } {
  if (maxW <= 0 || maxH <= 0 || arW <= 0 || arH <= 0) return { w: 0, h: 0 };
  let w = maxW;
  let h = (w * arH) / arW;
  if (h > maxH) {
    h = maxH;
    w = (h * arW) / arH;
  }
  w = Math.floor(w);
  h = Math.round((w * arH) / arW);
  if (h > maxH) {
    h = Math.floor(maxH);
    w = Math.round((h * arW) / arH);
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
}
