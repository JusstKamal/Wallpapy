"use client";

import { useState } from "react";
import type { BackgroundImageCrop } from "@/lib/backgroundCrop";
import { generatePillColorsFromPalette } from "@/lib/colorUtils";
import type { ExportBitDepth } from "@/lib/exportBitDepth";
import { GLASS_DEFAULTS } from "@/lib/liquidGlassRenderer";
import { PRESETS } from "@/lib/wallpaperPresets";
import {
  ASPECT_CUSTOM_INDEX,
  ASPECT_MAX_SIDE_RATIO,
  ASPECT_RATIOS,
  ASPECT_RATIO_PART_MAX,
  clampAspectRatioPart,
  normalizeCustomAspectPair,
  QUALITY_LEVELS,
  type StackLayerOrder,
} from "@/lib/pillRenderer";
import { BackgroundImageCropModal } from "./BackgroundImageCropModal";
import { stackDirectionForAspectRatio } from "./geometry";
import type { WallpapyModel } from "./useWallpaperGenerator";
import { AspectRatioThumb } from "./ui/AspectRatioThumb";
import { CloseSmIcon, PaletteDragHandleIcon } from "./ui/icons";
import { LabeledSlider } from "./ui/LabeledSlider";
import { Section } from "./ui/Section";
import { HStackIcon, VStackIcon } from "./ui/StackDirectionIcons";
import { SegmentedControl } from "./ui/SegmentedControl";
import { ToggleSwitch, ToggleSwitchSm } from "./ui/ToggleSwitch";
import type { Config } from "./types";

