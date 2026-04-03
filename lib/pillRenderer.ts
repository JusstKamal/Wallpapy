import { hexToHsl, wallpaperBackgroundFromBase } from "./colorUtils";

export interface WallpaperConfig {
  width: number;
  height: number;
  pillCount: number;
  colors: string[];
  /** 0–1, applied to every pill */
  pillOpacity: number;
  mode: "dark" | "light";
  stackDirection: "horizontal" | "vertical";
  overlapRatio: number;
  pillMainRatio: number;
  pillCrossRatio: number;
  /** Picked color — used to tint the canvas background */
  baseColor: string;
  /** 0–10 internal; UI shows 0–100% (×10) */
  backgroundTint: number;
  /** -1..1 where negative darkens and positive brightens the background. */
  backgroundBrightness: number;
  /**
   * Alternating stagger along the cross axis (fraction of pill thickness).
   * Sign flips direction: positive vs negative reverses which parity goes which way.
   */
  pillStagger: number;
  liquidGlass: boolean;
}

interface PillRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  opacity: number;
}

export function renderWallpaper(
  canvas: HTMLCanvasElement,
  config: WallpaperConfig,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const {
    width,
    height,
    pillCount,
    colors,
    pillOpacity,
    mode,
    stackDirection,
    overlapRatio,
    pillMainRatio,
    pillCrossRatio,
    baseColor,
    backgroundTint,
    backgroundBrightness,
    pillStagger,
    liquidGlass,
  } = config;
  const stagger = Math.max(-0.35, Math.min(0.35, pillStagger));
  const alpha = Math.min(1, Math.max(0, pillOpacity));

  // Scale factor so all effects look correct at any resolution
  const scale = Math.min(width, height) / 1080;

  // --- Background (tinted by base color) ---
  ctx.fillStyle = wallpaperBackgroundFromBase(
    baseColor,
    mode,
    backgroundTint,
    backgroundBrightness,
  );
  ctx.fillRect(0, 0, width, height);

  // Build pill geometry
  const pills: PillRect[] = [];

  if (stackDirection === "horizontal") {
    const pillH = height * pillMainRatio;
    const pillW = pillH * pillCrossRatio;
    const step = pillW * (1 - overlapRatio);
    const totalW = pillW + step * (pillCount - 1);
    const startX = (width - totalW) / 2;
    const baseY = height * 0.5 - pillH / 2;
    for (let i = 0; i < pillCount; i++) {
      const alt = i % 2 === 0 ? 1 : -1;
      const y = baseY + alt * stagger * pillH;
      pills.push({
        x: startX + i * step,
        y,
        w: pillW,
        h: pillH,
        color: colors[i],
        opacity: alpha,
      });
    }
  } else {
    const pillW = width * pillMainRatio;
    const pillH = pillW * pillCrossRatio;
    const step = pillH * (1 - overlapRatio);
    const totalH = pillH + step * (pillCount - 1);
    const startY = (height - totalH) / 2;
    const baseX = width * 0.5 - pillW / 2;
    for (let i = 0; i < pillCount; i++) {
      const alt = i % 2 === 0 ? 1 : -1;
      const x = baseX + alt * stagger * pillW;
      pills.push({
        x,
        y: startY + i * step,
        w: pillW,
        h: pillH,
        color: colors[i],
        opacity: alpha,
      });
    }
  }

  if (liquidGlass) {
    drawLiquidGlassBackground(ctx, pills, mode, width, height);
    // Draw back-to-front
    for (let i = pills.length - 1; i >= 0; i--) {
      drawLiquidGlassPill(ctx, pills[i], mode, scale);
    }
  } else {
    for (let i = pills.length - 1; i >= 0; i--) {
      const p = pills[i];
      const r = Math.min(p.w, p.h) / 2;
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, r);
      ctx.fill();
      ctx.restore();
    }
  }
}

// Soft ambient color blobs so the glass has something colorful to refract
function drawLiquidGlassBackground(
  ctx: CanvasRenderingContext2D,
  pills: PillRect[],
  mode: "dark" | "light",
  width: number,
  height: number,
) {
  ctx.save();
  // Blend additive-ish: screen on dark, multiply-ish on light
  ctx.globalCompositeOperation = "source-over";

  for (const p of pills) {
    const [h, s, l] = hexToHsl(p.color);
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const radius = Math.max(p.w, p.h) * 1.8;
    const baseA = mode === "dark" ? 0.18 : 0.13;
    const alpha = baseA * p.opacity;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, ${alpha})`);
    grad.addColorStop(0.5, `hsla(${h}, ${s}%, ${l}%, ${alpha * 0.4})`);
    grad.addColorStop(1, `hsla(${h}, ${s}%, ${l}%, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(
      Math.max(cx - radius, 0),
      Math.max(cy - radius, 0),
      radius * 2,
      radius * 2,
    );
  }

  // Very subtle background noise / depth layer
  const bgGrad = ctx.createRadialGradient(
    width * 0.5,
    height * 0.3,
    0,
    width * 0.5,
    height * 0.5,
    width * 0.7,
  );
  bgGrad.addColorStop(
    0,
    mode === "dark" ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.4)",
  );
  bgGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}

