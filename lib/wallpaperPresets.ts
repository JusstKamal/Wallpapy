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
 * Sixteen distinct looks — two per category:
 * (one | multi) × (light | dark) × (normal | liquid glass).
 * Pairs are not clones: different hues, stacks, and tuning.
 */
export const PRESETS: WallpaperPreset[] = [
  // One-colored · Light · Normal — airy paper vs punchy citrus
  pr("Linen", "#D6D3D1", "light", "light-to-dark", {
    pillCount: 11,
    overlapRatio: 0.38,
    pillMainRatio: 0.52,
    pillCrossRatio: 0.38,
    firstPillIntensity: 0.85,
    lastPillIntensity: 0.88,
    backgroundTint: 1.1,
  }),
  pr("Citrus", "#CA8A04", "light", "light-to-dark", {
    pillCount: 7,
    overlapRatio: 0.06,
    pillMainRatio: 0.7,
    pillCrossRatio: 0.3,
    pillOpacity: 0.9,
    backgroundTint: 2.2,
  }),
  // One-colored · Light · Liquid glass — cool ice vs soft floral
  pr(
    "Glacier",
    "#0EA5E9",
    "light",
    "dark-to-light",
    {
      pillCount: 13,
      overlapRatio: -0.04,
      pillMainRatio: 0.44,
      pillCrossRatio: 0.22,
      firstPillIntensity: 0.88,
      lastPillIntensity: 0.95,
      backgroundTint: 1.8,
    },
    true,
  ),
  pr(
    "Peony",
    "#E11D48",
    "light",
    "light-to-dark",
    {
      pillCount: 9,
      overlapRatio: 0.32,
      pillMainRatio: 0.54,
      pillCrossRatio: 0.42,
      pillOpacity: 0.92,
      backgroundTint: 1.6,
    },
    true,
  ),
  // One-colored · Dark · Normal — electric violet vs burnt ember
  pr("Midnight", "#6D28D9", "dark", "dark-to-light", {
    pillCount: 14,
    overlapRatio: -0.08,
    pillMainRatio: 0.42,
    pillCrossRatio: 0.18,
    firstPillIntensity: 0.92,
    lastPillIntensity: 0.92,
    backgroundTint: 7.2,
  }),
  pr("Ember", "#9A3412", "dark", "dark-to-light", {
    pillCount: 10,
    overlapRatio: 0.14,
    pillMainRatio: 0.56,
    pillCrossRatio: 0.26,
    firstPillIntensity: 0.88,
    lastPillIntensity: 0.9,
    backgroundTint: 4.2,
  }),
  // One-colored · Dark · Liquid glass — ink indigo vs deep forest
  pr(
    "Obsidian",
    "#312E81",
    "dark",
    "dark-to-light",
    {
      pillCount: 15,
      overlapRatio: -0.11,
      pillMainRatio: 0.4,
      pillCrossRatio: 0.16,
      firstPillIntensity: 0.9,
      lastPillIntensity: 0.93,
      backgroundTint: 7.8,
    },
    true,
  ),
  pr(
    "Taiga",
    "#365314",
    "dark",
    "dark-to-light",
    {
      pillCount: 8,
      overlapRatio: 0.22,
      pillMainRatio: 0.61,
      pillCrossRatio: 0.34,
      firstPillIntensity: 0.87,
      lastPillIntensity: 0.9,
      backgroundTint: 3.8,
    },
    true,
  ),
  // Multi-colored · Light · Normal — candy riot vs sunrise sky
  prStops(
    "Kaleido",
    ["#F472B6", "#FB923C", "#4ADE80", "#60A5FA"],
    "light",
    "dark-to-light",
    {
      pillCount: 14,
      overlapRatio: 0.42,
      pillMainRatio: 0.41,
      pillCrossRatio: 0.27,
      backgroundTint: 4.8,
    },
  ),
  prStops("Dawn", ["#0369A1", "#F97316", "#FBBF24"], "light", "light-to-dark", {
    pillCount: 10,
    overlapRatio: 0.18,
    pillMainRatio: 0.56,
    pillCrossRatio: 0.34,
    backgroundTint: 2.8,
  }),
  // Multi-colored · Light · Liquid glass — pastel chalk vs seafoam shore
  prStops(
    "Pastille",
    ["#C4B5FD", "#F9A8D4", "#93C5FD", "#86EFAC"],
    "light",
    "dark-to-light",
    {
      pillCount: 12,
      overlapRatio: 0.48,
      pillMainRatio: 0.39,
      pillCrossRatio: 0.24,
      pillOpacity: 0.94,
      backgroundTint: 3.2,
    },
    false,
  ),
  prStops(
    "Shoal",
    ["#5EEAD4", "#67E8F9", "#FDE047", "#FDA4AF"],
    "light",
    "dark-to-light",
    {
      pillCount: 11,
      overlapRatio: 0.28,
      pillMainRatio: 0.5,
      pillCrossRatio: 0.32,
      backgroundTint: 4,
    },
    true,
  ),
  // Multi-colored · Dark · Normal — retro neon vs film noir
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
  prStops("Noir", ["#18181B", "#9F1239", "#FDA4AF"], "dark", "dark-to-light", {
    pillCount: 11,
    overlapRatio: 0.05,
    pillMainRatio: 0.48,
    pillCrossRatio: 0.3,
    backgroundTint: 3.5,
  }),
  // Multi-colored · Dark · Liquid glass — cosmic haze vs oxidized metal
  prStops(
    "Nebula",
    ["#4C1D95", "#7C3AED", "#22D3EE", "#FB7185"],
    "dark",
    "dark-to-light",
    {
      pillCount: 12,
      overlapRatio: 0.16,
      pillMainRatio: 0.5,
      pillCrossRatio: 0.3,
      backgroundTint: 5.5,
    },
    true,
  ),
  prStops(
    "Patina",
    ["#92400E", "#0D9488", "#EAB308", "#FFFBEB"],
    "dark",
    "dark-to-light",
    {
      pillCount: 7,
      overlapRatio: -0.12,
      pillMainRatio: 0.64,
      pillCrossRatio: 0.26,
      backgroundTint: 4,
    },
    true,
  ),
];
