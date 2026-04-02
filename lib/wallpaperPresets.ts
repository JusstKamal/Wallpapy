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
  color: string;
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

/**
 * Fifteen presets on separated hue families (single warm: orange only; no amber/gold duplicate).
 * Violet → red → orange → yellow → lime → green → teal → sky blue → navy → lilac → magenta → pink → salmon → blue-gray → near-black.
 */
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
  pr("Crimson", "#DC2626", "dark", "dark-to-light", {
    pillCount: 5,
    overlapRatio: -0.2,
    pillMainRatio: 0.68,
    pillCrossRatio: 0.22,
    firstPillIntensity: 0.55,
    lastPillIntensity: 0.95,
    backgroundTint: 6,
  }),
  pr("Sunset", "#EA580C", "light", "light-to-dark", {
    pillCount: 8,
    overlapRatio: 0.12,
    pillMainRatio: 0.65,
    pillCrossRatio: 0.35,
    pillOpacity: 0.88,
    backgroundTint: 1.5,
  }),
  pr("Lemon", "#EAB308", "light", "dark-to-light", {
    pillCount: 4,
    overlapRatio: 0.62,
    pillMainRatio: 0.82,
    pillCrossRatio: 0.16,
    firstPillIntensity: 0.55,
    lastPillIntensity: 0.6,
    backgroundTint: 2.5,
  }),
  pr("Lime", "#84CC16", "light", "dark-to-light", {
    pillCount: 16,
    overlapRatio: 0.35,
    pillMainRatio: 0.38,
    pillCrossRatio: 0.3,
    firstPillIntensity: 0.98,
    lastPillIntensity: 0.4,
    backgroundTint: 8,
  }),
  pr("Forest", "#166534", "dark", "dark-to-light", {
    pillCount: 10,
    overlapRatio: 0.45,
    pillMainRatio: 0.48,
    pillCrossRatio: 0.38,
    firstPillIntensity: 0.72,
    lastPillIntensity: 0.88,
    backgroundTint: 3.8,
  }),
  pr("Teal", "#0D9488", "dark", "dark-to-light", {
    pillCount: 7,
    overlapRatio: -0.35,
    pillMainRatio: 0.62,
    pillCrossRatio: 0.42,
    firstPillIntensity: 0.88,
    lastPillIntensity: 0.5,
    backgroundTint: 5,
  }),
  pr("Ocean", "#2563EB", "light", "light-to-dark", {
    pillCount: 7,
    overlapRatio: 0.22,
    pillMainRatio: 0.72,
    pillCrossRatio: 0.28,
    firstPillIntensity: 0.95,
    lastPillIntensity: 0.72,
    backgroundTint: 2.2,
  }),
  pr("Indigo", "#1E3A8A", "dark", "dark-to-light", {
    pillCount: 12,
    overlapRatio: 0.58,
    pillMainRatio: 0.52,
    pillCrossRatio: 0.32,
    firstPillIntensity: 0.85,
    lastPillIntensity: 0.85,
    backgroundTint: 4.5,
  }),
  pr("Lavender", "#C4B5FD", "light", "light-to-dark", {
    pillCount: 9,
    overlapRatio: 0.38,
    pillMainRatio: 0.78,
    pillCrossRatio: 0.22,
    firstPillIntensity: 0.45,
    lastPillIntensity: 0.55,
    backgroundTint: 4,
  }),
  pr("Aurora", "#C026D3", "dark", "dark-to-light", {
    pillCount: 11,
    overlapRatio: 0.18,
    pillMainRatio: 0.5,
    pillCrossRatio: 0.26,
    firstPillIntensity: 0.78,
    lastPillIntensity: 0.82,
    backgroundTint: 6,
  }),
  pr("Rose", "#DB2777", "light", "dark-to-light", {
    pillCount: 6,
    overlapRatio: 0.65,
    pillMainRatio: 0.55,
    pillCrossRatio: 0.44,
    firstPillIntensity: 0.65,
    lastPillIntensity: 0.72,
    backgroundTint: 5.5,
  }),
  pr("Coral", "#FB7185", "light", "light-to-dark", {
    pillCount: 9,
    overlapRatio: 0.5,
    pillMainRatio: 0.6,
    pillCrossRatio: 0.36,
    pillOpacity: 0.52,
    firstPillIntensity: 0.7,
    lastPillIntensity: 0.7,
    backgroundTint: 3,
  }),
  pr("Slate", "#64748B", "dark", "dark-to-light", {
    pillCount: 7,
    overlapRatio: 0.2,
    pillMainRatio: 0.7,
    pillCrossRatio: 0.24,
    pillOpacity: 0.78,
    backgroundTint: 1.2,
  }),
  pr("Charcoal", "#0F172A", "dark", "dark-to-light", {
    pillCount: 12,
    overlapRatio: 0.08,
    pillMainRatio: 0.44,
    pillCrossRatio: 0.28,
    firstPillIntensity: 0.9,
    lastPillIntensity: 0.45,
    backgroundTint: 0.5,
  }),
];
