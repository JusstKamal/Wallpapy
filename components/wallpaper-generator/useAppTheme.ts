"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE = "wallpapy-theme" as const;
type Theme = "dark" | "light";

function getSnapshot(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function getServerSnapshot(): Theme {
  return "dark";
}

function subscribe(callback: () => void) {
  const obs = new MutationObserver(() => callback());
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

function applyClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  try {
    localStorage.setItem(STORAGE, theme);
  } catch {
    /* ignore */
  }
}

export function useAppTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    applyClass(next);
  }, []);

  const toggle = useCallback(() => {
    applyClass(theme === "dark" ? "light" : "dark");
  }, [theme]);

  // Sync on mount in case the blocking script and React disagree
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE);
      if (stored === "light" || stored === "dark") applyClass(stored);
    } catch {
      /* ignore */
    }
  }, []);

  return { theme, setTheme, toggle };
}
