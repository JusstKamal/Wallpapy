export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h * 360, s * 100, l * 100];
}

export function hslToHex(h: number, s: number, l: number): string {
  h = h % 360;
  s /= 100;
  l /= 100;

  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/** Linear mix in HSL; hue takes shortest arc. t=0 → `from`, t=1 → `to`. */
export function mixHexHsl(from: string, to: string, t: number): string {
  const u = Math.min(1, Math.max(0, t));
  const [h1, s1, l1] = hexToHsl(from);
  const [h2, s2, l2] = hexToHsl(to);
  let dh = h2 - h1;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = h1 + dh * u;
  const s = s1 + (s2 - s1) * u;
  const l = l1 + (l2 - l1) * u;
  return hslToHex(
    h,
    Math.min(100, Math.max(0, s)),
    Math.min(100, Math.max(0, l)),
  );
}

/**
 * Canvas background tinted by the picked base hue (dark ≈ 5% L, light ≈ 94% L).
 * @param tintAmount 0–10 (shown in UI as 0–100%). 0 = neutral; 1 ≈ standard; 2 = strong; 5 = high cap; 10 = extreme saturation.
 */
export function wallpaperBackgroundFromBase(
  baseHex: string,
  mode: "dark" | "light",
  tintAmount = 1,
): string {
  const [h, s] = hexToHsl(baseHex);
  // Dark: chroma on ~5% L reads well. Light: same L as paper + low S looks nearly white —
  // use slightly lower L for tinted swatches + higher S caps so hue is visible.
  const neutralL = mode === "dark" ? 5.2 : 94.5;
  const bgL = mode === "dark" ? 5.2 : 91.5;
  const bgS =
    mode === "dark"
      ? Math.min(s * 0.42, 28)
      : Math.min(s * 0.52, 34);
  const tinted = hslToHex(h, bgS, bgL);
  const bgSStrong =
    mode === "dark"
      ? Math.min(s * 0.88, 58)
      : Math.min(s * 0.92, 52);
  const tintedStrong = hslToHex(h, bgSStrong, bgL);
  const bgSMax =
    mode === "dark"
      ? Math.min(s * 1.38, 94)
      : Math.min(s * 1.28, 82);
  const tintedMax = hslToHex(h, bgSMax, bgL);
  // 600–1000%: extra headroom toward near-full saturation at fixed L
  const bgSExtreme =
    mode === "dark"
      ? Math.min(s * 2.05, 100)
      : Math.min(s * 1.75, 98);
  const tintedExtreme = hslToHex(h, bgSExtreme, bgL);

  const t = Math.min(10, Math.max(0, tintAmount));
  const neutral =
    mode === "dark" ? hslToHex(0, 0, neutralL) : hslToHex(0, 0, neutralL);
  if (t <= 0) return neutral;
  if (t < 1) return mixHexHsl(neutral, tinted, t);
  if (t < 2) return mixHexHsl(tinted, tintedStrong, t - 1);
  if (t < 5) return mixHexHsl(tintedStrong, tintedMax, (t - 2) / 3);
  return mixHexHsl(tintedMax, tintedExtreme, (t - 5) / 5);
}

/** Sample along ordered palette stops, t ∈ [0, 1] from first → last stop. */
export function samplePaletteStops(stops: string[], t: number): string {
  if (stops.length === 0) return "#000000";
  if (stops.length === 1) return stops[0];
  const u = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const j = Math.floor(u);
  const localT = u - j;
  if (j >= stops.length - 1) return stops[stops.length - 1];
  return mixHexHsl(stops[j], stops[j + 1], localT);
}

function applyEndIntensityToRamp(
  natural: string[],
  firstPillIntensity: number,
  lastPillIntensity: number,
): string[] {
  const count = natural.length;
  const a = Math.min(1, Math.max(0.25, firstPillIntensity));
  const b = Math.min(1, Math.max(0.25, lastPillIntensity));

  if (count <= 1) {
    return natural;
  }

  const out = [...natural];

  if (count === 2) {
    const mid = mixHexHsl(natural[0], natural[1], 0.5);
    out[0] = mixHexHsl(mid, natural[0], a);
    out[1] = mixHexHsl(mid, natural[1], b);
    return out;
  }

  const centerLo = Math.floor((count - 1) / 2);
  const centerHi = Math.ceil((count - 1) / 2);

  for (let i = 0; i < centerLo; i++) {
    out[i] = mixHexHsl(natural[centerLo], natural[i], a);
  }
  for (let i = centerHi + 1; i < count; i++) {
    out[i] = mixHexHsl(natural[centerHi], natural[i], b);
  }

  return out;
}

export function generatePillColors(
  baseHex: string,
  count: number,
  direction: "dark-to-light" | "light-to-dark",
  mode: "dark" | "light",
  /**
   * Blends every pill from the first end toward the stack center (main ramp).
   * Clamped to 0.25–1: 0.25 = strongest pull to center; 1 = full gradient on that side.
   */
  firstPillIntensity = 0.9,
  lastPillIntensity = 0.9,
): string[] {
  const [h, s] = hexToHsl(baseHex);

  // In dark mode: go from very dark (low L) to near-white (high L)
  // In light mode: similar range but slightly different endpoints
  const darkEnd = mode === "dark" ? 8 : 15;
  const lightEnd = mode === "dark" ? 92 : 95;

  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const l = darkEnd + t * (lightEnd - darkEnd);
    // Reduce saturation at extremes for more natural feel
    const sFactor = 1 - Math.abs(t - 0.5) * 0.3;
    colors.push(hslToHex(h, Math.min(s * sFactor, 100), l));
  }

  const ordered =
    direction === "dark-to-light" ? colors : [...colors].reverse();

  return applyEndIntensityToRamp(ordered, firstPillIntensity, lastPillIntensity);
}

/** Multi-stop hue gradient along the stack; same intensity shaping as single-hue mode. */
export function generatePillColorsMulti(
  stops: string[],
  count: number,
  direction: "dark-to-light" | "light-to-dark",
  mode: "dark" | "light",
  firstPillIntensity: number,
  lastPillIntensity: number,
): string[] {
  const clean = stops.filter(Boolean);
  if (clean.length < 2) {
    return generatePillColors(
      clean[0] ?? "#808080",
      count,
      direction,
      mode,
      firstPillIntensity,
      lastPillIntensity,
    );
  }

  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    colors.push(samplePaletteStops(clean, t));
  }

  const ordered =
    direction === "dark-to-light" ? colors : [...colors].reverse();

  return applyEndIntensityToRamp(ordered, firstPillIntensity, lastPillIntensity);
}

/**
 * Single base color uses lightness ramp; two or more palette stops blend along the stack.
 */
export function generatePillColorsFromPalette(
  palette: string[],
  count: number,
  direction: "dark-to-light" | "light-to-dark",
  mode: "dark" | "light",
  firstPillIntensity: number,
  lastPillIntensity: number,
): string[] {
  const clean = palette.filter(Boolean);
  if (clean.length <= 1) {
    return generatePillColors(
      clean[0] ?? "#808080",
      count,
      direction,
      mode,
      firstPillIntensity,
      lastPillIntensity,
    );
  }
  return generatePillColorsMulti(
    clean,
    count,
    direction,
    mode,
    firstPillIntensity,
    lastPillIntensity,
  );
}
