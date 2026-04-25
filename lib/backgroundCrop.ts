/** Portion of the source image in pixel coordinates, aspect matches the wallpaper. */
export type BackgroundImageCrop = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** “Cover + center” crop: largest rect with target aspect that fits the image, centered. */
export function getDefaultBackgroundCrop(
  iw: number,
  ih: number,
  arW: number,
  arH: number,
): BackgroundImageCrop {
  if (iw < 1 || ih < 1) return { x: 0, y: 0, w: 1, h: 1 };
  const t = arW / arH;
  const imgA = iw / ih;
  let cw: number;
  let ch: number;
  if (imgA > t) {
    ch = ih;
    cw = Math.max(1, Math.round((ih * arW) / arH));
  } else {
    cw = iw;
    ch = Math.max(1, Math.round((iw * arH) / arW));
  }
  cw = Math.min(cw, iw);
  ch = Math.min(ch, ih);
  const x = Math.max(0, Math.floor((iw - cw) / 2));
  const y = Math.max(0, Math.floor((ih - ch) / 2));
  return { x, y, w: cw, h: ch };
}

/**
 * Image drawn at (px,py) in box coords, size wDisp×hDisp; return visible sub-rect in
 * **source** pixels (uniform scale, axis-aligned place).
 */
export function computeVisibleCrop(
  iw: number,
  ih: number,
  boxW: number,
  boxH: number,
  imgPx: number,
  imgPy: number,
  wDisp: number,
  hDisp: number,
): BackgroundImageCrop {
  if (wDisp < 1e-6 || hDisp < 1e-6)
    return getDefaultBackgroundCrop(iw, ih, boxW, boxH);

  const t0x = (0 - imgPx) / wDisp;
  const t1x = (boxW - imgPx) / wDisp;
  const tMinX = Math.min(t0x, t1x);
  const tMaxX = Math.max(t0x, t1x);
  const uLoX = Math.max(0, tMinX);
  const uHiX = Math.min(1, tMaxX);

  const t0y = (0 - imgPy) / hDisp;
  const t1y = (boxH - imgPy) / hDisp;
  const tMinY = Math.min(t0y, t1y);
  const tMaxY = Math.max(t0y, t1y);
  const uLoY = Math.max(0, tMinY);
  const uHiY = Math.min(1, tMaxY);

  if (uLoX >= uHiX || uLoY >= uHiY)
    return getDefaultBackgroundCrop(iw, ih, boxW, boxH);

  const x = Math.max(0, Math.floor(uLoX * iw));
  const w = Math.max(1, Math.min(iw - x, Math.round((uHiX - uLoX) * iw)));
  const y = Math.max(0, Math.floor(uLoY * ih));
  const h = Math.max(1, Math.min(ih - y, Math.round((uHiY - uLoY) * ih)));

  return { x, y, w, h };
}

/** Pan + display size in the preview box to match a saved pixel crop. */
export function getPanZoomFromCrop(
  crop: BackgroundImageCrop,
  iw: number,
  ih: number,
  boxW: number,
  _boxH: number,
) {
  const wDisp = (boxW * iw) / Math.max(1, crop.w);
  const hDisp = (wDisp * ih) / Math.max(1, iw);
  return {
    imgPx: -crop.x * (wDisp / Math.max(1, iw)),
    imgPy: -crop.y * (hDisp / Math.max(1, ih)),
    wDisp,
    hDisp,
  };
}
