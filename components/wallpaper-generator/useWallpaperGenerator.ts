"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  generatePillColorsFromPalette,
  hexToHsl,
  mixHexHsl,
} from "@/lib/colorUtils";
import type { WallpaperPreset } from "@/lib/wallpaperPresets";
import {
  renderWallpaper,
  getPixelDimensions,
  getAspectRatioParts,
  clampAspectRatioPart,
  normalizeCustomAspectPair,
} from "@/lib/pillRenderer";
import {
  LiquidGlassRenderer,
  type GlassParams,
  computePillGeometry,
  scaleGlassParamsToCanvas,
} from "@/lib/liquidGlassRenderer";
import { getDefaultBackgroundCrop } from "@/lib/backgroundCrop";
import type { BackgroundImageCrop } from "@/lib/backgroundCrop";
import { canvasToDataURLWithBitDepth } from "@/lib/exportBitDepth";
import { DEFAULT, PREVIEW_FRAME_BORDER_GAP_X, PREVIEW_FRAME_BORDER_GAP_Y } from "./constants";
import { fitAspectInsideBox } from "./geometry";
import { useMediaQuery } from "./useMediaQuery";
import type { Config } from "./types";

export function useWallpaperGenerator() {
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
  const previewSlotRef = useRef<HTMLDivElement>(null);
  const [previewFramePx, setPreviewFramePx] = useState({ w: 0, h: 0 });

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
      const last =
        prev.paletteColors[prev.paletteColors.length - 1] ?? "#888888";
      return {
        ...prev,
        paletteColors: [
          ...prev.paletteColors,
          mixHexHsl(last, "#ffffff", 0.12),
        ],
      };
    });

  const removePaletteStop = (index: number) => {
    setConfig((prev) => {
      if (prev.paletteColors.length <= 1) return prev;
      return {
        ...prev,
        paletteColors: prev.paletteColors.filter((_, i) => i !== index),
      };
    });
  };

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

  const [bgImageElement, setBgImageElement] = useState<HTMLImageElement | null>(
    null,
  );

  useEffect(() => {
    if (!config.backgroundImage) {
      setBgImageElement(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setBgImageElement(img);
    };
    img.src = config.backgroundImage;
  }, [config.backgroundImage]);

  /** WebGL: push image + crop whenever the GL renderer or source changes. */
  useEffect(() => {
    if (!config.liquidGlass) return;
    const r = glRendererRef.current;
    if (!r) return;
    if (bgImageElement) {
      r.setBackgroundImage(bgImageElement, config.backgroundImageCrop);
    } else {
      r.setBackgroundImage(null, null);
    }
  }, [
    config.liquidGlass,
    bgImageElement,
    config.backgroundImageCrop,
  ]);

  const applyBackgroundWithCrop = useCallback(
    (dataUrl: string, crop: BackgroundImageCrop, fileName?: string) => {
      setConfig((prev) => ({
        ...prev,
        backgroundImage: dataUrl,
        backgroundImageCrop: crop,
        ...(fileName !== undefined
          ? { backgroundImageFileName: fileName }
          : {}),
      }));
    },
    [],
  );

  const clearBackgroundImage = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      backgroundImage: null,
      backgroundImageCrop: null,
      backgroundImageFileName: null,
    }));
  }, []);

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
  const dualHalfW = Math.floor(exportW / 2);
  const dualHalfH = Math.floor(exportH / 2);
  const ar = getAspectRatioParts(config.arIndex, customAspect);

  const arKey = `${ar.w}:${ar.h}`;
  const arKeyRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!config.backgroundImage || !bgImageElement) {
      arKeyRef.current = null;
      return;
    }
    if (arKeyRef.current === null) {
      arKeyRef.current = arKey;
      return;
    }
    if (arKeyRef.current !== arKey) {
      arKeyRef.current = arKey;
      const c = getDefaultBackgroundCrop(
        bgImageElement.naturalWidth,
        bgImageElement.naturalHeight,
        ar.w,
        ar.h,
      );
      setConfig((prev) => ({ ...prev, backgroundImageCrop: c }));
    }
  }, [arKey, ar.w, ar.h, config.backgroundImage, bgImageElement]);

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

  // Preview frame: explicit pixel size from slot so flex/CSS never distorts aspect (canvas uses clientWidth/Height).
  useLayoutEffect(() => {
    const el = previewSlotRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const availW = rect.width - PREVIEW_FRAME_BORDER_GAP_X;
      const availH = rect.height - PREVIEW_FRAME_BORDER_GAP_Y;
      if (availW < 8 || availH < 8) return;
      const inner = fitAspectInsideBox(availW, availH, ar.w, ar.h);
      if (inner.w < 1 || inner.h < 1) return;
      const w = inner.w + PREVIEW_FRAME_BORDER_GAP_X;
      const h = inner.h + PREVIEW_FRAME_BORDER_GAP_Y;
      setPreviewFramePx((prev) =>
        prev.w === w && prev.h === h ? prev : { w, h },
      );
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [ar.w, ar.h]);

  // ── Canvas2D preview (non-glass) ──────────────────────────────
  useEffect(() => {
    if (config.liquidGlass) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = canvas.clientWidth,
      ch = canvas.clientHeight;
    if (cw < 2 || ch < 2) return;
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
      backgroundImageCrop: config.backgroundImageCrop,
      backgroundBlur: config.backgroundBlur,
      pillStagger: config.pillStagger,
      liquidGlass: false,
    });
    requestAnimationFrame(() => syncDualPreview());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config,
    bgImageElement,
    syncDualPreview,
    previewFramePx.w,
    previewFramePx.h,
  ]);

  // ── WebGL liquid glass preview ────────────────────────────────
  useEffect(() => {
    if (!config.liquidGlass) return;
    const canvas = glCanvasRef.current;
    if (!canvas) return;
    if (canvas.clientWidth < 2 || canvas.clientHeight < 2) return;
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
          glRendererRef.current.setBackgroundImage(
            bgImageElement,
            config.backgroundImageCrop,
          );
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
  }, [
    config,
    bgImageElement,
    syncDualPreview,
    previewFramePx.w,
    previewFramePx.h,
  ]);

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
        triggerDownload(
          `${base}-${exportW}x${exportH}${bitSuffix}.png`,
          fullUrl,
        );
        return;
      }

      /** Combined span + per-display files (same click gesture). */
      triggerDownload(
        `${base}-${exportW}x${exportH}-Full${bitSuffix}.png`,
        fullUrl,
      );

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
        triggerDownload(
          `${base}-${exportW}x${hB}-Bottom${bitSuffix}.png`,
          urlB,
        );
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
          renderer.setBackgroundImage(
            bgImageElement,
            config.backgroundImageCrop,
          );
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
        backgroundImageCrop: config.backgroundImageCrop,
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
  return {
    config,
    set,
    setConfig,
    setGlass,
    selectedPresetIndex,
    setSelectedPresetIndex,
    exportBusy,
    exportLockRef,
    canvasRef,
    glCanvasRef,
    dualCanvasARef,
    dualCanvasBRef,
    glRendererRef,
    previewSlotRef,
    previewFramePx,
    setPaletteColor,
    addPaletteStop,
    removePaletteStop,
    reorderPaletteStops,
    paletteDragFrom,
    setPaletteDragFrom,
    paletteDropTarget,
    setPaletteDropTarget,
    bgImageElement,
    applyBackgroundWithCrop,
    clearBackgroundImage,
    colors,
    tintColor,
    customAspect,
    exportW,
    exportH,
    dualHalfW,
    dualHalfH,
    ar,
    accent,
    isPortrait,
    isMdUp,
    pillGeoArgs,
    syncDualPreview,
    runExportSync,
    download,
    applyPreset,
  };
}

export type WallpapyModel = ReturnType<typeof useWallpaperGenerator>;
