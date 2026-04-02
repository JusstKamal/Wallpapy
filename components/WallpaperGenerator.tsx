"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generatePillColors, hexToHsl, PRESETS } from "@/lib/colorUtils";
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

interface Config {
  baseColor: string;
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
}

const DEFAULT: Config = {
  baseColor: "#6B5CE7",
  pillCount: 9,
  pillOpacity: 1,
  mode: "dark",
  direction: "dark-to-light",
  stackDirection: "horizontal",
  overlapRatio: 0.52,
  pillMainRatio: 0.58,
  pillCrossRatio: 0.4,
  firstPillIntensity: 0.9,
  lastPillIntensity: 0.9,
  arIndex: 0,
  qualityIndex: 1,
  liquidGlass: false,
  glass: { ...GLASS_DEFAULTS },
};

/** Portrait canvas → vertical stack; landscape → horizontal (pills run along the long axis). */
function stackDirectionForAspectRatio(
  w: number,
  h: number,
): "horizontal" | "vertical" {
  return h > w ? "vertical" : "horizontal";
}

export default function WallpaperGenerator() {
  const [config, setConfig] = useState<Config>(DEFAULT);
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

  const colors = generatePillColors(
    config.baseColor,
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

  const [h] = hexToHsl(config.baseColor);
  const accent = `hsl(${h}, 70%, 65%)`;
  const isPortrait = ar.h > ar.w;

  const pillGeoArgs = [
    config.pillCount,
    colors,
    config.pillOpacity,
    config.stackDirection,
    config.overlapRatio,
    config.pillMainRatio,
    config.pillCrossRatio,
    config.mode,
    config.baseColor,
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
      baseColor: config.baseColor,
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
        link.download = `wallpapy-glass-${exportW}x${exportH}.png`;
        link.href = offscreen.toDataURL("image/png");
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
        baseColor: config.baseColor,
        liquidGlass: false,
      });
      const link = document.createElement("a");
      link.download = `wallpapy-${exportW}x${exportH}.png`;
      link.href = offscreen.toDataURL("image/png");
      link.click();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, exportW, exportH]);

  const applyPreset = (p: (typeof PRESETS)[0]) =>
    setConfig((prev) => ({
      ...prev,
      baseColor: p.color,
      mode: p.mode,
      direction: p.direction,
    }));

  // Preview frame max size: viewport minus header, padding, and caption row (~9rem total).
  const previewSlot = "(100dvh - 9rem)";
  const previewFrameStyle: React.CSSProperties = {
    aspectRatio: `${ar.w} / ${ar.h}`,
    maxHeight: `calc(${previewSlot})`,
    maxWidth: isPortrait ? "min(50%, 100%)" : "100%",
    width: `min(${isPortrait ? "min(50%, 100%)" : "100%"}, calc(${previewSlot} * ${ar.w / ar.h}))`,
    height: "auto",
  };

  return (
    <div className="fixed inset-0 z-0 flex flex-col overflow-hidden bg-[#0d0d0d] text-white">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: accent }}
          >
            <PillIcon />
          </div>
          <span className="font-semibold tracking-tight text-[15px]">
            Wallpapy
          </span>
        </div>
        <button
          onClick={download}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all active:scale-[0.97]"
          style={{ background: accent, color: "#0d0d0d" }}
        >
          <DownloadIcon />
          Export {exportW} × {exportH}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex h-full min-h-0 w-72 shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] overscroll-contain">
          <Section label="Presets">
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  className="group flex flex-col items-center gap-1.5 p-2 rounded-lg border border-white/[0.08] hover:border-white/20 transition-colors"
                >
                  <div className="w-full h-7 rounded-md overflow-hidden flex">
                    {generatePillColors(p.color, 5, p.direction, p.mode).map(
                      (c, i) => (
                        <div
                          key={i}
                          className="flex-1"
                          style={{ background: c }}
                        />
                      ),
                    )}
                  </div>
                  <span className="text-[11px] text-white/40 group-hover:text-white/70 transition-colors">
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section label="Color">
            <div className="flex items-center gap-3">
              <label className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/10 cursor-pointer shrink-0">
                <input
                  type="color"
                  value={config.baseColor}
                  onChange={(e) => set("baseColor", e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div
                  className="w-full h-full"
                  style={{ background: config.baseColor }}
                />
              </label>
              <input
                type="text"
                value={config.baseColor.toUpperCase()}
                onChange={(e) => {
                  if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value))
                    set("baseColor", e.target.value);
                }}
                className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] font-mono uppercase tracking-wider text-white/80 focus:outline-none focus:border-white/20"
              />
            </div>
            <div
              className="flex mt-3 rounded-lg overflow-hidden border border-white/[0.08]"
              style={{ height: 24, opacity: config.pillOpacity }}
            >
              {colors.map((c, i) => (
                <div key={i} className="flex-1" style={{ background: c }} />
              ))}
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
              <Section label="Tint">
                <div className="flex items-center gap-3">
                  <label className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/10 cursor-pointer shrink-0">
                    <input
                      type="color"
                      value={`#${Math.round(config.glass.tint.r * 255)
                        .toString(16)
                        .padStart(2, "0")}${Math.round(
                        config.glass.tint.g * 255,
                      )
                        .toString(16)
                        .padStart(2, "0")}${Math.round(
                        config.glass.tint.b * 255,
                      )
                        .toString(16)
                        .padStart(2, "0")}`}
                      onChange={(e) => {
                        const r =
                          parseInt(e.target.value.slice(1, 3), 16) / 255;
                        const g =
                          parseInt(e.target.value.slice(3, 5), 16) / 255;
                        const b =
                          parseInt(e.target.value.slice(5, 7), 16) / 255;
                        setGlass("tint", { ...config.glass.tint, r, g, b });
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div
                      className="w-full h-full"
                      style={{
                        background: `rgb(${Math.round(config.glass.tint.r * 255)},${Math.round(config.glass.tint.g * 255)},${Math.round(config.glass.tint.b * 255)})`,
                      }}
                    />
                  </label>
                  <Slider
                    label="Opacity"
                    value={config.glass.tint.a}
                    min={0}
                    max={1}
                    step={0.01}
                    display={`${Math.round(config.glass.tint.a * 100)}%`}
                    onChange={(v) =>
                      setGlass("tint", { ...config.glass.tint, a: v })
                    }
                    accent={accent}
                  />
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

          <Section label="Aspect Ratio">
            <div className="grid grid-cols-5 gap-1.5">
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

          <div className="p-4 mt-auto">
            <button
              onClick={() => setConfig(DEFAULT)}
              className="w-full py-2 rounded-lg text-[13px] text-white/25 hover:text-white/45 border border-white/[0.05] hover:border-white/10 transition-colors"
            >
              Reset all
            </button>
          </div>
        </aside>

        {/* Preview — always visible; never scrolled out of view */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden bg-[#0a0a0a] p-6 md:p-8">
          <div className="flex min-h-0 w-full max-w-full flex-1 flex-col items-center justify-center gap-3">
            <div
              className="box-border overflow-hidden rounded-xl border-2 border-white/[0.24] shadow-2xl shadow-black/50"
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
            <div className="flex items-center gap-2">
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
