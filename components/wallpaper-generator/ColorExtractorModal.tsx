"use client";

import { motion } from "framer-motion";
import { ShuffleIcon } from "./ui/icons";
import type { WallpapyModel } from "./useWallpaperGenerator";

export function ColorExtractorModal({ w }: { w: WallpapyModel }) {
  const {
    showExtractor,
    extractorImage,
    extractorDataUrl,
    setShowExtractor,
    reshuffleExtractor,
    extractorImgRef,
    extractorPositions,
    config,
    extractorDragging,
    handleMarkerPointerDown,
    handleMarkerPointerMove,
    handleMarkerPointerUp,
    extractorPreviewRef,
    ar,
    removeExtractorStop,
    addExtractorStop,
  } = w;

  if (!showExtractor || !extractorImage || !extractorDataUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setShowExtractor(false);
      }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "var(--wp-overlay)" }}
        aria-hidden
      />

      <motion.div
        className="relative flex max-h-[min(90dvh,880px)] w-full flex-col overflow-hidden rounded-2xl border border-wp-2 bg-wp-panel shadow-2xl"
        style={{ maxWidth: "min(960px, 96vw)" }}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      >
        <div className="flex items-center justify-between border-b border-wp px-5 pb-3 pt-4">
          <div>
            <p className="text-[13px] font-semibold text-wp-1">Pick colors from image</p>
            <p className="mt-0.5 text-[11px] text-wp-3">
              Drag markers · preview updates live
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reshuffleExtractor}
              className="wp-interactive flex items-center gap-1.5 rounded-lg border border-wp-2 bg-wp-fill px-3 py-1.5 text-[11px] text-wp-2 hover:border-wp-3 hover:text-wp-1"
            >
              <ShuffleIcon />
              Reshuffle
            </button>
            <button
              type="button"
              onClick={() => setShowExtractor(false)}
              className="wp-interactive flex h-8 w-8 items-center justify-center rounded-lg border border-wp-2 text-[18px] leading-none text-wp-3 transition-colors hover:border-wp-3 hover:text-wp-1"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div
          className="flex min-h-0 flex-col overflow-hidden sm:flex-row"
          style={{ maxHeight: "65vh" }}
        >
          <div className="relative min-h-0 w-full min-w-0 flex-1 select-none overflow-hidden bg-wp-elev">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={(el) => {
                extractorImgRef.current = el;
              }}
              src={extractorDataUrl}
              alt="Color source"
              className="block h-full w-full object-contain"
              style={{ userSelect: "none", pointerEvents: "none" }}
              draggable={false}
            />

            {extractorPositions.map((pos, idx) => {
              const color = config.paletteColors[idx] ?? "#808080";
              const isDragging = extractorDragging === idx;
              return (
                <div
                  key={idx}
                  style={{
                    position: "absolute",
                    left: `${pos.x * 100}%`,
                    top: `${pos.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    touchAction: "none",
                    cursor: isDragging ? "grabbing" : "grab",
                    zIndex: isDragging ? 10 : idx + 1,
                  }}
                  onPointerDown={(e) => handleMarkerPointerDown(e, idx)}
                  onPointerMove={(e) => handleMarkerPointerMove(e, idx)}
                  onPointerUp={handleMarkerPointerUp}
                  onPointerCancel={handleMarkerPointerUp}
                >
                  <div
                    className="rounded-full"
                    style={{
                      width: 32,
                      height: 32,
                      background: color,
                      border: "3px solid rgba(255,255,255,0.9)",
                      boxShadow:
                        "0 2px 10px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.3)",
                      transform: isDragging ? "scale(1.25) rotate(-4deg)" : "scale(1)",
                      transition: isDragging ? "none" : "transform 0.18s cubic-bezier(0.34,1.3,0.64,1)",
                    }}
                  />
                  <div
                    className="bg-wp-elev absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border"
                    style={{
                      width: 14,
                      height: 14,
                      borderColor: "var(--wp-border-2)",
                      fontSize: 8,
                      fontWeight: 700,
                      color: "var(--wp-t2)",
                      lineHeight: 1,
                    }}
                  >
                    {idx + 1}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex shrink-0 flex-col border-t border-wp bg-wp-rail sm:w-56 sm:border-l sm:border-t-0">
            <p className="px-4 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-wp-4">
              Preview
            </p>
            <div className="flex flex-1 items-center justify-center px-3 pb-3">
              <canvas
                ref={(el) => {
                  extractorPreviewRef.current = el;
                }}
                className="w-full max-w-full rounded-lg border border-wp"
                style={{ aspectRatio: `${ar.w} / ${ar.h}` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-wp px-5 py-3">
          <button
            type="button"
            onClick={removeExtractorStop}
            disabled={config.paletteColors.length <= 1}
            className="wp-interactive flex h-7 w-7 items-center justify-center rounded-lg border border-wp-2 text-[16px] leading-none text-wp-3 disabled:pointer-events-none disabled:opacity-30 hover:border-wp-3 hover:text-wp-1"
            aria-label="Remove color stop"
          >
            −
          </button>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {config.paletteColors.map((c, i) => (
              <div
                key={i}
                className="h-5 w-5 rounded-full border-2 border-wp-3 transition-transform duration-200 hover:scale-110"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addExtractorStop}
            disabled={config.paletteColors.length >= 8}
            className="wp-interactive flex h-7 w-7 items-center justify-center rounded-lg border border-wp-2 text-[16px] leading-none text-wp-3 disabled:pointer-events-none disabled:opacity-30 hover:border-wp-3 hover:text-wp-1"
            aria-label="Add color stop"
          >
            +
          </button>

          <button
            type="button"
            onClick={() => setShowExtractor(false)}
            className="wp-interactive shrink-0 rounded-lg bg-wp-fill-2 px-4 py-1.5 text-[12px] font-semibold text-wp-1 hover:brightness-110"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
