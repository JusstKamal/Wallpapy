"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type BackgroundImageCrop,
  computeVisibleCrop,
  getDefaultBackgroundCrop,
  getPanZoomFromCrop,
} from "@/lib/backgroundCrop";

type Props = {
  open: boolean;
  dataUrl: string;
  arW: number;
  arH: number;
  initialCrop: BackgroundImageCrop | null;
  accent: string;
  onClose: () => void;
  onApply: (crop: BackgroundImageCrop) => void;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function BackgroundImageCropModal({
  open,
  dataUrl,
  arW,
  arH,
  initialCrop,
  accent,
  onClose,
  onApply,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [iw, setIw] = useState(0);
  const [ih, setIh] = useState(0);
  const [imgPx, setImgPx] = useState(0);
  const [imgPy, setImgPy] = useState(0);
  const [wDisp, setWDisp] = useState(100);
  const [hDisp, setHDisp] = useState(100);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [loadToken, setLoadToken] = useState(0);

  useEffect(() => {
    if (!open || !dataUrl) {
      return;
    }
    const im = new Image();
    im.onload = () => {
      setIw(im.naturalWidth);
      setIh(im.naturalHeight);
      setLoadToken((t) => t + 1);
    };
    im.src = dataUrl;
  }, [open, dataUrl]);

  const initFromBox = useCallback(() => {
    const el = boxRef.current;
    if (!el || iw < 1 || ih < 1) return;
    const bW = Math.max(1, el.getBoundingClientRect().width);
    const bH = Math.max(1, el.getBoundingClientRect().height);
    const def = getDefaultBackgroundCrop(iw, ih, arW, arH);
    const base =
      initialCrop && initialCrop.w > 0 && initialCrop.h > 0
        ? initialCrop
        : def;
    const pv = getPanZoomFromCrop(base, iw, ih, bW, bH);
    const wD = Math.max(1, pv.wDisp);
    const hD = (wD * ih) / iw;
    setWDisp(wD);
    setHDisp(hD);
    setImgPx(pv.imgPx);
    setImgPy(pv.imgPy);
  }, [iw, ih, arW, arH, initialCrop]);

  useEffect(() => {
    if (!open || loadToken < 1) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(initFromBox));
    return () => cancelAnimationFrame(id);
  }, [open, loadToken, initFromBox]);

  const clampPan = (px: number, py: number, wD: number, hD: number) => {
    const el = boxRef.current;
    if (!el) return { px, py };
    const bW = el.getBoundingClientRect().width;
    const bH = el.getBoundingClientRect().height;
    return {
      px: clamp(px, bW - wD, 0),
      py: clamp(py, bH - hD, 0),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX - imgPx, y: e.clientY - imgPy };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const nx = e.clientX - drag.current.x;
    const ny = e.clientY - drag.current.y;
    const c = clampPan(nx, ny, wDisp, hDisp);
    setImgPx(c.px);
    setImgPy(c.py);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      drag.current = null;
    }
  };

  const handleApply = () => {
    const el = boxRef.current;
    if (!el || iw < 1) return;
    const { width: bW, height: bH } = el.getBoundingClientRect();
    if (bW < 1 || bH < 1) return;
    const crop = computeVisibleCrop(iw, ih, bW, bH, imgPx, imgPy, wDisp, hDisp);
    onApply(crop);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-[var(--wp-overlay)]" aria-hidden />
      <motion.div
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-wp-2 bg-wp-panel text-wp-1 shadow-2xl"
        initial={{ opacity: 0, y: 12, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-wp px-4 py-3">
          <h2 className="text-sm font-semibold">Position background</h2>
          <p className="mt-0.5 text-[11px] text-wp-3">
            Framing {arW}∶{arH} (same as your current aspect) — drag to pan,
            then apply.
          </p>
        </div>
        <div className="w-full p-3" style={{ touchAction: "none" } as const}>
          <div
            ref={boxRef}
            className="relative mx-auto w-full max-w-full select-none overflow-hidden rounded-lg border border-wp-2 bg-black/40"
            style={{
              aspectRatio: `${arW} / ${arH}`,
              maxHeight: "50vh",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            role="presentation"
          >
            {iw > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dataUrl}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{
                  left: imgPx,
                  top: imgPy,
                  width: wDisp,
                  height: hDisp,
                }}
              />
            ) : null}
          </div>
          {iw < 1 ? (
            <p className="mt-2 text-center text-xs text-wp-4">Loading image…</p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-wp px-3 py-3">
          <button
            type="button"
            className="rounded-lg border border-wp-2 px-4 py-2 text-sm text-wp-2 transition-colors hover:text-wp-1"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="wp-interactive rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: accent, color: "var(--wp-on-accent)" }}
            onClick={handleApply}
            disabled={iw < 1}
          >
            Use crop
          </button>
        </div>
      </motion.div>
    </div>
  );
}
