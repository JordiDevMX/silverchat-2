import { createContext, type PropsWithChildren, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
type Accent = "blue" | "purple" | "red" | "orange" | "yellow" | "green";
const ThemeContext = createContext<{
  theme: Theme;
  accent: Accent;
  setTheme: (value: Theme) => void;
  setAccent: (value: Accent) => void;
} | null>(null);
export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<Theme>("system");
  const [accent, setAccent] = useState<Accent>("blue");
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    const root = document.documentElement;
    for (const name of ["blue", "purple", "red", "orange", "yellow", "green"])
      root.classList.remove(`theme-${name}`);
    root.classList.add(`theme-${accent}`);
  }, [accent]);
  return (
    <ThemeContext.Provider value={{ theme, accent, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider missing");
  return value;
}
