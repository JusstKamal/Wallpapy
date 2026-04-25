"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Section({
  label,
  children,
  collapsible = false,
  defaultOpen = true,
  accent,
}: {
  label: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-wp px-4 py-3.5 sm:py-4">
      <div
        role={collapsible ? "button" : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onClick={collapsible ? () => setOpen((o) => !o) : undefined}
        onKeyDown={
          collapsible
            ? (e) => (e.key === "Enter" || e.key === " ") && setOpen((o) => !o)
            : undefined
        }
        className={`mb-2.5 flex items-center justify-between gap-2 ${collapsible ? "cursor-pointer select-none" : ""}`}
      >
        <div className="flex items-center gap-1.5">
          {accent && (
            <span
              className="h-[5px] w-[5px] shrink-0 rounded-full"
              style={{ background: accent, opacity: 0.7 }}
              aria-hidden
            />
          )}
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-wp-3">
            {label}
          </span>
        </div>
        {collapsible && (
          <motion.svg
            animate={{ rotate: open ? 0 : -90 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            width="11"
            height="11"
            viewBox="0 0 11 11"
            fill="none"
            className="shrink-0 text-wp-4"
            aria-hidden
          >
            <path
              d="M1.5 3.5 5.5 7.5 9.5 3.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        )}
      </div>
      <AnimatePresence initial={false}>
        {(!collapsible || open) && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: collapsible ? "hidden" : "visible" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
