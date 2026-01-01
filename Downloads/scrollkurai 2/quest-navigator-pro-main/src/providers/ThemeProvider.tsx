import { ReactNode, useEffect, useState } from "react";

// A lightweight theme provider for Vite apps that toggles the `dark`/`light` class
// on the <html> element and optionally follows the system preference.
// This avoids pulling heavy theming libs that can accidentally introduce duplicate React copies.

type Theme = "light" | "dark";

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: "class"; // kept for API compatibility
  defaultTheme?: Theme | "system";
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({
  children,
  // keep same defaults as next-themes usage in the app
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = true,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      if (defaultTheme === "system" && enableSystem) return getSystemTheme();
      return (defaultTheme as Theme) ?? "light";
    } catch {
      return "light";
    }
  });

  // Apply theme class to the document element
  useEffect(() => {
    const root = document.documentElement;

    let style: HTMLStyleElement | null = null;
    if (disableTransitionOnChange) {
      style = document.createElement("style");
      style.appendChild(document.createTextNode("*{transition:none!important}"));
      document.head.appendChild(style);
    }

    root.classList.remove("light", "dark");
    root.classList.add(theme);

    if (style) {
      // Next frame, remove the style to restore transitions
      requestAnimationFrame(() => {
        if (style && style.parentNode) style.parentNode.removeChild(style);
      });
    }
  }, [theme, disableTransitionOnChange]);

  // Follow system preference if enabled
  useEffect(() => {
    if (!enableSystem) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setTheme(mql.matches ? "dark" : "light");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [enableSystem]);

  return <>{children}</>;
}
