"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
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
  ASPECT_CUSTOM_INDEX,
  QUALITY_LEVELS,
  getPixelDimensions,
  getAspectRatioParts,
  clampAspectRatioPart,
  normalizeCustomAspectPair,
  ASPECT_RATIO_PART_MAX,
  ASPECT_MAX_SIDE_RATIO,
  type StackLayerOrder,
} from "@/lib/pillRenderer";
import {
  LiquidGlassRenderer,
  type GlassParams,
  GLASS_DEFAULTS,
  computePillGeometry,
  scaleGlassParamsToCanvas,
} from "@/lib/liquidGlassRenderer";
import {
  canvasToDataURLWithBitDepth,
  type ExportBitDepth,
} from "@/lib/exportBitDepth";
import packageJson from "@/package.json";

const SOCIAL_LINKS = [
  { label: "YouTube", href: "https://www.youtube.com/@JusstKamal" },
  { label: "TikTok", href: "https://www.tiktok.com/@JusstKamal" },
  { label: "Facebook", href: "https://www.facebook.com/JusstKamal" },
  { label: "Instagram", href: "https://www.instagram.com/JusstKamal" },
  { label: "GitHub", href: "https://github.com/JusstKamal" },
  { label: "LinkedIn", href: "https://www.linkedin.com/feed/" },
] as const;

interface Config {
  /** One color = single-hue lightness ramp; two+ = gradient between stops along the stack. */
  paletteColors: string[];
  pillCount: number;
  /** 0–1, fades all pills together */
  pillOpacity: number;
  mode: "dark" | "light";
  direction: "dark-to-light" | "light-to-dark";
  stackDirection: "horizontal" | "vertical";
  /** Which end of the stack is in front when pills overlap (left/top vs right/bottom). */
  stackLayerOrder: StackLayerOrder;
  overlapRatio: number;
  pillMainRatio: number;
  pillCrossRatio: number;
  /** 0.25–1: blend toward center (25% min, 100% max) */
  firstPillIntensity: number;
  /** 0.25–1 */
  lastPillIntensity: number;
  arIndex: number;
  /** Ratio parts when `arIndex === ASPECT_CUSTOM_INDEX`. */
  customAspectW: number;
  customAspectH: number;
  qualityIndex: number;
  liquidGlass: boolean;
  glass: GlassParams;
  /** 0–10 internal = 0–100% in UI (same intensity curve); default 1 = 10% */
  backgroundTint: number;
  /** -1..1 where negative darkens and positive brightens the background. */
  backgroundBrightness: number;
  /** Base64 data URL of uploaded background image, or null for solid color. */
  backgroundImage: string | null;
  /** Index into paletteColors used for background tinting (default 0). */
  backgroundTintColorIndex: number;
  /** Gaussian blur radius in px applied to background image (0 = sharp). */
  backgroundBlur: number;
  /** Alternating per-pill stagger (fraction of pill thickness); sign flips wobble direction */
  pillStagger: number;
  /** RGB export quantization (PNG samples stay 8-bit; simulates 10/12-bit precision). */
  exportBitDepth: ExportBitDepth;
  /** Export & preview as two halves for dual monitors */
  dualMonitor: boolean;
  /** How to split: left/right or top/bottom */
  dualSplit: "left-right" | "top-bottom";
}

