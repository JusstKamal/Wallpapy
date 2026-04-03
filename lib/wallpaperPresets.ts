/** Fields presets override (aspect ratio, quality, stack direction, liquid glass stay user-controlled). */
export const PRESET_DEFAULTS: {
  pillCount: number;
  pillOpacity: number;
  overlapRatio: number;
  pillMainRatio: number;
  pillCrossRatio: number;
  firstPillIntensity: number;
  lastPillIntensity: number;
  backgroundTint: number;
} = {
  pillCount: 9,
  pillOpacity: 1,
  overlapRatio: 0.52,
  pillMainRatio: 0.58,
  pillCrossRatio: 0.4,
  firstPillIntensity: 0.9,
  lastPillIntensity: 0.9,
  backgroundTint: 1,
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
} & PresetLayout;

function pr(
  name: string,
  color: string,
  mode: WallpaperPreset["mode"],
  direction: WallpaperPreset["direction"],
  overrides: Partial<PresetLayout> = {},
): WallpaperPreset {
  return { name, color, mode, direction, ...PRESET_DEFAULTS, ...overrides };
}

/** Multi-stop preset: `color` is `stops[0]` for thumbnails and tint. */
function prStops(
  name: string,
  stops: string[],
  mode: WallpaperPreset["mode"],
  direction: WallpaperPreset["direction"],
  overrides: Partial<PresetLayout> = {},
): WallpaperPreset {
  const first = stops[0] ?? "#808080";
  return {
    name,
    color: first,
    paletteColors: [...stops],
    mode,
    direction,
    ...PRESET_DEFAULTS,
    /** Full gradient along stops — no pull-to-center unless overridden. */
    firstPillIntensity: 1,
    lastPillIntensity: 1,
    ...overrides,
  };
}

/** Nine presets — short, familiar names. */
export const PRESETS: WallpaperPreset[] = [
  pr("Midnight", "#6D28D9", "dark", "dark-to-light", {
    pillCount: 14,
    overlapRatio: -0.08,
    pillMainRatio: 0.42,
    pillCrossRatio: 0.18,
    firstPillIntensity: 0.92,
    lastPillIntensity: 0.92,
    backgroundTint: 7.2,
  }),
  pr("Sunset", "#EA580C", "light", "light-to-dark", {
    pillCount: 8,
    overlapRatio: 0.12,
    pillMainRatio: 0.65,
    pillCrossRatio: 0.35,
    pillOpacity: 0.88,
    backgroundTint: 1.5,
  }),
  prStops(
    "Synthwave",
    ["#DB2777", "#7C3AED", "#2563EB"],
    "dark",
    "dark-to-light",
    {
      pillCount: 13,
      overlapRatio: 0.22,
      pillMainRatio: 0.46,
      pillCrossRatio: 0.28,
      backgroundTint: 7,
    },
  ),
  prStops(
    "Dandy",
    ["#EC4899", "#FBBF24", "#34D399", "#60A5FA"],
    "light",
    "dark-to-light",
    {
      pillCount: 15,
      overlapRatio: 0.45,
      pillMainRatio: 0.4,
      pillCrossRatio: 0.26,
      backgroundTint: 4.5,
    },
  ),
  prStops(
    "Neon",
    ["#020617", "#06B6D4", "#F59E0B", "#C026D3", "#4ADE80"],
    "dark",
    "dark-to-light",
    {
      pillCount: 10,
      overlapRatio: 0.2,
      pillMainRatio: 0.58,
      pillCrossRatio: 0.32,
      backgroundTint: 3,
    },
  ),
  prStops(
    "Dawn",
    ["#0369A1", "#F97316", "#FBBF24"],
    "light",
    "light-to-dark",
    {
      pillCount: 10,
      overlapRatio: 0.18,
      pillMainRatio: 0.56,
      pillCrossRatio: 0.34,
      backgroundTint: 2.8,
    },
  ),
  prStops(
    "Patina",
    ["#92400E", "#0D9488", "#EAB308", "#FFFBEB"],
    "dark",
    "dark-to-light",
    {
      pillCount: 6,
      overlapRatio: -0.12,
      pillMainRatio: 0.66,
      pillCrossRatio: 0.26,
      backgroundTint: 4,
    },
  ),
  prStops(
    "Noir",
    ["#18181B", "#9F1239", "#FDA4AF"],
    "dark",
    "dark-to-light",
    {
      pillCount: 11,
      overlapRatio: 0.05,
      pillMainRatio: 0.48,
      pillCrossRatio: 0.3,
      backgroundTint: 3.5,
    },
  ),
  prStops(
    "Tropical",
    ["#0D9488", "#4ADE80", "#FACC15"],
    "light",
    "dark-to-light",
    {
      pillCount: 14,
      overlapRatio: 0.4,
      pillMainRatio: 0.42,
      pillCrossRatio: 0.28,
      backgroundTint: 5,
    },
  ),
];