export function ControlSidebar({ w }: { w: WallpapyModel }) {
  const {
    config,
    set,
    setConfig,
    setGlass,
    selectedPresetIndex,
    setSelectedPresetIndex,
    setPaletteColor,
    addPaletteStop,
    removePaletteStop,
    reorderPaletteStops,
    paletteDragFrom,
    setPaletteDropTarget,
    paletteDropTarget,
    setPaletteDragFrom,
    applyPreset,
    colors,
    applyBackgroundWithCrop,
    clearBackgroundImage,
    bgImageElement,
    ar,
    accent,
    exportW,
    exportH,
    dualHalfW,
    dualHalfH,
  } = w;

  const [bgCropOpen, setBgCropOpen] = useState<{
    dataUrl: string;
    initial: BackgroundImageCrop | null;
    fileName?: string;
  } | null>(null);

  const onBackgroundFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const pickedName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      setBgCropOpen({
        dataUrl: reader.result as string,
        initial: null,
        fileName: pickedName,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
        <aside className="order-2 flex w-full max-h-[min(44vh,400px)] flex-none flex-col overflow-y-auto overscroll-contain border-t border-wp bg-wp-rail pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-h-[min(50vh,520px)] md:order-1 md:max-h-none md:w-80 md:shrink-0 md:flex-none md:border-t-0 md:border-r md:border-wp md:pb-0">
          <Section label="Presets" accent={accent} collapsible defaultOpen>
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
                      ? "border-wp-3 bg-wp-fill-2"
                      : "border-wp-2 hover:border-wp-3"
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
                    ).map((c, i) => (
                      <div
                        key={i}
                        className="flex-1"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-[11px] transition-colors ${
                      selectedPresetIndex === i
                        ? "text-wp-1"
                        : "text-wp-3 group-hover:text-wp-1"
                    }`}
                  >
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section label="Color" accent={accent} collapsible defaultOpen>
            <p className="text-[11px] text-wp-3 mb-2 leading-snug">
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
                            ? "cursor-grab touch-none text-wp-4 hover:text-wp-2 active:cursor-grabbing"
                            : "cursor-not-allowed text-wp-1/15 opacity-40"
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
                      <span className="w-4 shrink-0 text-right text-[10px] font-mono text-wp-4">
                        {i + 1}
                      </span>
                      <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-wp-2">
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
                        className="min-w-0 flex-1 rounded-lg border border-wp-2 bg-wp-fill px-2.5 py-1.5 font-mono text-[12px] uppercase tracking-wider text-wp-1 focus:border-wp-3 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={!canReorder}
                        onClick={() => removePaletteStop(i)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-wp-2 text-wp-3 hover:border-wp-2 hover:text-wp-1 disabled:pointer-events-none disabled:opacity-30 disabled:hover:border-wp-2 disabled:hover:text-wp-3"
                        aria-label={
                          canReorder
                            ? `Remove color ${i + 1}`
                            : "Remove (add another color stop to enable)"
                        }
                      >
                        <CloseSmIcon className="shrink-0" />
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
              className="mt-2 w-full py-2 rounded-lg text-[12px] border border-wp-2 text-wp-2 hover:text-wp-1 hover:border-wp-2 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              Add color stop
            </button>
            <div
              className="flex mt-3 rounded-lg overflow-hidden border border-wp-2"
              style={{ height: 24, opacity: config.pillOpacity }}
            >
              {colors.map((c, i) => (
                <div key={i} className="flex-1" style={{ background: c }} />
              ))}
            </div>

            {/* Tint color selector — pick which palette color tints the background */}
            {config.paletteColors.length > 1 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] uppercase tracking-wide text-wp-3">
                  Tint color
                </p>
                <div className="flex flex-wrap gap-1.5 py-0.5">
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
                        className="h-6 w-6 shrink-0 rounded-full transition-all"
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
              <LabeledSlider
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
              <LabeledSlider
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
                <LabeledSlider
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

            <div className="mt-4 border-t border-wp pt-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-wp-4">
                Background image
              </p>
              {bgImageElement && config.backgroundImage ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-10 w-16 shrink-0 overflow-hidden rounded-md border border-wp-2"
                      style={{
                        backgroundImage: `url(${config.backgroundImage})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    />
                    <span
                      className="flex-1 truncate text-[11px] text-wp-2"
                      title={config.backgroundImageFileName ?? undefined}
                    >
                      {config.backgroundImageFileName?.trim() || "Image"}
                    </span>
                    <button
                      type="button"
                      onClick={clearBackgroundImage}
                      className="shrink-0 rounded-md border border-wp-2 px-2 py-1 text-[11px] text-wp-3 transition-colors hover:text-wp-1"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setBgCropOpen({
                          dataUrl: config.backgroundImage!,
                          initial: config.backgroundImageCrop,
                        })
                      }
                      className="flex-1 rounded-lg border border-wp-2 py-2 text-center text-[12px] text-wp-2 transition-colors hover:border-wp-3 hover:text-wp-1"
                    >
                      Adjust crop
                    </button>
                    <label className="flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-wp-2 border-dashed py-2 text-center text-[12px] text-wp-2 transition-colors hover:border-wp-3 hover:text-wp-1 min-w-0">
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={onBackgroundFile}
                      />
                      New image
                    </label>
                  </div>
                </div>
              ) : (
                <label className="flex w-full cursor-pointer items-center justify-center rounded-lg border border-wp-2 border-dashed py-2.5 text-[12px] text-wp-2 transition-colors hover:border-wp-3 hover:text-wp-1">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={onBackgroundFile}
                  />
                  Choose image
                </label>
              )}
              <p className="mt-2 text-[10px] leading-relaxed text-wp-4">
                Cropping matches the “Aspect ratio” section below. Change that
                first if you need a different frame, then re-crop here.
              </p>
            </div>
          </Section>

          <Section label="Mode" accent={accent} collapsible defaultOpen>
            <SegmentedControl
              options={
                [
                  ["dark", "Dark"],
                  ["light", "Light"],
                ] as const
              }
              value={config.mode}
              onChange={(v) => set("mode", v as "dark" | "light")}
              accent={accent}
            />
            <div className="mt-2">
              <SegmentedControl
                options={
                  [
                    ["dark-to-light", "Dark → Light"],
                    ["light-to-dark", "Light → Dark"],
                  ] as const
                }
                value={config.direction}
                onChange={(v) => set("direction", v as Config["direction"])}
                accent={accent}
              />
            </div>
            <div className="mt-2">
              <p className="mb-1.5 text-[10px] uppercase tracking-wide text-wp-3">
                Overlap depth
              </p>
              <SegmentedControl
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
                onChange={(v) => set("stackLayerOrder", v as StackLayerOrder)}
                accent={accent}
              />
            </div>
          </Section>

          <Section
            label="Stack Direction"
            accent={accent}
            collapsible
            defaultOpen
          >
            <div className="flex gap-2">
              {(["horizontal", "vertical"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => set("stackDirection", d)}
                  className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-lg border transition-colors ${config.stackDirection === d ? "border-wp-3 bg-wp-fill-2 text-wp-1" : "border-wp text-wp-4 hover:text-wp-2"}`}
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

          <Section label="Pills" accent={accent} collapsible defaultOpen>
            <LabeledSlider
              label="Count"
              value={config.pillCount}
              min={3}
              max={16}
              step={1}
              display={String(config.pillCount)}
              onChange={(v) => set("pillCount", v)}
              accent={accent}
            />
            <LabeledSlider
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
            <LabeledSlider
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
            <LabeledSlider
              label="Thickness"
              value={config.pillCrossRatio}
              min={0.06}
              max={0.5}
              step={0.01}
              display={`${Math.round(config.pillCrossRatio * 100)}%`}
              onChange={(v) => set("pillCrossRatio", v)}
              accent={accent}
            />
            <LabeledSlider
              label="Opacity"
              value={config.pillOpacity}
              min={0}
              max={1}
              step={0.01}
              display={`${Math.round(config.pillOpacity * 100)}%`}
              onChange={(v) => set("pillOpacity", v)}
              accent={accent}
            />
            <LabeledSlider
              label="First side → center"
              value={config.firstPillIntensity}
              min={0.25}
              max={1}
              step={0.01}
              display={`${Math.round(config.firstPillIntensity * 100)}%`}
              onChange={(v) => set("firstPillIntensity", v)}
              accent={accent}
            />
            <LabeledSlider
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

          <Section label="Liquid Glass" accent={accent} collapsible defaultOpen>
            <div className="flex items-start justify-between gap-3 mb-1">
              <p className="text-[11px] text-wp-4 leading-snug">
                WebGL renderer with Snell refraction and LCH glare.
              </p>
              <ToggleSwitch
                checked={config.liquidGlass}
                accent={accent}
                aria-label="Toggle liquid glass"
                onChange={(next) => {
                  setConfig((prev) => ({
                    ...prev,
                    liquidGlass: next,
                    ...(next ? { pillOpacity: 0.5 } : {}),
                  }));
                }}
              />
            </div>
            <div
              className={`mt-2 ${config.liquidGlass ? "" : "pointer-events-none select-none opacity-45"}`}
              aria-disabled={!config.liquidGlass}
            >
              <LabeledSlider
                label="Thickness"
                value={config.glass.refThickness}
                min={1}
                max={80}
                step={0.5}
                display={`${config.glass.refThickness.toFixed(0)}%`}
                onChange={(v) => setGlass("refThickness", v)}
                accent={accent}
              />
              <LabeledSlider
                label="Factor"
                value={config.glass.refFactor}
                min={1}
                max={4}
                step={0.01}
                display={config.glass.refFactor.toFixed(2)}
                onChange={(v) => setGlass("refFactor", v)}
                accent={accent}
              />
              <LabeledSlider
                label="Dispersion"
                value={config.glass.refDispersion}
                min={0}
                max={50}
                step={0.5}
                display={config.glass.refDispersion.toFixed(0)}
                onChange={(v) => setGlass("refDispersion", v)}
                accent={accent}
              />
            </div>

            <div className={config.liquidGlass ? "" : "pointer-events-none select-none opacity-45"}>
              <div className="mt-3 border-t border-wp pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-wp-3">
                  Fresnel
                </p>
                <LabeledSlider
                  label="Range"
                  value={config.glass.refFresnelRange}
                  min={0}
                  max={100}
                  step={0.5}
                  display={config.glass.refFresnelRange.toFixed(0)}
                  onChange={(v) => setGlass("refFresnelRange", v)}
                  accent={accent}
                />
                <LabeledSlider
                  label="Hardness"
                  value={config.glass.refFresnelHardness}
                  min={0}
                  max={100}
                  step={0.5}
                  display={config.glass.refFresnelHardness.toFixed(0)}
                  onChange={(v) => setGlass("refFresnelHardness", v)}
                  accent={accent}
                />
                <LabeledSlider
                  label="Factor"
                  value={config.glass.refFresnelFactor}
                  min={0}
                  max={100}
                  step={0.5}
                  display={config.glass.refFresnelFactor.toFixed(0)}
                  onChange={(v) => setGlass("refFresnelFactor", v)}
                  accent={accent}
                />
              </div>
              <div className="mt-3 border-t border-wp pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-wp-3">
                  Glare
                </p>
                <LabeledSlider
                  label="Range"
                  value={config.glass.glareRange}
                  min={0}
                  max={100}
                  step={0.5}
                  display={config.glass.glareRange.toFixed(0)}
                  onChange={(v) => setGlass("glareRange", v)}
                  accent={accent}
                />
                <LabeledSlider
                  label="Hardness"
                  value={config.glass.glareHardness}
                  min={0}
                  max={100}
                  step={0.5}
                  display={config.glass.glareHardness.toFixed(0)}
                  onChange={(v) => setGlass("glareHardness", v)}
                  accent={accent}
                />
                <LabeledSlider
                  label="Factor"
                  value={config.glass.glareFactor}
                  min={0}
                  max={120}
                  step={0.5}
                  display={config.glass.glareFactor.toFixed(0)}
                  onChange={(v) => setGlass("glareFactor", v)}
                  accent={accent}
                />
                <LabeledSlider
                  label="Convergence"
                  value={config.glass.glareConvergence}
                  min={0}
                  max={100}
                  step={0.5}
                  display={config.glass.glareConvergence.toFixed(0)}
                  onChange={(v) => setGlass("glareConvergence", v)}
                  accent={accent}
                />
                <LabeledSlider
                  label="Opposite"
                  value={config.glass.glareOppositeFactor}
                  min={0}
                  max={100}
                  step={0.5}
                  display={config.glass.glareOppositeFactor.toFixed(0)}
                  onChange={(v) => setGlass("glareOppositeFactor", v)}
                  accent={accent}
                />
                <LabeledSlider
                  label="Angle"
                  value={config.glass.glareAngle}
                  min={-180}
                  max={180}
                  step={1}
                  display={`${config.glass.glareAngle.toFixed(0)}°`}
                  onChange={(v) => setGlass("glareAngle", v)}
                  accent={accent}
                />
              </div>
              <div className="mt-3 border-t border-wp pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-wp-3">
                  Shadow
                </p>
                <LabeledSlider
                  label="Expand"
                  value={config.glass.shadowExpand}
                  min={2}
                  max={100}
                  step={0.5}
                  display={config.glass.shadowExpand.toFixed(0)}
                  onChange={(v) => setGlass("shadowExpand", v)}
                  accent={accent}
                />
                <LabeledSlider
                  label="Factor"
                  value={config.glass.shadowFactor}
                  min={0}
                  max={100}
                  step={0.5}
                  display={`${config.glass.shadowFactor.toFixed(0)}%`}
                  onChange={(v) => setGlass("shadowFactor", v)}
                  accent={accent}
                />
                <LabeledSlider
                  label="Offset X"
                  value={config.glass.shadowX}
                  min={-50}
                  max={50}
                  step={1}
                  display={`${config.glass.shadowX.toFixed(0)}px`}
                  onChange={(v) => setGlass("shadowX", v)}
                  accent={accent}
                />
                <LabeledSlider
                  label="Offset Y"
                  value={config.glass.shadowY}
                  min={-50}
                  max={50}
                  step={1}
                  display={`${config.glass.shadowY.toFixed(0)}px`}
                  onChange={(v) => setGlass("shadowY", v)}
                  accent={accent}
                />
              </div>
              <div className="mt-3 border-t border-wp pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-wp-3">
                  Glass Blur
                </p>
                <LabeledSlider
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
                  <span className="text-[12px] text-wp-2">Blur Edge</span>
                  <ToggleSwitchSm
                    checked={config.glass.blurEdge}
                    accent={accent}
                    aria-label="Toggle blur edge"
                    onChange={(v) => setGlass("blurEdge", v)}
                  />
                </div>
              </div>
              <div className="mt-3 border-t border-wp pt-3">
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      glass: { ...GLASS_DEFAULTS },
                    }))
                  }
                  className="wp-interactive w-full rounded-lg border border-wp-2 bg-wp-fill px-3 py-2 text-[12px] font-medium text-wp-2 transition-colors hover:border-wp-3 hover:bg-wp-fill-2 hover:text-wp-1 active:scale-[0.99]"
                >
                  Reset glass defaults
                </button>
              </div>
            </div>
          </Section>

          <Section label="Aspect Ratio" accent={accent} collapsible defaultOpen>
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
                    className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg border transition-colors ${config.arIndex === i ? "border-wp-3 bg-wp-fill-2 text-wp-1" : "border-wp text-wp-4 hover:text-wp-2"}`}
                  >
                    <AspectRatioThumb
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
                  className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg border transition-colors ${config.arIndex === ASPECT_CUSTOM_INDEX ? "border-wp-3 bg-wp-fill-2 text-wp-1" : "border-wp text-wp-4 hover:text-wp-2"}`}
                >
                  <AspectRatioThumb
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
                    <span className="text-[11px] text-wp-3 shrink-0">
                      W : H
                    </span>
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
                            stackDirection: stackDirectionForAspectRatio(
                              nw,
                              nh,
                            ),
                          };
                        });
                      }}
                      className="min-w-[4.5rem] flex-1 rounded-md border border-wp-2 bg-wp-input px-2 py-1.5 text-[12px] font-mono text-wp-1 focus:border-wp-3 focus:outline-none"
                    />
                    <span className="text-wp-5 font-mono">:</span>
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
                            stackDirection: stackDirectionForAspectRatio(
                              nw,
                              nh,
                            ),
                          };
                        });
                      }}
                      className="min-w-[4.5rem] flex-1 rounded-md border border-wp-2 bg-wp-input px-2 py-1.5 text-[12px] font-mono text-wp-1 focus:border-wp-3 focus:outline-none"
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-wp-5 leading-snug">
                    Longer side at most {ASPECT_MAX_SIDE_RATIO}× the shorter
                    (each value 0.01–{ASPECT_RATIO_PART_MAX}).
                  </p>
                </>
              )}
            </div>
          </Section>

          <Section
            label="Quality"
            accent={accent}
            collapsible
            defaultOpen={false}
          >
            <div className="grid grid-cols-3 gap-1.5">
              {QUALITY_LEVELS.map((q, i) => (
                <button
                  key={q.label}
                  onClick={() => set("qualityIndex", i)}
                  className={`rounded-lg border py-2 text-[12px] font-mono transition-colors ${config.qualityIndex === i ? "border-wp-3 bg-wp-fill-2 text-wp-1" : "border-wp text-wp-4 hover:text-wp-2"}`}
                >
                  {q.label}
                </button>
              ))}
            </div>
            {config.dualMonitor ? (
              <p className="mt-2 text-center font-mono text-[11px] text-wp-5">
                Full image: {exportW} × {exportH}px
                <br />
                Per screen:{" "}
                {config.dualSplit === "left-right"
                  ? `${dualHalfW} × ${exportH}px`
                  : `${exportW} × ${dualHalfH}px`}
              </p>
            ) : (
              <p className="mt-2 text-center font-mono text-[11px] text-wp-5">
                Single screen: {exportW} × {exportH}px
              </p>
            )}
          </Section>

          <Section label="Dual monitor" accent={accent} collapsible defaultOpen={false}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] text-wp-2">
                Split preview & export
              </span>
              <ToggleSwitchSm
                checked={config.dualMonitor}
                accent={accent}
                aria-label="Toggle dual monitor"
                onChange={(next) =>
                  setConfig((prev) => {
                    if (!next) {
                      return { ...prev, dualMonitor: false };
                    }
                    if (prev.dualMonitor) return prev;
                    const wantsTopBottom = prev.dualSplit === "top-bottom";
                    const targetAspect = wantsTopBottom
                      ? { w: 16, h: 18 }
                      : { w: 32, h: 9 };
                    const targetAspectIndex = ASPECT_RATIOS.findIndex(
                      (a) => a.w === targetAspect.w && a.h === targetAspect.h,
                    );
                    const q5k = QUALITY_LEVELS.findIndex(
                      (q) => q.label === "5K",
                    );
                    const { w, h } =
                      targetAspectIndex >= 0
                        ? ASPECT_RATIOS[targetAspectIndex]
                        : targetAspect;
                    return {
                      ...prev,
                      dualMonitor: true,
                      arIndex:
                        targetAspectIndex >= 0
                          ? targetAspectIndex
                          : prev.arIndex,
                      qualityIndex: q5k >= 0 ? q5k : 3,
                      stackDirection: stackDirectionForAspectRatio(w, h),
                    };
                  })
                }
              />
            </div>
            {config.dualMonitor && (
              <SegmentedControl
                options={
                  [
                    ["left-right", "Left / Right"],
                    ["top-bottom", "Top / Bottom"],
                  ] as const
                }
                value={config.dualSplit}
                onChange={(v) =>
                  setConfig((prev) => {
                    const split = v as "left-right" | "top-bottom";
                    const targetAspect =
                      split === "top-bottom"
                        ? { w: 16, h: 18 }
                        : { w: 32, h: 9 };
                    const targetAspectIndex = ASPECT_RATIOS.findIndex(
                      (a) => a.w === targetAspect.w && a.h === targetAspect.h,
                    );
                    const { w, h } =
                      targetAspectIndex >= 0
                        ? ASPECT_RATIOS[targetAspectIndex]
                        : targetAspect;
                    return {
                      ...prev,
                      dualSplit: split,
                      arIndex:
                        targetAspectIndex >= 0
                          ? targetAspectIndex
                          : prev.arIndex,
                      stackDirection: stackDirectionForAspectRatio(w, h),
                    };
                  })
                }
                accent={accent}
              />
            )}
            <p className="text-[11px] text-wp-5 mt-2">
              {config.dualMonitor
                ? config.dualSplit === "left-right"
                  ? "Preview shows two halves side by side. Export downloads Full (combined), Left, and Right PNGs."
                  : "Preview shows two halves stacked. Export downloads Full (combined), Top, and Bottom PNGs."
                : "Off: single full wallpaper. On: combined span plus one file per display."}
            </p>
          </Section>

          <Section label="Alternating stagger" accent={accent} collapsible defaultOpen={false}>
            <LabeledSlider
              label="Wobble"
              value={config.pillStagger}
              min={-0.35}
              max={0.35}
              step={0.005}
              display={`${config.pillStagger >= 0 ? "+" : ""}${Math.round(config.pillStagger * 100)}%`}
              onChange={(v) => set("pillStagger", v)}
              accent={accent}
            />
            <p className="text-[11px] text-wp-5 mt-1">
              Offsets every other pill along the cross axis; negative values
              flip which side goes first. Scale is % of pill thickness (height
              in a row, width in a column).
            </p>
          </Section>

          <Section label="Export color depth" accent={accent} collapsible defaultOpen={false}>
            <SegmentedControl
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
              accent={accent}
            />
            <p className="text-[11px] text-wp-5 mt-2">
              Export applies per-channel quantization. PNG files use 8-bit
              samples; higher settings reduce banding when viewed on wide-gamut
              / HDR displays.
            </p>
          </Section>

        <BackgroundImageCropModal
          open={bgCropOpen !== null}
          dataUrl={bgCropOpen?.dataUrl ?? ""}
          arW={ar.w}
          arH={ar.h}
          initialCrop={bgCropOpen?.initial ?? null}
          accent={accent}
          onClose={() => setBgCropOpen(null)}
          onApply={(crop) => {
            if (bgCropOpen) {
              applyBackgroundWithCrop(
                bgCropOpen.dataUrl,
                crop,
                bgCropOpen.fileName,
              );
            }
            setBgCropOpen(null);
          }}
        />
        </aside>
  );
}
