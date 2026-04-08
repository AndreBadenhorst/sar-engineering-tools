import { useState, useEffect } from "react";

type Theme = "light" | "dark";

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem("sar-theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {}
  return "light"; // default to light
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("sar-theme", theme);
  }, [theme]);

  // Apply on mount
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, setTheme, toggle };
}
