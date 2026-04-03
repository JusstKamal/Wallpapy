/** Per-channel quantization for export (PNG remains 8-bit samples; simulates display bit depth). */
export type ExportBitDepth = 8 | 10 | 12;

function quantizeChannel(c: number, maxLevel: number): number {
  return Math.round((c / 255) * maxLevel) / maxLevel * 255;
}

export function applyBitDepthToImageData(
  img: ImageData,
  bits: ExportBitDepth,
): void {
  if (bits === 8) return;
  const maxLevel = (1 << bits) - 1;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = quantizeChannel(d[i], maxLevel);
    d[i + 1] = quantizeChannel(d[i + 1], maxLevel);
    d[i + 2] = quantizeChannel(d[i + 2], maxLevel);
  }
}

/** Renders `source` into a 2D canvas, quantizes RGB, returns PNG data URL. */
export function canvasToDataURLWithBitDepth(
  source: HTMLCanvasElement,
  bits: ExportBitDepth,
): string {
  if (bits === 8) return source.toDataURL("image/png");
  const w = source.width;
  const h = source.height;
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const ctx = tmp.getContext("2d");
  if (!ctx) return source.toDataURL("image/png");
  ctx.drawImage(source, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  applyBitDepthToImageData(img, bits);
  ctx.putImageData(img, 0, 0);
  return tmp.toDataURL("image/png");
}
