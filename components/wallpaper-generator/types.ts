import type { ExportBitDepth } from "@/lib/exportBitDepth";
import type { GlassParams } from "@/lib/liquidGlassRenderer";
import type { StackLayerOrder } from "@/lib/pillRenderer";

export interface Config {
  /** One color = single-hue lightness ramp; two+ = gradient between stops along the stack. */
  paletteColors: string[];
  pillCount: number;
  /** 0–1, fades all pills together */
  pillOpacity: number;
  mode: "dark" | "light";
  direction: "dark-to-light" | "light-to-dark";
  stackDirection: "horizontal" | "vertical";
  /** Which end of the stack is in front when pills overlap (left/top vs right/bottom). */
  stackLayerOrder: StackLayerOrder;
  overlapRatio: number;
  pillMainRatio: number;
  pillCrossRatio: number;
  /** 0.25–1: blend toward center (25% min, 100% max) */
  firstPillIntensity: number;
  /** 0.25–1 */
  lastPillIntensity: number;
  arIndex: number;
  /** Ratio parts when `arIndex === ASPECT_CUSTOM_INDEX`. */
  customAspectW: number;
  customAspectH: number;
  qualityIndex: number;
  liquidGlass: boolean;
  glass: GlassParams;
  /** 0–10 internal = 0–100% in UI (same intensity curve); default 1 = 10% */
  backgroundTint: number;
  /** -1..1 where negative darkens and positive brightens the background. */
  backgroundBrightness: number;
  /** Base64 data URL of uploaded background image, or null for solid color. */
  backgroundImage: string | null;
  /**
   * Pixel rect on the source image (full data URL), same aspect as the wallpaper.
   * Null: legacy full-image “cover + center” in the renderer.
   */
  backgroundImageCrop: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
  /** Original file name from the file picker, for display. */
  backgroundImageFileName: string | null;
  /** Index into paletteColors used for background tinting (default 0). */
  backgroundTintColorIndex: number;
  /** Gaussian blur radius in px applied to background image (0 = sharp). */
  backgroundBlur: number;
  /** Alternating per-pill stagger (fraction of pill thickness); sign flips wobble direction */
  pillStagger: number;
  /** RGB export quantization (PNG samples stay 8-bit; simulates 10/12-bit precision). */
  exportBitDepth: ExportBitDepth;
  /** Export & preview as two halves for dual monitors */
  dualMonitor: boolean;
  /** How to split: left/right or top/bottom */
  dualSplit: "left-right" | "top-bottom";
}