const DEFAULT: Config = {
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
  const [exportBusy, setExportBusy] = useState(false);
  const exportLockRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const dualCanvasARef = useRef<HTMLCanvasElement>(null);
  const dualCanvasBRef = useRef<HTMLCanvasElement>(null);
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

  const reorderPaletteStops = (from: number, to: number) => {
    if (from === to) return;
    setConfig((prev) => {
      const next = [...prev.paletteColors];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { ...prev, paletteColors: next };
    });
  };

  const [paletteDragFrom, setPaletteDragFrom] = useState<number | null>(null);
  const [paletteDropTarget, setPaletteDropTarget] = useState<number | null>(
    null,
  );

  const [bgImageElement, setBgImageElement] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!config.backgroundImage) {
      setBgImageElement(null);
      glRendererRef.current?.setBackgroundImage(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setBgImageElement(img);
      glRendererRef.current?.setBackgroundImage(img);
    };
    img.src = config.backgroundImage;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.backgroundImage]);

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      set("backgroundImage", dataUrl);
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-uploaded
    e.target.value = "";
  };

  const baseColor = config.paletteColors[0] ?? "#6D28D9";
  const tintColor =
    config.paletteColors[
      Math.min(config.backgroundTintColorIndex, config.paletteColors.length - 1)
    ] ?? baseColor;
  const colors = generatePillColorsFromPalette(
    config.paletteColors,
    config.pillCount,
    config.direction,
    config.mode,
    config.firstPillIntensity,
    config.lastPillIntensity,
  );
  const customAspect = {
    w: config.customAspectW,
    h: config.customAspectH,
  };
  const { width: exportW, height: exportH } = getPixelDimensions(
    config.arIndex,
    config.qualityIndex,
    customAspect,
  );
  const ar = getAspectRatioParts(config.arIndex, customAspect);

  const [h] = hexToHsl(baseColor);
  const accent = `hsl(${h}, 70%, 65%)`;
  const isPortrait = ar.h > ar.w;
  const isMdUp = useMediaQuery("(min-width: 768px)");

  const pillGeoArgs = [
    config.pillCount,
    colors,
    config.pillOpacity,
    config.stackDirection,
    config.stackLayerOrder,
    config.overlapRatio,
    config.pillMainRatio,
    config.pillCrossRatio,
    config.mode,
    tintColor,
    config.backgroundTint,
    config.backgroundBrightness,
    config.pillStagger,
  ] as const;

  const syncDualPreview = useCallback(() => {
    if (!config.dualMonitor) return;
    const src = config.liquidGlass ? glCanvasRef.current : canvasRef.current;
    const a = dualCanvasARef.current;
    const b = dualCanvasBRef.current;
    if (!src || !a || !b) return;
    const dpr = window.devicePixelRatio || 1;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    a.width = Math.max(1, Math.round(ra.width * dpr));
    a.height = Math.max(1, Math.round(ra.height * dpr));
    b.width = Math.max(1, Math.round(rb.width * dpr));
    b.height = Math.max(1, Math.round(rb.height * dpr));
    const ctxA = a.getContext("2d");
    const ctxB = b.getContext("2d");
    if (!ctxA || !ctxB) return;
    const W = src.width;
    const H = src.height;
    if (config.dualSplit === "left-right") {
      ctxA.drawImage(src, 0, 0, W / 2, H, 0, 0, a.width, a.height);
      ctxB.drawImage(src, W / 2, 0, W / 2, H, 0, 0, b.width, b.height);
    } else {
      ctxA.drawImage(src, 0, 0, W, H / 2, 0, 0, a.width, a.height);
      ctxB.drawImage(src, 0, H / 2, W, H / 2, 0, 0, b.width, b.height);
    }
  }, [config.dualMonitor, config.dualSplit, config.liquidGlass]);

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
      stackLayerOrder: config.stackLayerOrder,
      overlapRatio: config.overlapRatio,
      pillMainRatio: config.pillMainRatio,
      pillCrossRatio: config.pillCrossRatio,
      tintColor,
      backgroundTint: config.backgroundTint,
      backgroundBrightness: config.backgroundBrightness,
      backgroundImage: bgImageElement,
      backgroundBlur: config.backgroundBlur,
      pillStagger: config.pillStagger,
      liquidGlass: false,
    });
    requestAnimationFrame(() => syncDualPreview());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, bgImageElement, syncDualPreview]);

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
        if (bgImageElement) {
          glRendererRef.current.setBackgroundImage(bgImageElement);
        }
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
    const glassForPreview = scaleGlassParamsToCanvas(config.glass, cw, ch);
    const imageBg = bgImageElement
      ? {
          tintColor,
          tintAmount: (config.backgroundTint / 10) * 0.75,
          brightness: config.backgroundBrightness,
          blur: config.backgroundBlur,
        }
      : undefined;
    glRendererRef.current.render(geo, glassForPreview, dpr, imageBg);
    requestAnimationFrame(() => syncDualPreview());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, bgImageElement, syncDualPreview]);

  // Dispose WebGL renderer when switching off
  useEffect(() => {
    if (!config.liquidGlass && glRendererRef.current) {
      glRendererRef.current.dispose();
      glRendererRef.current = null;
    }
  }, [config.liquidGlass]);

  // Re-sync split preview after dual canvases mount or split mode changes
  useEffect(() => {
    if (!config.dualMonitor) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => syncDualPreview());
    });
    return () => cancelAnimationFrame(id);
  }, [config.dualMonitor, config.dualSplit, syncDualPreview]);

  const runExportSync = useCallback(() => {
    const bd = config.exportBitDepth;
    const bitSuffix = bd === 8 ? "" : `-${bd}bit`;

    /** Same user gesture must trigger multiple downloads — no async delay between files. */
    const triggerDownload = (filename: string, dataUrl: string) => {
      const a = document.createElement("a");
      a.download = filename;
      a.href = dataUrl;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    const exportFromFullCanvas = (full: HTMLCanvasElement) => {
      const base = config.liquidGlass ? "wallpapy-glass" : "wallpapy";
      const fullUrl = canvasToDataURLWithBitDepth(full, bd);

      if (!config.dualMonitor) {
        triggerDownload(`${base}-${exportW}x${exportH}${bitSuffix}.png`, fullUrl);
        return;
      }

      /** Combined span + per-display files (same click gesture). */
      triggerDownload(`${base}-${exportW}x${exportH}-Full${bitSuffix}.png`, fullUrl);

      if (config.dualSplit === "left-right") {
        const wL = Math.floor(exportW / 2);
        const wR = exportW - wL;
        const cL = document.createElement("canvas");
        const cR = document.createElement("canvas");
        cL.width = wL;
        cL.height = exportH;
        cR.width = wR;
        cR.height = exportH;
        const gL = cL.getContext("2d");
        const gR = cR.getContext("2d");
        if (!gL || !gR) return;
        gL.drawImage(full, 0, 0, wL, exportH, 0, 0, wL, exportH);
        gR.drawImage(full, wL, 0, wR, exportH, 0, 0, wR, exportH);
        const urlL = canvasToDataURLWithBitDepth(cL, bd);
        const urlR = canvasToDataURLWithBitDepth(cR, bd);
        triggerDownload(`${base}-${wL}x${exportH}-Left${bitSuffix}.png`, urlL);
        triggerDownload(`${base}-${wR}x${exportH}-Right${bitSuffix}.png`, urlR);
      } else {
        const hT = Math.floor(exportH / 2);
        const hB = exportH - hT;
        const cT = document.createElement("canvas");
        const cB = document.createElement("canvas");
        cT.width = exportW;
        cT.height = hT;
        cB.width = exportW;
        cB.height = hB;
        const gT = cT.getContext("2d");
        const gB = cB.getContext("2d");
        if (!gT || !gB) return;
        gT.drawImage(full, 0, 0, exportW, hT, 0, 0, exportW, hT);
        gB.drawImage(full, 0, hT, exportW, hB, 0, 0, exportW, hB);
        const urlT = canvasToDataURLWithBitDepth(cT, bd);
        const urlB = canvasToDataURLWithBitDepth(cB, bd);
        triggerDownload(`${base}-${exportW}x${hT}-Top${bitSuffix}.png`, urlT);
        triggerDownload(`${base}-${exportW}x${hB}-Bottom${bitSuffix}.png`, urlB);
      }
    };

    if (config.liquidGlass) {
      const offscreen = document.createElement("canvas");
      offscreen.width = exportW;
      offscreen.height = exportH;
      let renderer: LiquidGlassRenderer | null = null;
      try {
        const glassForExport = scaleGlassParamsToCanvas(
          config.glass,
          exportW,
          exportH,
        );
        renderer = new LiquidGlassRenderer(offscreen);
        if (bgImageElement) {
          renderer.setBackgroundImage(bgImageElement);
        }
        const geo = computePillGeometry(exportW, exportH, ...pillGeoArgs);
        const exportImageBg = bgImageElement
          ? {
              tintColor,
              tintAmount: (config.backgroundTint / 10) * 0.75,
              brightness: config.backgroundBrightness,
              blur: config.backgroundBlur,
            }
          : undefined;
        renderer.render(geo, glassForExport, 1, exportImageBg);
        exportFromFullCanvas(offscreen);
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
        stackLayerOrder: config.stackLayerOrder,
        overlapRatio: config.overlapRatio,
        pillMainRatio: config.pillMainRatio,
        pillCrossRatio: config.pillCrossRatio,
        tintColor,
        backgroundTint: config.backgroundTint,
        backgroundBrightness: config.backgroundBrightness,
        backgroundImage: bgImageElement,
        backgroundBlur: config.backgroundBlur,
        pillStagger: config.pillStagger,
        liquidGlass: false,
      });
      exportFromFullCanvas(offscreen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, exportW, exportH]);

  const download = useCallback(() => {
    if (exportLockRef.current) return;
    exportLockRef.current = true;
    flushSync(() => setExportBusy(true));
    window.setTimeout(() => {
      try {
        runExportSync();
      } finally {
        exportLockRef.current = false;
        setExportBusy(false);
      }
    }, 0);
  }, [runExportSync]);

  const applyPreset = (p: WallpaperPreset) =>
    setConfig((prev) => ({
      ...prev,
      paletteColors:
        p.paletteColors && p.paletteColors.length > 0
          ? p.paletteColors
          : [p.color],
      mode: p.mode,
      direction: p.direction,
      liquidGlass: p.liquidGlass,
      pillCount: p.pillCount,
      pillOpacity: p.pillOpacity,
      overlapRatio: p.overlapRatio,
      pillMainRatio: p.pillMainRatio,
      pillCrossRatio: p.pillCrossRatio,
      firstPillIntensity: p.firstPillIntensity,
      lastPillIntensity: p.lastPillIntensity,
      backgroundTint: p.backgroundTint,
      backgroundBrightness: p.backgroundBrightness,
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
      {exportBusy && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-[2px] pointer-events-auto"
          aria-busy="true"
          aria-live="polite"
          role="status"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-[#141414]/95 px-8 py-6 shadow-2xl">
            <ExportSpinner className="h-9 w-9 text-white/90" accent={accent} />
            <p className="text-[13px] text-white/75">Preparing export…</p>
          </div>
        </div>
      )}
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
          disabled={exportBusy}
          aria-busy={exportBusy}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-all active:scale-[0.97] sm:gap-2 sm:px-4 sm:text-[13px] touch-manipulation disabled:opacity-75 disabled:pointer-events-none"
          style={{ background: accent, color: "#0d0d0d" }}
        >
          {exportBusy ? (
            <ExportSpinner className="h-[13px] w-[13px]" accent="#0d0d0d" />
          ) : (
            <DownloadIcon />
          )}
          <span className="hidden sm:inline">
            Export {exportW} × {exportH}
          </span>
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
              along the pill stack (background tint uses the first stop). Drag
              the grip to reorder; the glowing bar shows the gap where the stop
              will land.
            </p>
            <div className="flex flex-col gap-2 overflow-visible">
              {config.paletteColors.map((c, i) => {
                const canReorder = config.paletteColors.length > 1;
                const showInsertGap =
                  canReorder &&
                  paletteDragFrom !== null &&
                  paletteDropTarget === i;
                return (
                  <div
                    key={i}
                    className="relative"
                    onDragOver={
                      canReorder
                        ? (e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            setPaletteDropTarget(i);
                          }
                        : undefined
                    }
                    onDrop={
                      canReorder
                        ? (e) => {
                            e.preventDefault();
                            const raw =
                              e.dataTransfer.getData(
                                "application/x-palette-index",
                              ) || e.dataTransfer.getData("text/plain");
                            const from = Number(raw);
                            if (Number.isNaN(from)) return;
                            reorderPaletteStops(from, i);
                            setPaletteDragFrom(null);
                            setPaletteDropTarget(null);
                          }
                        : undefined
                    }
                  >
                    {showInsertGap && (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute left-0 right-0 z-10 h-[3px] rounded-full"
                        style={{
                          top: i === 0 ? -6 : -7,
                          background: accent,
                          boxShadow: `0 0 10px ${accent}99`,
                        }}
                      />
                    )}
                    <div
                      className={`flex items-center gap-1.5 rounded-lg py-0.5 pl-0.5 pr-0.5 transition-opacity ${
                        canReorder && paletteDragFrom === i ? "opacity-45" : ""
                      }`}
                    >
                      <span
                        className={`flex h-9 w-6 shrink-0 items-center justify-center rounded-md ${
                          canReorder
                            ? "cursor-grab touch-none text-white/30 hover:text-white/50 active:cursor-grabbing"
                            : "cursor-not-allowed text-white/15 opacity-40"
                        }`}
                        draggable={canReorder}
                        onDragStart={
                          canReorder
                            ? (e) => {
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData(
                                  "application/x-palette-index",
                                  String(i),
                                );
                                e.dataTransfer.setData("text/plain", String(i));
                                setPaletteDragFrom(i);
                              }
                            : undefined
                        }
                        onDragEnd={
                          canReorder
                            ? () => {
                                setPaletteDragFrom(null);
                                setPaletteDropTarget(null);
                              }
                            : undefined
                        }
                        aria-disabled={!canReorder}
                        aria-label={
                          canReorder
                            ? `Drag to reorder, position ${i + 1}`
                            : "Reorder (add another color stop to enable)"
                        }
                      >
                        <PaletteDragHandleIcon />
                      </span>
                      <span className="w-4 shrink-0 text-right text-[10px] font-mono text-white/30">
                        {i + 1}
                      </span>
                      <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-white/10">
                        <input
                          type="color"
                          value={c}
                          onChange={(e) => setPaletteColor(i, e.target.value)}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                        <div
                          className="h-full w-full"
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
                        className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.06] px-2.5 py-1.5 font-mono text-[12px] uppercase tracking-wider text-white/80 focus:border-white/20 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={!canReorder}
                        onClick={() => removePaletteStop(i)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-[16px] leading-none text-white/40 hover:border-white/15 hover:text-white/70 disabled:pointer-events-none disabled:opacity-30 disabled:hover:border-white/[0.08] disabled:hover:text-white/40"
                        aria-label={
                          canReorder
                            ? `Remove color ${i + 1}`
                            : "Remove (add another color stop to enable)"
                        }
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
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
            {/* Background image upload */}
            <div className="mt-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-wide text-white/35">
                Background image
              </p>
              {bgImageElement ? (
                <div className="flex items-center gap-2">
                  <div
                    className="h-10 w-16 shrink-0 rounded-md overflow-hidden border border-white/[0.08]"
                    style={{
                      backgroundImage: `url(${config.backgroundImage})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <span className="flex-1 text-[11px] text-white/40 truncate">
                    {bgImageElement.naturalWidth}×{bgImageElement.naturalHeight}
                  </span>
                  <button
                    type="button"
                    onClick={() => set("backgroundImage", null)}
                    className="text-[11px] text-white/40 hover:text-white/70 border border-white/[0.08] hover:border-white/15 rounded-md px-2 py-1 transition-colors shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center w-full py-2 rounded-lg text-[12px] border border-white/[0.08] border-dashed text-white/45 hover:text-white/70 hover:border-white/15 cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleBgImageUpload}
                  />
                  Upload image
                </label>
              )}
            </div>

            {/* Tint color selector — pick which palette color tints the background */}
            {config.paletteColors.length > 1 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] uppercase tracking-wide text-white/35">
                  Tint color
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {config.paletteColors.map((c, i) => {
                    const selected =
                      i ===
                      Math.min(
                        config.backgroundTintColorIndex,
                        config.paletteColors.length - 1,
                      );
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => set("backgroundTintColorIndex", i)}
                        className="h-6 w-6 rounded-full transition-all"
                        style={{
                          background: c,
                          outline: selected
                            ? `2px solid ${c}`
                            : "2px solid transparent",
                          outlineOffset: selected ? "2px" : "0px",
                          boxShadow: selected
                            ? "0 0 0 1px rgba(255,255,255,0.3)"
                            : "none",
                        }}
                        aria-label={`Use color ${i + 1} for tint`}
                        aria-pressed={selected}
                      />
                    );
                  })}
                </div>
              </div>
            )}

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
            <div className="mt-2">
              <Slider
                label="Background brightness"
                value={config.backgroundBrightness}
                min={-1}
                max={1}
                step={0.01}
                display={`${config.backgroundBrightness > 0 ? "+" : ""}${Math.round(config.backgroundBrightness * 100)}%`}
                onChange={(v) => set("backgroundBrightness", v)}
                accent={accent}
              />
            </div>
            {bgImageElement && (
              <div className="mt-2">
                <Slider
                  label="Background blur"
                  value={config.backgroundBlur}
                  min={0}
                  max={100}
                  step={1}
                  display={`${config.backgroundBlur}px`}
                  onChange={(v) => set("backgroundBlur", v)}
                  accent={accent}
                />
              </div>
            )}
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
            <div className="mt-2">
              <p className="mb-1.5 text-[10px] uppercase tracking-wide text-white/35">
                Overlap depth
              </p>
              <Seg
                options={
                  (config.stackDirection === "horizontal"
                    ? [
                        ["stack-start", "Left in front"],
                        ["stack-end", "Right in front"],
                      ]
                    : [
                        ["stack-start", "Top in front"],
                        ["stack-end", "Bottom in front"],
                      ]) as readonly [StackLayerOrder, string][]
                }
                value={config.stackLayerOrder}
                onChange={(v) =>
                  set("stackLayerOrder", v as StackLayerOrder)
                }
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
                  display={`${config.glass.refThickness.toFixed(0)}%`}
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
              <div className="grid min-w-0 grid-cols-3 gap-1.5">
                {ASPECT_RATIOS.map((a, i) => (
                  <button
                    type="button"
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
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      arIndex: ASPECT_CUSTOM_INDEX,
                      stackDirection: stackDirectionForAspectRatio(
                        prev.customAspectW,
                        prev.customAspectH,
                      ),
                    }))
                  }
                  className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg border transition-colors ${config.arIndex === ASPECT_CUSTOM_INDEX ? "border-white/20 bg-white/[0.08] text-white" : "border-white/[0.06] text-white/30 hover:text-white/50"}`}
                >
                  <ARThumb
                    w={config.customAspectW}
                    h={config.customAspectH}
                    active={config.arIndex === ASPECT_CUSTOM_INDEX}
                    accent={accent}
                  />
                  <span className="text-[10px] font-mono leading-none">
                    Custom
                  </span>
                </button>
              </div>
              {config.arIndex === ASPECT_CUSTOM_INDEX && (
                <>
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
                  <span className="text-[11px] text-white/35 shrink-0">W : H</span>
                  <input
                    type="number"
                    min={0.01}
                    max={ASPECT_RATIO_PART_MAX}
                    step="any"
                    aria-label="Custom aspect width"
                    value={config.customAspectW}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      if (!Number.isFinite(n)) return;
                      setConfig((prev) => {
                        const w = clampAspectRatioPart(n);
                        const { w: nw, h: nh } = normalizeCustomAspectPair(
                          w,
                          prev.customAspectH,
                        );
                        return {
                          ...prev,
                          customAspectW: nw,
                          customAspectH: nh,
                          stackDirection:
                            stackDirectionForAspectRatio(nw, nh),
                        };
                      });
                    }}
                    className="min-w-[4.5rem] flex-1 rounded-md border border-white/[0.1] bg-black/30 px-2 py-1.5 text-[12px] font-mono text-white/90 focus:border-white/25 focus:outline-none"
                  />
                  <span className="text-white/25 font-mono">:</span>
                  <input
                    type="number"
                    min={0.01}
                    max={ASPECT_RATIO_PART_MAX}
                    step="any"
                    aria-label="Custom aspect height"
                    value={config.customAspectH}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      if (!Number.isFinite(n)) return;
                      setConfig((prev) => {
                        const h = clampAspectRatioPart(n);
                        const { w: nw, h: nh } = normalizeCustomAspectPair(
                          prev.customAspectW,
                          h,
                        );
                        return {
                          ...prev,
                          customAspectW: nw,
                          customAspectH: nh,
                          stackDirection:
                            stackDirectionForAspectRatio(nw, nh),
                        };
                      });
                    }}
                    className="min-w-[4.5rem] flex-1 rounded-md border border-white/[0.1] bg-black/30 px-2 py-1.5 text-[12px] font-mono text-white/90 focus:border-white/25 focus:outline-none"
                  />
                </div>
                <p className="mt-2 text-[11px] text-white/25 leading-snug">
                  Longer side at most {ASPECT_MAX_SIDE_RATIO}× the shorter (each
                  value 0.01–{ASPECT_RATIO_PART_MAX}).
                </p>
                </>
              )}
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

          <Section label="Dual monitor">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] text-white/45">Split preview & export</span>
              <button
                type="button"
                onClick={() =>
                  setConfig((prev) => {
                    if (!prev.dualMonitor) {
                      const ar32x9 = ASPECT_RATIOS.findIndex(
                        (a) => a.w === 32 && a.h === 9,
                      );
                      const q5k = QUALITY_LEVELS.findIndex(
                        (q) => q.label === "5K",
                      );
                      const { w, h } =
                        ar32x9 >= 0
                          ? ASPECT_RATIOS[ar32x9]
                          : { w: 32, h: 9 };
                      return {
                        ...prev,
                        dualMonitor: true,
                        dualSplit: "left-right",
                        arIndex: ar32x9 >= 0 ? ar32x9 : 2,
                        qualityIndex: q5k >= 0 ? q5k : 3,
                        stackDirection: stackDirectionForAspectRatio(w, h),
                      };
                    }
                    return { ...prev, dualMonitor: false };
                  })
                }
                className="relative w-9 h-5 rounded-full transition-all duration-150"
                style={{
                  background: config.dualMonitor
                    ? accent
                    : "rgba(255,255,255,0.1)",
                }}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-150"
                  style={{
                    left: config.dualMonitor
                      ? "calc(100% - 18px)"
                      : "2px",
                    background: config.dualMonitor
                      ? "#0d0d0d"
                      : "rgba(255,255,255,0.4)",
                  }}
                />
              </button>
            </div>
            {config.dualMonitor && (
              <Seg
                options={
                  [
                    ["left-right", "Left / Right"],
                    ["top-bottom", "Top / Bottom"],
                  ] as const
                }
                value={config.dualSplit}
                onChange={(v) =>
                  set("dualSplit", v as "left-right" | "top-bottom")
                }
              />
            )}
            <p className="text-[11px] text-white/20 mt-2">
              {config.dualMonitor
                ? config.dualSplit === "left-right"
                  ? "Preview shows two halves side by side. Export downloads Full (combined), Left, and Right PNGs."
                  : "Preview shows two halves stacked. Export downloads Full (combined), Top, and Bottom PNGs."
                : "Off: single full wallpaper. On: combined span plus one file per display."}
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
              className="relative box-border w-full max-w-full overflow-hidden rounded-xl border-2 border-white/[0.24] shadow-2xl shadow-black/50"
              style={previewFrameStyle}
            >
              {/* Canvas2D — full frame; hidden visually when dual (still rendered for split source) */}
              <canvas
                ref={canvasRef}
                className={
                  config.dualMonitor
                    ? "absolute inset-0 block h-full w-full opacity-0 pointer-events-none"
                    : "block h-full w-full"
                }
                style={{ display: config.liquidGlass ? "none" : "block" }}
              />
              {/* WebGL */}
              <canvas
                ref={glCanvasRef}
                className={
                  config.dualMonitor
                    ? "absolute inset-0 block h-full w-full opacity-0 pointer-events-none"
                    : "block h-full w-full"
                }
                style={{ display: config.liquidGlass ? "block" : "none" }}
              />
              {config.dualMonitor && (
                <div
                  className={`absolute inset-0 flex min-h-0 min-w-0 bg-[#0a0a0a] p-2 sm:p-2.5 ${
                    config.dualSplit === "left-right"
                      ? "flex-row gap-2 sm:gap-3"
                      : "flex-col gap-2 sm:gap-3"
                  }`}
                >
                  <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg sm:rounded-xl">
                    <canvas
                      ref={dualCanvasARef}
                      className="absolute inset-0 block h-full w-full"
                    />
                  </div>
                  <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg sm:rounded-xl">
                    <canvas
                      ref={dualCanvasBRef}
                      className="absolute inset-0 block h-full w-full"
                    />
                  </div>
                </div>
              )}
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
              {config.dualMonitor && (
                <>
                  <span className="text-white/10">·</span>
                  <span className="text-[11px] text-white/35">
                    Dual{" "}
                    {config.dualSplit === "left-right"
                      ? "Left / Right"
                      : "Top / Bottom"}
                  </span>
                </>
              )}
            </div>
            <section
              className="mt-4 w-full max-w-md shrink-0 border-t border-white/[0.05] pt-4 text-center"
              aria-label="About this app"
            >
              <p className="font-mono text-[10px] tabular-nums tracking-wide text-white/28">
                Wallpapy v{packageJson.version}
              </p>
              <p className="mx-auto mt-2 max-w-[20rem] text-[12px] leading-snug text-white/38">
                <span className="text-white/58">Ahmed Kamal</span>
                <span className="text-white/22"> — </span>
                Follow and contact{" "}
                <span className="font-mono text-[11px] text-white/45">
                  @jusstkamal
                </span>
              </p>
              <nav
                className="mt-3 flex flex-wrap items-center justify-center gap-y-1 text-[11px] text-white/32"
                aria-label="Social profiles"
              >
                {SOCIAL_LINKS.map(({ label, href }, i) => (
                  <span key={href} className="inline-flex items-center">
                    {i > 0 ? (
                      <span
                        className="mx-2 select-none text-[10px] text-white/12"
                        aria-hidden
                      >
                        ·
                      </span>
                    ) : null}
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded px-0.5 transition-colors duration-200 hover:text-white/55 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-white/25"
                    >
                      {label}
                    </a>
                  </span>
                ))}
              </nav>
            </section>
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
    th = Math.round((maxW * h) / w);
    if (th > maxH) {
      th = maxH;
      tw = Math.max(Math.round((maxH * w) / h), 4);
    }
  } else {
    th = maxH;
    tw = Math.round((maxH * w) / h);
    if (tw > maxW) {
      tw = maxW;
      th = Math.max(Math.round((maxW * h) / w), 4);
    }
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
function PaletteDragHandleIcon() {
  return (
    <svg
      width="10"
      height="14"
      viewBox="0 0 10 14"
      fill="none"
      className="pointer-events-none"
      aria-hidden
    >
      {[0, 1, 2].map((row) => (
        <g key={row} transform={`translate(0 ${row * 5})`}>
          <circle cx="2.5" cy="2" r="1.15" fill="currentColor" />
          <circle cx="7.5" cy="2" r="1.15" fill="currentColor" />
        </g>
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

function ExportSpinner({
  className,
  accent,
}: {
  className?: string;
  accent: string;
}) {
  return (
    <svg
      className={`shrink-0 animate-spin ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.2"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
