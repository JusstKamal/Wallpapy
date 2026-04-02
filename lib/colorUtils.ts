export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
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
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/** Canvas background tinted by the picked base hue (dark ≈ 5% L, light ≈ 94% L). */
export function wallpaperBackgroundFromBase(
  baseHex: string,
  mode: 'dark' | 'light',
): string {
  const [h, s] = hexToHsl(baseHex);
  if (mode === 'dark') {
    const bgS = Math.min(s * 0.42, 28);
    const bgL = 5.2;
    return hslToHex(h, bgS, bgL);
  }
  const bgS = Math.min(s * 0.34, 20);
  const bgL = 94.5;
  return hslToHex(h, bgS, bgL);
}

/** Linear mix in HSL; hue takes shortest arc. t=0 → `from`, t=1 → `to`. */
function mixHexHsl(from: string, to: string, t: number): string {
  const u = Math.min(1, Math.max(0, t));
  const [h1, s1, l1] = hexToHsl(from);
  const [h2, s2, l2] = hexToHsl(to);
  let dh = h2 - h1;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = h1 + dh * u;
  const s = s1 + (s2 - s1) * u;
  const l = l1 + (l2 - l1) * u;
  return hslToHex(h, Math.min(100, Math.max(0, s)), Math.min(100, Math.max(0, l)));
}

export function generatePillColors(
  baseHex: string,
  count: number,
  direction: 'dark-to-light' | 'light-to-dark',
  mode: 'dark' | 'light',
  /**
   * Blends every pill from the first end toward the stack center (main ramp).
   * Clamped to 0.25–1: 0.25 = strongest pull to center; 1 = full gradient on that side.
   */
  firstPillIntensity = 0.9,
  lastPillIntensity = 0.9
): string[] {
  const [h, s] = hexToHsl(baseHex);

  // In dark mode: go from very dark (low L) to near-white (high L)
  // In light mode: similar range but slightly different endpoints
  const darkEnd = mode === 'dark' ? 8 : 15;
  const lightEnd = mode === 'dark' ? 92 : 95;

  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const l = darkEnd + t * (lightEnd - darkEnd);
    // Reduce saturation at extremes for more natural feel
    const sFactor = 1 - Math.abs(t - 0.5) * 0.3;
    colors.push(hslToHex(h, Math.min(s * sFactor, 100), l));
  }

  const natural = direction === 'dark-to-light' ? colors : [...colors].reverse();

  const a = Math.min(1, Math.max(0.25, firstPillIntensity));
  const b = Math.min(1, Math.max(0.25, lastPillIntensity));

  if (count <= 1) {
    return natural;
  }

  const out = [...natural];

  // Middle pill(s) = "main" anchor color(s) on the ramp (same hue as base).
  const centerLo = Math.floor((count - 1) / 2);
  const centerHi = Math.ceil((count - 1) / 2);

  if (count === 2) {
    const mid = mixHexHsl(natural[0], natural[1], 0.5);
    out[0] = mixHexHsl(mid, natural[0], a);
    out[1] = mixHexHsl(mid, natural[1], b);
    return out;
  }

  for (let i = 0; i < centerLo; i++) {
    out[i] = mixHexHsl(natural[centerLo], natural[i], a);
  }
  for (let i = centerHi + 1; i < count; i++) {
    out[i] = mixHexHsl(natural[centerHi], natural[i], b);
  }

  return out;
}

export const PRESETS = [
  { name: 'Midnight', color: '#6B5CE7', mode: 'dark' as const, direction: 'dark-to-light' as const },
  { name: 'Ocean', color: '#3B6CF7', mode: 'light' as const, direction: 'light-to-dark' as const },
  { name: 'Crimson', color: '#E74C3C', mode: 'dark' as const, direction: 'dark-to-light' as const },
  { name: 'Forest', color: '#2ECC71', mode: 'dark' as const, direction: 'dark-to-light' as const },
  { name: 'Sunset', color: '#F39C12', mode: 'light' as const, direction: 'light-to-dark' as const },
  { name: 'Rose', color: '#E91E8C', mode: 'light' as const, direction: 'dark-to-light' as const },
];