function drawLiquidGlassPill(
  ctx: CanvasRenderingContext2D,
  p: PillRect,
  mode: "dark" | "light",
  scale: number,
) {
  const { x, y, w, h, color, opacity } = p;
  const r = Math.min(w, h) / 2;
  const [hue, sat, lig] = hexToHsl(color);

  ctx.save();
  ctx.globalAlpha = opacity;

  // 1. Colored drop shadow
  ctx.save();
  ctx.shadowColor =
    mode === "dark"
      ? `hsla(${hue}, ${sat}%, ${Math.min(lig + 15, 85)}%, 0.35)`
      : `hsla(${hue}, ${sat}%, ${Math.max(lig - 15, 10)}%, 0.22)`;
  ctx.shadowBlur = 32 * scale;
  ctx.shadowOffsetY = 6 * scale;
  ctx.shadowOffsetX = 0;

  // Base glass body (very transparent tinted fill)
  const baseAlpha = mode === "dark" ? 0.2 : 0.15;
  ctx.fillStyle = `hsla(${hue}, ${Math.min(sat, 75)}%, ${lig}%, ${baseAlpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  // 2. Inner effects — clipped to pill shape
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();

  // 2a. Frosted glass body gradient
  const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
  if (mode === "dark") {
    bodyGrad.addColorStop(0, "rgba(255,255,255,0.10)");
    bodyGrad.addColorStop(0.45, "rgba(255,255,255,0.03)");
    bodyGrad.addColorStop(1, "rgba(0,0,0,0.08)");
  } else {
    bodyGrad.addColorStop(0, "rgba(255,255,255,0.55)");
    bodyGrad.addColorStop(0.45, "rgba(255,255,255,0.22)");
    bodyGrad.addColorStop(1, "rgba(255,255,255,0.06)");
  }
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(x, y, w, h);

  // 2b. Large soft specular highlight — top 40%
  const specH = h * 0.4;
  const specGrad = ctx.createLinearGradient(x, y, x, y + specH);
  specGrad.addColorStop(
    0,
    mode === "dark" ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.70)",
  );
  specGrad.addColorStop(
    0.55,
    mode === "dark" ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.28)",
  );
  specGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = specGrad;
  ctx.fillRect(x, y, w, specH);

  // 2c. Caustic arc — the signature Apple liquid glass crescent
  // A thin bright horizontal band just below the top cap
  const causticCy = y + r * 1.05;
  const causticW = w * 0.58;
  const causticThk = Math.max(1.8 * scale, 1.5);
  const causticX = x + (w - causticW) / 2;

  const causticGrad = ctx.createLinearGradient(
    causticX,
    0,
    causticX + causticW,
    0,
  );
  causticGrad.addColorStop(0, "rgba(255,255,255,0)");
  causticGrad.addColorStop(
    0.2,
    mode === "dark" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.95)",
  );
  causticGrad.addColorStop(
    0.5,
    mode === "dark" ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,1.0)",
  );
  causticGrad.addColorStop(
    0.8,
    mode === "dark" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.95)",
  );
  causticGrad.addColorStop(1, "rgba(255,255,255,0)");

  // Use elliptical mask for the arc shape
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    x + w / 2,
    causticCy,
    causticW / 2,
    causticThk * 2.2,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = causticGrad;
  ctx.fill();
  ctx.restore();

  // 2d. Second smaller caustic (refraction ring detail)
  const caustic2W = w * 0.3;
  const caustic2Cy = y + r * 0.55;
  const caustic2Thk = Math.max(0.9 * scale, 0.8);
  const caustic2Grad = ctx.createLinearGradient(
    x + (w - caustic2W) / 2,
    0,
    x + (w + caustic2W) / 2,
    0,
  );
  caustic2Grad.addColorStop(0, "rgba(255,255,255,0)");
  caustic2Grad.addColorStop(
    0.5,
    mode === "dark" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.65)",
  );
  caustic2Grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    x + w / 2,
    caustic2Cy,
    caustic2W / 2,
    caustic2Thk * 1.8,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = caustic2Grad;
  ctx.fill();
  ctx.restore();

  // 2e. Bottom inner shadow
  const shadowH = h * 0.28;
  const shadowGrad = ctx.createLinearGradient(x, y + h - shadowH, x, y + h);
  shadowGrad.addColorStop(0, "rgba(0,0,0,0)");
  shadowGrad.addColorStop(
    1,
    mode === "dark" ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.07)",
  );
  ctx.fillStyle = shadowGrad;
  ctx.fillRect(x, y + h - shadowH, w, shadowH);

  ctx.restore(); // unclip

  // 3. Rim light — gradient from bright top to subtle bottom
  const rimGrad = ctx.createLinearGradient(x, y, x, y + h);
  rimGrad.addColorStop(
    0,
    mode === "dark" ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.92)",
  );
  rimGrad.addColorStop(
    0.35,
    mode === "dark" ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.55)",
  );
  rimGrad.addColorStop(
    0.7,
    mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.25)",
  );
  rimGrad.addColorStop(
    1,
    mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.12)",
  );

  ctx.strokeStyle = rimGrad;
  ctx.lineWidth = Math.max(1.5 * scale, 1);
  const inset = ctx.lineWidth / 2;
  ctx.beginPath();
  ctx.roundRect(
    x + inset,
    y + inset,
    w - inset * 2,
    h - inset * 2,
    Math.max(r - inset, 0),
  );
  ctx.stroke();

  ctx.restore();
}

export const ASPECT_RATIOS = [
  { label: "16:9", w: 16, h: 9, tag: "Landscape" },
  { label: "21:9", w: 21, h: 9, tag: "Ultrawide" },
  { label: "32:9", w: 32, h: 9, tag: "Super UW" },
  { label: "1:1", w: 1, h: 1, tag: "Square" },
  { label: "9:16", w: 9, h: 16, tag: "Portrait" },
  { label: "9:19.5", w: 9, h: 19.5, tag: "Mobile" },
];

/** Index into aspect UI: presets are 0…length−1; this selects user W:H ratio. */
export const ASPECT_CUSTOM_INDEX = ASPECT_RATIOS.length;

const ASPECT_MIN = 0.01;

/** Max allowed value for each custom W or H ratio part (matches number input max). */
export const ASPECT_RATIO_PART_MAX = 10_240;

/**
 * Max ratio of longer ÷ shorter side for custom W:H. Rejects extremes like 10240:1
 * while still allowing very wide layouts (e.g. up to 32∶1).
 */
export const ASPECT_MAX_SIDE_RATIO = 32;

/** Clamp a single W or H ratio part for custom aspect (used by UI + export). */
export function clampAspectRatioPart(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(ASPECT_RATIO_PART_MAX, Math.max(ASPECT_MIN, n));
}

/**
 * Clamp each part, then enforce max(longer, shorter) / min ≤ ASPECT_MAX_SIDE_RATIO
 * by growing the shorter side (preserves the longer side when possible).
 */
export function normalizeCustomAspectPair(
  w: number,
  h: number,
): {
  w: number;
  h: number;
} {
  w = clampAspectRatioPart(w);
  h = clampAspectRatioPart(h);
  const maxDim = Math.max(w, h);
  const minDim = Math.min(w, h);
  if (minDim <= 0) return { w: 16, h: 9 };
  if (maxDim / minDim <= ASPECT_MAX_SIDE_RATIO) return { w, h };

  if (w >= h) {
    h = clampAspectRatioPart(w / ASPECT_MAX_SIDE_RATIO);
    if (w / h > ASPECT_MAX_SIDE_RATIO) {
      w = clampAspectRatioPart(h * ASPECT_MAX_SIDE_RATIO);
    }
  } else {
    w = clampAspectRatioPart(h / ASPECT_MAX_SIDE_RATIO);
    if (h / w > ASPECT_MAX_SIDE_RATIO) {
      h = clampAspectRatioPart(w * ASPECT_MAX_SIDE_RATIO);
    }
  }
  return { w, h };
}

/** Resolved width/height ratio parts for preview, export, and stack direction. */
export function getAspectRatioParts(
  arIndex: number,
  custom: { w: number; h: number } | undefined,
): { w: number; h: number } {
  if (arIndex === ASPECT_CUSTOM_INDEX) {
    return normalizeCustomAspectPair(custom?.w ?? 16, custom?.h ?? 9);
  }
  const i = Math.max(0, Math.min(arIndex, ASPECT_RATIOS.length - 1));
  return { w: ASPECT_RATIOS[i].w, h: ASPECT_RATIOS[i].h };
}

export const QUALITY_LEVELS = [
  { label: "1080p", base: 1080 },
  { label: "1440p", base: 1440 },
  { label: "4K", base: 2160 },
  { label: "5K", base: 2880 },
];

export function getPixelDimensions(
  arIndex: number,
  qualityIndex: number,
  custom?: { w: number; h: number },
) {
  const ar = getAspectRatioParts(arIndex, custom);
  const base = QUALITY_LEVELS[qualityIndex].base;
  const isPortrait = ar.h > ar.w;
  if (isPortrait) {
    return { width: base, height: Math.round((base * ar.h) / ar.w) };
  } else {
    return { width: Math.round((base * ar.w) / ar.h), height: base };
  }
}
