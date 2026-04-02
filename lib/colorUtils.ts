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

export function generatePillColors(
  baseHex: string,
  count: number,
  direction: 'dark-to-light' | 'light-to-dark',
  mode: 'dark' | 'light'
): string[] {
  const [h, s] = hexToHsl(baseHex);

  // In dark mode: go from very dark (low L) to near-white (high L)
  // In light mode: similar range but slightly different endpoints
  const darkEnd = mode === 'dark' ? 8 : 15;
  const lightEnd = mode === 'dark' ? 92 : 95;

  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const l = darkEnd + t * (lightEnd - darkEnd);
    // Reduce saturation at extremes for more natural feel
    const sFactor = 1 - Math.abs(t - 0.5) * 0.3;
    colors.push(hslToHex(h, Math.min(s * sFactor, 100), l));
  }

  return direction === 'dark-to-light' ? colors : [...colors].reverse();
}

export const PRESETS = [
  { name: 'Midnight', color: '#6B5CE7', mode: 'dark' as const, direction: 'dark-to-light' as const },
  { name: 'Ocean', color: '#3B6CF7', mode: 'light' as const, direction: 'light-to-dark' as const },
  { name: 'Crimson', color: '#E74C3C', mode: 'dark' as const, direction: 'dark-to-light' as const },
  { name: 'Forest', color: '#2ECC71', mode: 'dark' as const, direction: 'dark-to-light' as const },
  { name: 'Sunset', color: '#F39C12', mode: 'light' as const, direction: 'light-to-dark' as const },
  { name: 'Rose', color: '#E91E8C', mode: 'light' as const, direction: 'dark-to-light' as const },
];
