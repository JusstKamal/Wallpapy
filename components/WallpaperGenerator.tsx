"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  generatePillColorsFromPalette,
  hexToHsl,
  mixHexHsl,
} from "@/lib/colorUtils";
import {
  PRESETS,
  PRESET_DEFAULTS,
  type WallpaperPreset,
} from "@/lib/wallpaperPresets";
import {
  renderWallpaper,
  ASPECT_RATIOS,
  QUALITY_LEVELS,
  getPixelDimensions,
} from "@/lib/pillRenderer";
import {
  LiquidGlassRenderer,
  GlassParams,
  GLASS_DEFAULTS,
  computePillGeometry,
} from "@/lib/liquidGlassRenderer";
import {
  canvasToDataURLWithBitDepth,
  type ExportBitDepth,
} from "@/lib/exportBitDepth";

interface Config {
  /** One color = single-hue lightness ramp; two+ = gradient between stops along the stack. */
  paletteColors: string[];
  pillCount: number;
  /** 0–1, fades all pills together */
  pillOpacity: number;
  mode: "dark" | "light";
  direction: "dark-to-light" | "light-to-dark";
  stackDirection: "horizontal" | "vertical";
  overlapRatio: number;
  pillMainRatio: number;
  pillCrossRatio: number;
  /** 0.25–1: blend toward center (25% min, 100% max) */
  firstPillIntensity: number;
  /** 0.25–1 */
  lastPillIntensity: number;
  arIndex: number;
  qualityIndex: number;
  liquidGlass: boolean;
  glass: GlassParams;
  /** 0–10 internal = 0–100% in UI (same intensity curve); default 1 = 10% */
  backgroundTint: number;
  /** Alternating per-pill stagger (fraction of pill thickness); sign flips wobble direction */
  pillStagger: number;
  /** RGB export quantization (PNG samples stay 8-bit; simulates 10/12-bit precision). */
  exportBitDepth: ExportBitDepth;
}

const DEFAULT: Config = {
  paletteColors: ["#6D28D9"],
  mode: "dark",
  direction: "dark-to-light",
  ...PRESET_DEFAULTS,
  stackDirection: "horizontal",
  arIndex: 0,
  qualityIndex: 1,
  liquidGlass: false,
  glass: { ...GLASS_DEFAULTS },
  pillStagger: 0,
  exportBitDepth: 8,
};

