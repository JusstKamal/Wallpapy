/** Layout tunables shared by presets (aspect ratio, quality, stack direction stay user-controlled elsewhere). */
export const PRESET_DEFAULTS: {
  pillCount: number;
  pillOpacity: number;
  overlapRatio: number;
  pillMainRatio: number;
  pillCrossRatio: number;
  firstPillIntensity: number;
  lastPillIntensity: number;
  backgroundTint: number;
  backgroundBrightness: number;
} = {
  pillCount: 9,
  pillOpacity: 1,
  overlapRatio: 0.52,
  pillMainRatio: 0.58,
  pillCrossRatio: 0.4,
  firstPillIntensity: 0.9,
  lastPillIntensity: 0.9,
  backgroundTint: 1,
  backgroundBrightness: 0,
};

export type PresetLayout = typeof PRESET_DEFAULTS;

export type WallpaperPreset = {
  name: string;
  /** First stop / fallback — chips and single-hue presets */
  color: string;
  /** When set, gradient between stops along the pill stack (first → last). */
  paletteColors?: string[];
  mode: "dark" | "light";
  direction: "dark-to-light" | "light-to-dark";
  liquidGlass: boolean;
} & PresetLayout;

function pr(
  name: string,
  color: string,
  mode: WallpaperPreset["mode"],
  direction: WallpaperPreset["direction"],
  overrides: Partial<PresetLayout> = {},
  liquidGlass = false,
): WallpaperPreset {
  return {
    name,
    color,
    mode,
    direction,
    liquidGlass,
    ...PRESET_DEFAULTS,
    ...overrides,
  };
}

/** Multi-stop preset: `color` is `stops[0]` for thumbnails and tint. */
function prStops(
  name: string,
  stops: string[],
  mode: WallpaperPreset["mode"],
  direction: WallpaperPreset["direction"],
  overrides: Partial<PresetLayout> = {},
  liquidGlass = false,
): WallpaperPreset {
  const first = stops[0] ?? "#808080";
  return {
    name,
    color: first,
    paletteColors: [...stops],
    mode,
    direction,
    liquidGlass,
    ...PRESET_DEFAULTS,
    /** Full gradient along stops — no pull-to-center unless overridden. */
    firstPillIntensity: 1,
    lastPillIntensity: 1,
    ...overrides,
  };
}

/**
 * Nine presets chosen for spread: light/dark, single/multi, liquid/plain,
 * and hue families (neutral, cyan, rose, violet, rust, forest, candy, neon, cosmic).
 */
export const PRESETS: WallpaperPreset[] = [
  /** Night sky — broad strokes, heavy overlap, no wispy bars */
  pr("Midnight", "#6D28D9", "dark", "dark-to-light", {
    pillCount: 11,
    overlapRatio: 0.62,
    pillMainRatio: 0.68,
    pillCrossRatio: 0.44,
    firstPillIntensity: 0.92,
    lastPillIntensity: 0.92,
    backgroundTint: 7.2,
  }),
  /** Full bloom — soft, rounded mass */
  pr(
    "Peony",
    "#E11D48",
    "light",
    "light-to-dark",
    {
      pillCount: 10,
      overlapRatio: 0.58,
      pillMainRatio: 0.6,
      pillCrossRatio: 0.46,
      pillOpacity: 0.92,
      firstPillIntensity: 0.86,
      lastPillIntensity: 0.94,
      backgroundTint: 1.6,
    },
    true,
  ),
  /** Folded textile — even, medium body */
  pr("Linen", "#D6D3D1", "light", "light-to-dark", {
    pillCount: 11,
    overlapRatio: 0.55,
    pillMainRatio: 0.56,
    pillCrossRatio: 0.4,
    firstPillIntensity: 0.85,
    lastPillIntensity: 0.88,
    backgroundTint: 1.1,
  }),
  /** Ice field — thick slabs, stacked pack ice */
  pr(
    "Glacier",
    "#0EA5E9",
    "light",
    "dark-to-light",
    {
      pillCount: 10,
      overlapRatio: 0.66,
      pillMainRatio: 0.66,
      pillCrossRatio: 0.48,
      firstPillIntensity: 0.88,
      lastPillIntensity: 0.95,
      backgroundTint: 1.8,
    },
    true,
  ),
  /** Glowing bed — chunky, warm mass */
  pr("Ember", "#9A3412", "dark", "dark-to-light", {
    pillCount: 9,
    overlapRatio: 0.6,
    pillMainRatio: 0.64,
    pillCrossRatio: 0.43,
    firstPillIntensity: 0.88,
    lastPillIntensity: 0.9,
    backgroundTint: 4.2,
  }),
  /** Canopy layers — dense overlap, vertical weight */
  pr(
    "Taiga",
    "#365314",
    "dark",
    "dark-to-light",
    {
      pillCount: 9,
      overlapRatio: 0.64,
      pillMainRatio: 0.62,
      pillCrossRatio: 0.42,
      firstPillIntensity: 0.87,
      lastPillIntensity: 0.9,
      backgroundTint: 3.8,
    },
    true,
  ),
  /** Prismatic stack — bold tiles */
  prStops(
    "Kaleido",
    ["#F472B6", "#FB923C", "#4ADE80", "#60A5FA"],
    "light",
    "dark-to-light",
    {
      pillCount: 11,
      overlapRatio: 0.57,
      pillMainRatio: 0.6,
      pillCrossRatio: 0.4,
      backgroundTint: 4.8,
    },
  ),
  /** Retro bars — wide neon ribbons */
  prStops(
    "Synthwave",
    ["#DB2777", "#7C3AED", "#2563EB"],
    "dark",
    "dark-to-light",
    {
      pillCount: 10,
      overlapRatio: 0.56,
      pillMainRatio: 0.66,
      pillCrossRatio: 0.45,
      backgroundTint: 7,
    },
  ),
  /** Diffuse clouds — merged glass, still substantial forms */
  prStops(
    "Nebula",
    ["#4C1D95", "#7C3AED", "#22D3EE", "#FB7185"],
    "dark",
    "dark-to-light",
    {
      pillCount: 10,
      overlapRatio: 0.68,
      pillMainRatio: 0.62,
      pillCrossRatio: 0.44,
      backgroundTint: 5.5,
    },
    true,
  ),
];
