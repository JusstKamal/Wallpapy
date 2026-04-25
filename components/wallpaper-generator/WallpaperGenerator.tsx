"use client";

import { motion } from "framer-motion";
import { ControlSidebar } from "./ControlSidebar";
import { ExportBusyOverlay } from "./ui/ExportBusyOverlay";
import { useWallpaperGenerator } from "./useWallpaperGenerator";
import { WallpaperHeader } from "./WallpaperHeader";
import { WallpaperPreviewColumn } from "./WallpaperPreviewColumn";

export default function WallpaperGenerator() {
  const w = useWallpaperGenerator();

  return (
    <motion.div
      className="fixed inset-0 z-0 flex min-h-dvh flex-col overflow-hidden bg-wp-app text-wp-1"
      initial={{ opacity: 0.97 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {w.exportBusy && <ExportBusyOverlay accent={w.accent} />}

      <WallpaperHeader w={w} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <ControlSidebar w={w} />
        <WallpaperPreviewColumn w={w} />
      </div>

    </motion.div>
  );
}