/** Portrait canvas → vertical stack; landscape → horizontal (pills run along the long axis). */
function stackDirectionForAspectRatio(
  w: number,
  h: number,
): "horizontal" | "vertical" {
  return h > w ? "vertical" : "horizontal";
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export default function WallpaperGenerator() {
  const [config, setConfig] = useState<Config>(DEFAULT);
  /** Which preset “Reset” reapplies; updated when a preset chip is chosen. */
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const glRendererRef = useRef<LiquidGlassRenderer | null>(null);

  const set = <K extends keyof Config>(key: K, value: Config[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const setGlass = (
    key: keyof GlassParams,
    value: GlassParams[keyof GlassParams],
  ) =>
    setConfig((prev) => ({ ...prev, glass: { ...prev.glass, [key]: value } }));

  const setPaletteColor = (index: number, hex: string) =>
    setConfig((prev) => {
      const next = [...prev.paletteColors];
      next[index] = hex;
      return { ...prev, paletteColors: next };
    });

  const addPaletteStop = () =>
    setConfig((prev) => {
      if (prev.paletteColors.length >= 8) return prev;
      const last = prev.paletteColors[prev.paletteColors.length - 1] ?? "#888888";
      return {
        ...prev,
        paletteColors: [
          ...prev.paletteColors,
          mixHexHsl(last, "#ffffff", 0.12),
        ],
      };
    });

  const removePaletteStop = (index: number) =>
    setConfig((prev) => {
      if (prev.paletteColors.length <= 1) return prev;
      return {
        ...prev,
        paletteColors: prev.paletteColors.filter((_, i) => i !== index),
      };
    });

  const baseColor = config.paletteColors[0] ?? "#6D28D9";
  const colors = generatePillColorsFromPalette(
    config.paletteColors,
    config.pillCount,
    config.direction,
    config.mode,
    config.firstPillIntensity,
    config.lastPillIntensity,
  );
  const { width: exportW, height: exportH } = getPixelDimensions(
    config.arIndex,
    config.qualityIndex,
  );
  const ar = ASPECT_RATIOS[config.arIndex];

  const [h] = hexToHsl(baseColor);
  const accent = `hsl(${h}, 70%, 65%)`;
  const isPortrait = ar.h > ar.w;
  const isMdUp = useMediaQuery("(min-width: 768px)");

  const pillGeoArgs = [
    config.pillCount,
    colors,
    config.pillOpacity,
    config.stackDirection,
    config.overlapRatio,
    config.pillMainRatio,
    config.pillCrossRatio,
    config.mode,
    baseColor,
    config.backgroundTint,
    config.pillStagger,
  ] as const;

  // ── Canvas2D preview (non-glass) ──────────────────────────────
  useEffect(() => {
    if (config.liquidGlass) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = canvas.clientWidth,
      ch = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    renderWallpaper(canvas, {
      width: canvas.width,
      height: canvas.height,
      pillCount: config.pillCount,
      colors,
      pillOpacity: config.pillOpacity,
      mode: config.mode,
      stackDirection: config.stackDirection,
      overlapRatio: config.overlapRatio,
      pillMainRatio: config.pillMainRatio,
      pillCrossRatio: config.pillCrossRatio,
      baseColor,
      backgroundTint: config.backgroundTint,
      pillStagger: config.pillStagger,
      liquidGlass: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // ── WebGL liquid glass preview ────────────────────────────────
  useEffect(() => {
    if (!config.liquidGlass) return;
    const canvas = glCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.round(canvas.clientWidth * dpr);
    const ch = Math.round(canvas.clientHeight * dpr);

    // Create or reuse renderer
    if (!glRendererRef.current) {
      try {
        canvas.width = cw;
        canvas.height = ch;
        glRendererRef.current = new LiquidGlassRenderer(canvas);
      } catch (e) {
        console.error("WebGL init failed:", e);
        return;
      }
    } else {
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        glRendererRef.current.resize(cw, ch);
      }
    }

    const geo = computePillGeometry(cw, ch, ...pillGeoArgs);
    glRendererRef.current.render(geo, config.glass, dpr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Dispose WebGL renderer when switching off
  useEffect(() => {
    if (!config.liquidGlass && glRendererRef.current) {
      glRendererRef.current.dispose();
      glRendererRef.current = null;
    }
  }, [config.liquidGlass]);

  const download = useCallback(() => {
    if (config.liquidGlass) {
      const offscreen = document.createElement("canvas");
      offscreen.width = exportW;
      offscreen.height = exportH;
      let renderer: LiquidGlassRenderer | null = null;
      try {
        renderer = new LiquidGlassRenderer(offscreen);
        const geo = computePillGeometry(exportW, exportH, ...pillGeoArgs);
        renderer.render(geo, config.glass, 1);
        const link = document.createElement("a");
        const bd = config.exportBitDepth;
        link.download = `wallpapy-glass-${exportW}x${exportH}${bd === 8 ? "" : `-${bd}bit`}.png`;
        link.href = canvasToDataURLWithBitDepth(offscreen, bd);
        link.click();
      } catch (e) {
        console.error("Export failed:", e);
      } finally {
        renderer?.dispose();
      }
    } else {
      const offscreen = document.createElement("canvas");
      offscreen.width = exportW;
      offscreen.height = exportH;
      renderWallpaper(offscreen, {
        width: exportW,
        height: exportH,
        pillCount: config.pillCount,
        colors,
        pillOpacity: config.pillOpacity,
        mode: config.mode,
        stackDirection: config.stackDirection,
        overlapRatio: config.overlapRatio,
        pillMainRatio: config.pillMainRatio,
        pillCrossRatio: config.pillCrossRatio,
      baseColor,
      backgroundTint: config.backgroundTint,
      pillStagger: config.pillStagger,
      liquidGlass: false,
      });
      const link = document.createElement("a");
      const bd = config.exportBitDepth;
      link.download = `wallpapy-${exportW}x${exportH}${bd === 8 ? "" : `-${bd}bit`}.png`;
      link.href = canvasToDataURLWithBitDepth(offscreen, bd);
      link.click();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, exportW, exportH]);

  const applyPreset = (p: WallpaperPreset) =>
    setConfig((prev) => ({
      ...prev,
      paletteColors:
        p.paletteColors && p.paletteColors.length > 0
          ? p.paletteColors
          : [p.color],
      mode: p.mode,
      direction: p.direction,
      pillCount: p.pillCount,
      pillOpacity: p.pillOpacity,
      overlapRatio: p.overlapRatio,
      pillMainRatio: p.pillMainRatio,
      pillCrossRatio: p.pillCrossRatio,
      firstPillIntensity: p.firstPillIntensity,
      lastPillIntensity: p.lastPillIntensity,
      backgroundTint: p.backgroundTint,
    }));

  // Preview frame: desktop uses side-by-side layout; mobile stacks controls below — different vertical budget.
  const previewSlot = isMdUp ? "(100dvh - 9rem)" : "(100dvh - 14rem)";
  const previewFrameStyle: React.CSSProperties = {
    aspectRatio: `${ar.w} / ${ar.h}`,
    maxHeight: `calc(${previewSlot})`,
    maxWidth: isPortrait
      ? isMdUp
        ? "min(50%, 100%)"
        : "100%"
      : "100%",
    width: isPortrait
      ? isMdUp
        ? `min(min(50%, 100%), calc(${previewSlot} * ${ar.w / ar.h}))`
        : `min(100%, calc(${previewSlot} * ${ar.w / ar.h}))`
      : `min(100%, calc(${previewSlot} * ${ar.w / ar.h}))`,
    height: "auto",
  };

  return (
    <div className="fixed inset-0 z-0 flex min-h-dvh flex-col overflow-hidden bg-[#0d0d0d] text-white">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div
            className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center"
            style={{ background: accent }}
          >
            <PillIcon />
          </div>
          <span className="truncate font-semibold tracking-tight text-[14px] sm:text-[15px]">
            Wallpapy
          </span>
        </div>
        <button
          type="button"
          onClick={download}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-all active:scale-[0.97] sm:gap-2 sm:px-4 sm:text-[13px] touch-manipulation"
          style={{ background: accent, color: "#0d0d0d" }}
        >
          <DownloadIcon />
          <span className="hidden sm:inline">Export {exportW} × {exportH}</span>
          <span className="sm:hidden">Export</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {/* Controls — below preview on mobile, left rail on md+ */}
        <aside className="order-2 flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain border-t border-white/[0.06] pb-[max(1rem,env(safe-area-inset-bottom))] md:order-1 md:w-72 md:shrink-0 md:flex-none md:border-r md:border-t-0 md:pb-0">
          <Section label="Presets">
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p, i) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    applyPreset(p);
                    setSelectedPresetIndex(i);
                  }}
                  className={`group flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors ${
                    selectedPresetIndex === i
                      ? "border-white/25 bg-white/[0.07]"
                      : "border-white/[0.08] hover:border-white/20"
                  }`}
                >
                  <div className="w-full h-7 rounded-md overflow-hidden flex">
                    {generatePillColorsFromPalette(
                      p.paletteColors ?? [p.color],
                      5,
                      p.direction,
                      p.mode,
                      p.firstPillIntensity,
                      p.lastPillIntensity,
                    ).map(
                      (c, i) => (
                        <div
                          key={i}
                          className="flex-1"
                          style={{ background: c }}
                        />
                      ),
                    )}
                  </div>
                  <span
                    className={`text-[11px] transition-colors ${
                      selectedPresetIndex === i
                        ? "text-white/75"
                        : "text-white/40 group-hover:text-white/70"
                    }`}
                  >
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section label="Color">
            <p className="text-[11px] text-white/35 mb-2 leading-snug">
              One color: lightness ramp. Multiple: gradient from first → last
              along the pill stack (background tint uses the first stop).
            </p>
            <div className="flex flex-col gap-2">
              {config.paletteColors.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-[10px] text-white/30 font-mono text-right">
                    {i + 1}
                  </span>
                  <label className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/10 cursor-pointer shrink-0">
                    <input
                      type="color"
                      value={c}
                      onChange={(e) => setPaletteColor(i, e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div
                      className="w-full h-full"
                      style={{ background: c }}
                    />
                  </label>
                  <input
                    type="text"
                    value={c.toUpperCase()}
                    onChange={(e) => {
                      if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value))
                        setPaletteColor(i, e.target.value);
                    }}
                    className="flex-1 min-w-0 bg-white/[0.06] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[12px] font-mono uppercase tracking-wider text-white/80 focus:outline-none focus:border-white/20"
                  />
                  {config.paletteColors.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removePaletteStop(i)}
                      className="shrink-0 w-8 h-8 rounded-lg border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/15 text-[16px] leading-none flex items-center justify-center"
                      aria-label={`Remove color ${i + 1}`}
                    >
                      ×
                    </button>
                  ) : (
                    <span className="w-8 shrink-0" aria-hidden />
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addPaletteStop}
              disabled={config.paletteColors.length >= 8}
              className="mt-2 w-full py-2 rounded-lg text-[12px] border border-white/[0.08] text-white/45 hover:text-white/70 hover:border-white/15 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              Add color stop
            </button>
            <div
              className="flex mt-3 rounded-lg overflow-hidden border border-white/[0.08]"
              style={{ height: 24, opacity: config.pillOpacity }}
            >
              {colors.map((c, i) => (
                <div key={i} className="flex-1" style={{ background: c }} />
              ))}
            </div>
            <div className="mt-3">
              <Slider
                label="Background tint"
                value={config.backgroundTint}
                min={0}
                max={10}
                step={0.01}
                display={`${Math.round(config.backgroundTint * 10)}%`}
                onChange={(v) => set("backgroundTint", v)}
                accent={accent}
              />
            </div>
          </Section>

          <Section label="Mode">
            <Seg
              options={
                [
                  ["dark", "Dark"],
                  ["light", "Light"],
                ] as const
              }
              value={config.mode}
              onChange={(v) => set("mode", v as "dark" | "light")}
            />
            <div className="mt-2">
              <Seg
                options={
                  [
                    ["dark-to-light", "Dark → Light"],
                    ["light-to-dark", "Light → Dark"],
                  ] as const
                }
                value={config.direction}
                onChange={(v) => set("direction", v as Config["direction"])}
              />
            </div>
          </Section>

          <Section label="Stack Direction">
            <div className="flex gap-2">
              {(["horizontal", "vertical"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => set("stackDirection", d)}
                  className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-lg border transition-colors ${config.stackDirection === d ? "border-white/20 bg-white/[0.08] text-white" : "border-white/[0.06] text-white/30 hover:text-white/50"}`}
                >
                  {d === "horizontal" ? (
                    <HStackIcon
                      active={config.stackDirection === d}
                      accent={accent}
                    />
                  ) : (
                    <VStackIcon
                      active={config.stackDirection === d}
                      accent={accent}
                    />
                  )}
                  <span className="text-[11px] capitalize">{d}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section label="Pills">
            <Slider
              label="Count"
              value={config.pillCount}
              min={3}
              max={16}
              step={1}
              display={String(config.pillCount)}
              onChange={(v) => set("pillCount", v)}
              accent={accent}
            />
            <Slider
              label="Overlap"
              value={config.overlapRatio}
              min={-1.2}
              max={0.75}
              step={0.01}
              display={
                config.overlapRatio <= 0
                  ? `Gap ${Math.round(-config.overlapRatio * 100)}%`
                  : `Overlap ${Math.round(config.overlapRatio * 100)}%`
              }
              onChange={(v) => set("overlapRatio", v)}
              accent={accent}
            />
            <Slider
              label={
                config.stackDirection === "horizontal" ? "Height" : "Width"
              }
              value={config.pillMainRatio}
              min={0.2}
              max={0.95}
              step={0.01}
              display={`${Math.round(config.pillMainRatio * 100)}%`}
              onChange={(v) => set("pillMainRatio", v)}
              accent={accent}
            />
            <Slider
              label="Thickness"
              value={config.pillCrossRatio}
              min={0.06}
              max={0.5}
              step={0.01}
              display={`${Math.round(config.pillCrossRatio * 100)}%`}
              onChange={(v) => set("pillCrossRatio", v)}
              accent={accent}
            />
            <Slider
              label="Opacity"
              value={config.pillOpacity}
              min={0}
              max={1}
              step={0.01}
              display={`${Math.round(config.pillOpacity * 100)}%`}
              onChange={(v) => set("pillOpacity", v)}
              accent={accent}
            />
            <Slider
              label="First side → center"
              value={config.firstPillIntensity}
              min={0.25}
              max={1}
              step={0.01}
              display={`${Math.round(config.firstPillIntensity * 100)}%`}
              onChange={(v) => set("firstPillIntensity", v)}
              accent={accent}
            />
            <Slider
              label="Last side → center"
              value={config.lastPillIntensity}
              min={0.25}
              max={1}
              step={0.01}
              display={`${Math.round(config.lastPillIntensity * 100)}%`}
              onChange={(v) => set("lastPillIntensity", v)}
              accent={accent}
            />
          </Section>

          {/* ── Liquid Glass Toggle ─────────────────────── */}
          <div className="px-4 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-[13px] font-medium text-white/80">
                  Liquid Glass
                </p>
                <p className="text-[11px] text-white/30 mt-0.5">
                  WebGL · Snell refraction · LCH glare
                </p>
              </div>
              <button
                onClick={() => {
                  setConfig((prev) => {
                    const next = !prev.liquidGlass;
                    return {
                      ...prev,
                      liquidGlass: next,
                      ...(next ? { pillOpacity: 0.5 } : {}),
                    };
                  });
                }}
                className="relative w-11 h-6 rounded-full transition-all duration-200 shrink-0"
                style={{
                  background: config.liquidGlass
                    ? accent
                    : "rgba(255,255,255,0.1)",
                }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200"
                  style={{
                    left: config.liquidGlass ? "calc(100% - 22px)" : "2px",
                    background: config.liquidGlass
                      ? "#0d0d0d"
                      : "rgba(255,255,255,0.45)",
                  }}
                />
              </button>
            </div>
          </div>

          {/* ── Glass controls (only when liquid glass on) ── */}
          {config.liquidGlass && (
            <>
              <Section label="Refraction">
                <Slider
                  label="Thickness"
                  value={config.glass.refThickness}
                  min={1}
                  max={80}
                  step={0.5}
                  display={config.glass.refThickness.toFixed(0)}
                  onChange={(v) => setGlass("refThickness", v)}
                  accent={accent}
                />
                <Slider
                  label="Factor"
                  value={config.glass.refFactor}
                  min={1}
                  max={4}
                  step={0.01}
                  display={config.glass.refFactor.toFixed(2)}
                  onChange={(v) => setGlass("refFactor", v)}
                  accent={accent}
                />
                <Slider
                  label="Dispersion"
                  value={config.glass.refDispersion}
                  min={0}
                  max={50}
                  step={0.5}
                  display={config.glass.refDispersion.toFixed(0)}
                  onChange={(v) => setGlass("refDispersion", v)}
                  accent={accent}
                />
              </Section>
              <Section label="Fresnel">
                <Slider
                  label="Range"
                  value={config.glass.refFresnelRange}
                  min={0}
                  max={100}
                  step={0.5}
                  display={config.glass.refFresnelRange.toFixed(0)}
                  onChange={(v) => setGlass("refFresnelRange", v)}
                  accent={accent}
                />
                <Slider
                  label="Hardness"
                  value={config.glass.refFresnelHardness}
                  min={0}
                  max={100}
                  step={0.5}
                  display={config.glass.refFresnelHardness.toFixed(0)}
                  onChange={(v) => setGlass("refFresnelHardness", v)}
                  accent={accent}
                />
                <Slider
                  label="Factor"
                  value={config.glass.refFresnelFactor}
                  min={0}
                  max={100}
                  step={0.5}
                  display={config.glass.refFresnelFactor.toFixed(0)}
                  onChange={(v) => setGlass("refFresnelFactor", v)}
                  accent={accent}
                />
              </Section>
              <Section label="Glare">
                <Slider
                  label="Range"
                  value={config.glass.glareRange}
                  min={0}
                  max={100}
                  step={0.5}
                  display={config.glass.glareRange.toFixed(0)}
                  onChange={(v) => setGlass("glareRange", v)}
                  accent={accent}
                />
                <Slider
                  label="Hardness"
                  value={config.glass.glareHardness}
                  min={0}
                  max={100}
                  step={0.5}
                  display={config.glass.glareHardness.toFixed(0)}
                  onChange={(v) => setGlass("glareHardness", v)}
                  accent={accent}
                />
                <Slider
                  label="Factor"
                  value={config.glass.glareFactor}
                  min={0}
                  max={120}
                  step={0.5}
                  display={config.glass.glareFactor.toFixed(0)}
                  onChange={(v) => setGlass("glareFactor", v)}
                  accent={accent}
                />
                <Slider
                  label="Convergence"
                  value={config.glass.glareConvergence}
                  min={0}
                  max={100}
                  step={0.5}
                  display={config.glass.glareConvergence.toFixed(0)}
                  onChange={(v) => setGlass("glareConvergence", v)}
                  accent={accent}
                />
                <Slider
                  label="Opposite"
                  value={config.glass.glareOppositeFactor}
                  min={0}
                  max={100}
                  step={0.5}
                  display={config.glass.glareOppositeFactor.toFixed(0)}
                  onChange={(v) => setGlass("glareOppositeFactor", v)}
                  accent={accent}
                />
                <Slider
                  label="Angle"
                  value={config.glass.glareAngle}
                  min={-180}
                  max={180}
                  step={1}
                  display={`${config.glass.glareAngle.toFixed(0)}°`}
                  onChange={(v) => setGlass("glareAngle", v)}
                  accent={accent}
                />
              </Section>
              <Section label="Shadow">
                <Slider
                  label="Expand"
                  value={config.glass.shadowExpand}
                  min={2}
                  max={100}
                  step={0.5}
                  display={config.glass.shadowExpand.toFixed(0)}
                  onChange={(v) => setGlass("shadowExpand", v)}
                  accent={accent}
                />
                <Slider
                  label="Factor"
                  value={config.glass.shadowFactor}
                  min={0}
                  max={100}
                  step={0.5}
                  display={`${config.glass.shadowFactor.toFixed(0)}%`}
                  onChange={(v) => setGlass("shadowFactor", v)}
                  accent={accent}
                />
                <Slider
                  label="Offset X"
                  value={config.glass.shadowX}
                  min={-50}
                  max={50}
                  step={1}
                  display={`${config.glass.shadowX.toFixed(0)}px`}
                  onChange={(v) => setGlass("shadowX", v)}
                  accent={accent}
                />
                <Slider
                  label="Offset Y"
                  value={config.glass.shadowY}
                  min={-50}
                  max={50}
                  step={1}
                  display={`${config.glass.shadowY.toFixed(0)}px`}
                  onChange={(v) => setGlass("shadowY", v)}
                  accent={accent}
                />
              </Section>
              <Section label="Glass Blur">
                <Slider
                  label="Radius"
                  value={config.glass.blurRadius}
                  min={1}
                  max={60}
                  step={1}
                  display={`${config.glass.blurRadius}px`}
                  onChange={(v) => setGlass("blurRadius", Math.round(v))}
                  accent={accent}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[12px] text-white/45">Blur Edge</span>
                  <button
                    onClick={() => setGlass("blurEdge", !config.glass.blurEdge)}
                    className="relative w-9 h-5 rounded-full transition-all duration-150"
                    style={{
                      background: config.glass.blurEdge
                        ? accent
                        : "rgba(255,255,255,0.1)",
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-150"
                      style={{
                        left: config.glass.blurEdge
                          ? "calc(100% - 18px)"
                          : "2px",
                        background: config.glass.blurEdge
                          ? "#0d0d0d"
                          : "rgba(255,255,255,0.4)",
                      }}
                    />
                  </button>
                </div>
              </Section>
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <button
                  onClick={() => set("glass", { ...GLASS_DEFAULTS })}
                  className="w-full py-1.5 text-[12px] text-white/25 hover:text-white/45 border border-white/[0.05] hover:border-white/10 rounded-lg transition-colors"
                >
                  Reset glass defaults
                </button>
              </div>
            </>
          )}

          <Section label="Aspect Ratio">
            <div className="-mx-4 overflow-x-auto px-4 pb-0.5 md:mx-0 md:overflow-visible md:px-0">
              <div className="grid min-w-[300px] grid-cols-5 gap-1.5 sm:min-w-0">
              {ASPECT_RATIOS.map((a, i) => (
                <button
                  key={a.label}
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      arIndex: i,
                      stackDirection: stackDirectionForAspectRatio(a.w, a.h),
                    }))
                  }
                  className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg border transition-colors ${config.arIndex === i ? "border-white/20 bg-white/[0.08] text-white" : "border-white/[0.06] text-white/30 hover:text-white/50"}`}
                >
                  <ARThumb
                    w={a.w}
                    h={a.h}
                    active={config.arIndex === i}
                    accent={accent}
                  />
                  <span className="text-[10px] font-mono leading-none">
                    {a.label}
                  </span>
                </button>
              ))}
              </div>
            </div>
          </Section>

          <Section label="Quality">
            <div className="flex gap-1.5">
              {QUALITY_LEVELS.map((q, i) => (
                <button
                  key={q.label}
                  onClick={() => set("qualityIndex", i)}
                  className={`flex-1 py-1.5 rounded-lg border text-[12px] font-mono transition-colors ${config.qualityIndex === i ? "border-white/20 bg-white/[0.08] text-white" : "border-white/[0.06] text-white/30 hover:text-white/50"}`}
                >
                  {q.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-white/20 mt-2 text-center font-mono">
              {exportW} × {exportH}px
            </p>
          </Section>

          <Section label="Alternating stagger">
            <Slider
              label="Wobble"
              value={config.pillStagger}
              min={-0.35}
              max={0.35}
              step={0.005}
              display={`${config.pillStagger >= 0 ? "+" : ""}${Math.round(config.pillStagger * 100)}%`}
              onChange={(v) => set("pillStagger", v)}
              accent={accent}
            />
            <p className="text-[11px] text-white/20 mt-1">
              Offsets every other pill along the cross axis; negative values flip
              which side goes first. Scale is % of pill thickness (height in a
              row, width in a column).
            </p>
          </Section>

          <Section label="Export color depth">
            <Seg
              options={
                [
                  ["8", "8-bit"],
                  ["10", "10-bit"],
                  ["12", "12-bit"],
                ] as const
              }
              value={String(config.exportBitDepth)}
              onChange={(v) =>
                set("exportBitDepth", Number(v) as ExportBitDepth)
              }
            />
            <p className="text-[11px] text-white/20 mt-2">
              Export applies per-channel quantization. PNG files use 8-bit
              samples; higher settings reduce banding when viewed on wide-gamut /
              HDR displays.
            </p>
          </Section>

          <div className="p-4 mt-auto">
            <button
              type="button"
              onClick={() => applyPreset(PRESETS[selectedPresetIndex])}
              className="w-full py-2 rounded-lg text-[13px] text-white/25 hover:text-white/45 border border-white/[0.05] hover:border-white/10 transition-colors"
            >
              Reset to {PRESETS[selectedPresetIndex].name}
            </button>
          </div>
        </aside>

        {/* Preview — top on mobile, right on desktop */}
        <main className="order-1 flex min-h-0 min-w-0 shrink-0 flex-col items-center justify-center overflow-hidden bg-[#0a0a0a] px-4 py-4 sm:p-6 md:order-2 md:max-h-none md:flex-1 md:shrink md:px-8 md:py-8 max-h-[min(52vh,560px)] md:max-h-none">
          <div className="flex min-h-0 w-full max-w-full flex-1 flex-col items-center justify-center gap-2 sm:gap-3">
            <div
              className="box-border w-full max-w-full overflow-hidden rounded-xl border-2 border-white/[0.24] shadow-2xl shadow-black/50"
              style={previewFrameStyle}
            >
              {/* Canvas2D */}
              <canvas
                ref={canvasRef}
                className="block h-full w-full"
                style={{ display: config.liquidGlass ? "none" : "block" }}
              />
              {/* WebGL */}
              <canvas
                ref={glCanvasRef}
                className="block h-full w-full"
                style={{ display: config.liquidGlass ? "block" : "none" }}
              />
            </div>
            <div className="flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 px-1">
              <span className="text-[11px] text-white/20 font-mono">
                {exportW} × {exportH}
              </span>
              <span className="text-white/10">·</span>
              <span className="text-[11px] text-white/20">
                {config.pillCount} pills
              </span>
              <span className="text-white/10">·</span>
              <span className="text-[11px] text-white/20 capitalize">
                {config.stackDirection}
              </span>
              {config.liquidGlass && (
                <>
                  <span className="text-white/10">·</span>
                  <span className="text-[11px]" style={{ color: accent }}>
                    Liquid Glass
                  </span>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Shared UI components ────────────────────────────────────────

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-4 border-b border-white/[0.06]">
      <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest mb-3">
        {label}
      </p>
      {children}
    </div>
  );
}

function Seg({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 py-2 text-[12px] font-medium transition-colors ${value === v ? "bg-white/10 text-white" : "text-white/35 hover:text-white/55"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  accent,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
  accent: string;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[12px] text-white/45">{label}</span>
        <span className="text-[12px] font-mono text-white/55">{display}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/[0.07]">
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${pct}%`, background: accent }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
      </div>
    </div>
  );
}

function ARThumb({
  w,
  h,
  active,
  accent,
}: {
  w: number;
  h: number;
  active: boolean;
  accent: string;
}) {
  const maxW = 28,
    maxH = 22;
  const ratio = w / h;
  let tw: number, th: number;
  if (ratio >= 1) {
    tw = maxW;
    th = Math.max(Math.round(maxW / ratio), 4);
  } else {
    th = maxH;
    tw = Math.max(Math.round(maxH * ratio), 4);
  }
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: maxW, height: maxH }}
    >
      <div
        className="rounded-[2px] border"
        style={{
          width: tw,
          height: th,
          background: active ? `${accent}22` : "rgba(255,255,255,0.06)",
          borderColor: active ? accent : "rgba(255,255,255,0.12)",
        }}
      />
    </div>
  );
}

function HStackIcon({ active, accent }: { active: boolean; accent: string }) {
  const c = active ? accent : "rgba(255,255,255,0.3)";
  return (
    <svg width="32" height="20" viewBox="0 0 32 20" fill="none">
      {[0, 7, 14, 21].map((x, i) => (
        <rect
          key={x}
          x={x}
          y="0"
          width="11"
          height="20"
          rx="5.5"
          fill={c}
          opacity={(i + 1) * 0.25}
        />
      ))}
    </svg>
  );
}
function VStackIcon({ active, accent }: { active: boolean; accent: string }) {
  const c = active ? accent : "rgba(255,255,255,0.3)";
  return (
    <svg width="20" height="32" viewBox="0 0 20 32" fill="none">
      {[0, 7, 14, 21].map((y, i) => (
        <rect
          key={y}
          x="0"
          y={y}
          width="20"
          height="11"
          rx="5.5"
          fill={c}
          opacity={(i + 1) * 0.25}
        />
      ))}
    </svg>
  );
}
function PillIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect
        x="1"
        y="3"
        width="5"
        height="8"
        rx="2.5"
        fill="currentColor"
        opacity="0.7"
      />
      <rect x="8" y="3" width="5" height="8" rx="2.5" fill="currentColor" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 1v8M4 6l3 3 3-3M2 11h10" />
    </svg>
  );
}
