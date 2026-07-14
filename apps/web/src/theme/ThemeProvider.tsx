import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  ACCENT_KEY,
  applyTheme,
  getInitialAccent,
  getInitialTheme,
  THEME_KEY,
  type ThemeMode,
} from './accent';

interface ThemeCtx {
  mode: ThemeMode;
  /** Hex elegido, o null = acento nativo de medano-ui (brasa). */
  accent: string | null;
  setMode: (m: ThemeMode) => void;
  setAccent: (hex: string) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  mode: 'dark',
  accent: null,
  setMode: () => {},
  setAccent: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialTheme);
  const [accent, setAccentState] = useState<string | null>(getInitialAccent);

  useEffect(() => {
    applyTheme(mode, accent);
  }, [mode, accent]);

  const setMode = (m: ThemeMode) => {
    localStorage.setItem(THEME_KEY, m);
    setModeState(m);
  };
  const setAccent = (hex: string) => {
    localStorage.setItem(ACCENT_KEY, hex);
    setAccentState(hex);
  };

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
