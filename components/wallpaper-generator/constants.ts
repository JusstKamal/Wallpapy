import { GLASS_DEFAULTS } from "@/lib/liquidGlassRenderer";
import { PRESET_DEFAULTS } from "@/lib/wallpaperPresets";
import type { Config } from "./types";

export const SOCIAL_LINKS = [
  { label: "YouTube", href: "https://www.youtube.com/@JusstKamal" },
  { label: "TikTok", href: "https://www.tiktok.com/@JusstKamal" },
  { label: "Facebook", href: "https://www.facebook.com/JusstKamal" },
  { label: "Instagram", href: "https://www.instagram.com/JusstKamal" },
  { label: "GitHub", href: "https://github.com/JusstKamal" },
  { label: "LinkedIn", href: "https://www.linkedin.com/feed/" },
] as const;

export const DEFAULT: Config = {
  paletteColors: ["#6D28D9"],
  mode: "dark",
  direction: "dark-to-light",
  ...PRESET_DEFAULTS,
  stackDirection: "horizontal",
  stackLayerOrder: "stack-start",
  arIndex: 0,
  customAspectW: 16,
  customAspectH: 9,
  qualityIndex: 1,
  liquidGlass: false,
  glass: { ...GLASS_DEFAULTS },
  pillStagger: 0,
  exportBitDepth: 8,
  dualMonitor: false,
  dualSplit: "left-right",
  backgroundImage: null,
  backgroundTintColorIndex: 0,
  backgroundBlur: 0,
};

/** `border-2` on preview frame: 2px each side → shrink available area for aspect math. */
export const PREVIEW_FRAME_BORDER_GAP_X = 4;
export const PREVIEW_FRAME_BORDER_GAP_Y = 4;
