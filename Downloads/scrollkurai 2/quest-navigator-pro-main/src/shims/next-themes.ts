import type { ReactNode } from "react";
import { ThemeProvider as InternalThemeProvider } from "@/providers/ThemeProvider";

type Theme = "light" | "dark";

export interface ThemeProviderProps {
  children: ReactNode;
  attribute?: "class";
  defaultTheme?: Theme | "system";
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

// Re-export our internal provider under the next-themes name
export const ThemeProvider = InternalThemeProvider;

export function useTheme() {
  const getSystem = (): Theme =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

  const isDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  const theme: Theme = isDark ? "dark" : getSystem();

  const setTheme = (t: Theme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(t);
  };

  return {
    theme,
    setTheme,
    resolvedTheme: theme,
    systemTheme: getSystem(),
  } as const;
}
