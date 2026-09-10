import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { getTheme } from './theme';

interface ColorModeContextValue {
  mode: PaletteMode;
  toggleColorMode: () => void;
}

const ColorModeContext = createContext<ColorModeContextValue | null>(null);
const STORAGE_KEY = 'color-mode';

function readStoredMode(): PaletteMode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Wraps the app in a themed MUI context: resolves the initial mode from
 * localStorage, falling back to the OS preference, applies CssBaseline, and
 * exposes a toggle via useColorMode() for any component (e.g. the AppBar)
 * to flip it.
 */
export function ColorModeProvider({ children }: { children: ReactNode }) {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = useState<PaletteMode>(() => readStoredMode() ?? (prefersDark ? 'dark' : 'light'));

  const value = useMemo<ColorModeContextValue>(
    () => ({
      mode,
      toggleColorMode: () => {
        setMode((prev) => {
          const next: PaletteMode = prev === 'light' ? 'dark' : 'light';
          try {
            localStorage.setItem(STORAGE_KEY, next);
          } catch {
            // localStorage unavailable (private mode, etc.) — mode just won't persist
          }
          return next;
        });
      },
    }),
    [mode],
  );

  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export function useColorMode(): ColorModeContextValue {
  const ctx = useContext(ColorModeContext);
  if (!ctx) throw new Error('useColorMode must be used within a ColorModeProvider');
  return ctx;
}
