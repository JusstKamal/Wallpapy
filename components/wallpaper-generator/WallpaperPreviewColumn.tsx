"use client";

import { motion } from "framer-motion";
import packageJson from "@/package.json";
import type { WallpapyModel } from "./useWallpaperGenerator";
import { SOCIAL_LINKS } from "./constants";

export function WallpaperPreviewColumn({ w }: { w: WallpapyModel }) {
  const {
    previewSlotRef,
    isMdUp,
    isPortrait,
    previewFramePx,
    canvasRef,
    glCanvasRef,
    dualCanvasARef,
    dualCanvasBRef,
    config,
    exportW,
    exportH,
    accent,
  } = w;
  return (
    <main
      className="relative order-1 flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden bg-wp-canvas px-3 py-3 sm:px-6 sm:py-5 md:order-2 md:min-w-0"
      style={{
        minHeight: 0,
        /* Mobile: most vertical space to preview; desktop: flex takes the rest */
      }}
    >
      {/* Subtle “stage” (no glass blur) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 45%, var(--wp-frame-glow), transparent 60%)",
        }}
        aria-hidden
      />
      <div
        className="relative z-[1] flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col items-center justify-center gap-1"
        style={{ maxHeight: "100%" }}
      >
        <div
          ref={previewSlotRef}
          className={`flex min-h-0 w-full min-w-0 flex-1 items-center justify-center ${
            isMdUp && isPortrait ? "md:mx-auto md:max-w-[50%]" : ""
          }`}
        >
          <motion.div
            className="relative box-border max-h-full min-h-0 shrink-0 overflow-hidden bg-wp-shade wp-hero-frame"
            style={{
              width: previewFramePx.w > 0 ? previewFramePx.w : undefined,
              height: previewFramePx.h > 0 ? previewFramePx.h : undefined,
            }}
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
          >
            <canvas
              ref={canvasRef}
              className={
                config.dualMonitor
                  ? "pointer-events-none absolute inset-0 block h-full w-full opacity-0"
                  : "block h-full w-full"
              }
              style={{ display: config.liquidGlass ? "none" : "block" }}
            />
            <canvas
              ref={glCanvasRef}
              className={
                config.dualMonitor
                  ? "pointer-events-none absolute inset-0 block h-full w-full opacity-0"
                  : "block h-full w-full"
              }
              style={{ display: config.liquidGlass ? "block" : "none" }}
            />
            {config.dualMonitor && (
              <div
                className={`absolute inset-0 flex min-h-0 min-w-0 bg-wp-canvas p-2 sm:p-2.5 ${
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
          </motion.div>
        </div>
        <motion.div
          className="mt-0 flex max-w-full shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-1"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.3 }}
        >
          <span className="font-mono text-[11px] tabular-nums text-wp-4">
            {exportW} × {exportH}
          </span>
          <span className="text-wp-5">·</span>
          <span className="text-[11px] text-wp-3">{config.pillCount} pills</span>
          <span className="text-wp-5">·</span>
          <span className="text-[11px] capitalize text-wp-3">
            {config.stackDirection}
          </span>
          {config.liquidGlass && (
            <>
              <span className="text-wp-5">·</span>
              <span className="text-[11px] font-medium" style={{ color: accent }}>
                Liquid Glass
              </span>
            </>
          )}
          {config.dualMonitor && (
            <>
              <span className="text-wp-5">·</span>
              <span className="text-[11px] text-wp-2">
                Dual{" "}
                {config.dualSplit === "left-right"
                  ? "Left / Right"
                  : "Top / Bottom"}
              </span>
            </>
          )}
        </motion.div>
        <section
          className="mt-auto w-full max-w-md shrink-0 border-t border-wp py-3 text-center sm:py-4"
          aria-label="About this app"
        >
          <p className="font-mono text-[10px] tabular-nums tracking-widest text-wp-4">
            Wallpapy v{packageJson.version}
          </p>
          <p className="mx-auto mt-1.5 max-w-[20rem] text-[12px] leading-snug text-wp-3">
            <span className="text-wp-2">Ahmed Kamal</span>
            <span className="text-wp-4"> — </span>
            Follow and contact{" "}
            <span className="font-mono text-[11px] text-wp-2">@jusstkamal</span>
          </p>
          <nav
            className="mt-2.5 flex flex-wrap items-center justify-center gap-y-1 text-[11px] text-wp-3"
            aria-label="Social profiles"
          >
            {SOCIAL_LINKS.map(({ label, href }, i) => (
              <span key={href} className="inline-flex items-center">
                {i > 0 ? (
                  <span
                    className="mx-2 select-none text-[10px] text-wp-5"
                    aria-hidden
                  >
                    ·
                  </span>
                ) : null}
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wp-interactive rounded px-0.5 text-wp-2 hover:text-wp-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wp-border-3)]"
                >
                  {label}
                </a>
              </span>
            ))}
          </nav>
        </section>
      </div>
    </main>
  );
}
