"use client";

import { motion } from "framer-motion";
import { DownloadIcon, ExportSpinner, PillIcon } from "./ui/icons";
import type { WallpapyModel } from "./useWallpaperGenerator";
import { useAppTheme } from "./useAppTheme";

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="text-wp-2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 1.5v2M12 20.5v2M3.5 12H2M22 12h-1.5M4.2 4.2 5.4 5.4M18.6 18.6l1.2 1.2M4.2 19.8l1.2-1.2M18.6 5.4l1.2-1.2" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="text-wp-2"
      aria-hidden
    >
      <path d="M20.3 14.3A7.5 7.5 0 0 1 9.7 3.7 6.2 6.2 0 0 0 12 20a7.5 7.5 0 0 0 8.3-5.7z" />
    </svg>
  );
}

export function WallpaperHeader({ w }: { w: WallpapyModel }) {
  const { accent, download, exportBusy, exportW, exportH } = w;
  const { theme, toggle } = useAppTheme();
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-wp bg-wp-elev/80 px-4 py-3 sm:px-6 sm:py-3.5">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <motion.div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--wp-on-accent)] shadow-md"
          style={{ background: accent }}
          whileHover={{ scale: 1.04, rotate: -2 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
        >
          <PillIcon />
        </motion.div>
        <div className="min-w-0">
          <span className="block truncate font-semibold tracking-tight text-wp-1 text-[15px] sm:text-[16px]">
            Wallpapy
          </span>
          <span className="hidden text-[11px] text-wp-4 sm:block">
            Free pill-stack wallpapers
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        <button
          type="button"
          onClick={toggle}
          className="wp-interactive flex h-9 w-9 items-center justify-center rounded-lg border border-wp-2 bg-wp-fill text-wp-1 hover:border-wp-3 active:scale-95"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
        <motion.button
          type="button"
          onClick={download}
          disabled={exportBusy}
          aria-busy={exportBusy}
          className="wp-interactive flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[12px] font-semibold sm:gap-2 sm:px-5 sm:text-[13px] touch-manipulation disabled:pointer-events-none disabled:opacity-75"
          style={{ background: accent, color: "var(--wp-on-accent)" }}
          whileHover={{ scale: exportBusy ? 1 : 1.03, y: exportBusy ? 0 : -1 }}
          whileTap={{ scale: exportBusy ? 1 : 0.98 }}
          transition={{ type: "spring", stiffness: 450, damping: 28 }}
        >
          {exportBusy ? (
            <ExportSpinner className="h-[13px] w-[13px]" accent="var(--wp-on-accent)" />
          ) : (
            <DownloadIcon />
          )}
          <span className="hidden sm:inline">
            Export {exportW} × {exportH}
          </span>
          <span className="sm:hidden">Export</span>
        </motion.button>
      </div>
    </header>
  );
}
