import { createTheme, type PaletteMode, type ThemeOptions } from '@mui/material/styles';

/**
 * Single source of truth for design tokens. Every color, radius, and type
 * scale used anywhere in the app should trace back to this file — no raw
 * hex codes or magic pixel values in component styles.
 */

// Exported so other files (e.g. SetupPanel's accent-color picker default)
// can reference the same value instead of duplicating the literal.
export const DEFAULT_ACCENT_COLOR = '#4f46e5';

function getDesignTokens(mode: PaletteMode, accentColor?: string): ThemeOptions {
  const isLight = mode === 'light';
  // A company-supplied accent color overrides the default indigo. MUI's
  // createTheme derives light/dark/contrastText from `main` automatically
  // (via augmentColor) when only `main` is given.
  const primary = accentColor
    ? { main: accentColor }
    : { main: DEFAULT_ACCENT_COLOR, light: '#818cf8', dark: '#3730a3', contrastText: '#ffffff' };

  return {
    palette: {
      mode,
      primary,
      secondary: {
        main: '#0ea5e9',
        contrastText: '#ffffff',
      },
      success: { main: '#16a34a' },
      warning: { main: '#d97706' },
      error: { main: '#dc2626' },
      background: {
        default: isLight ? '#f4f5f9' : '#0f1115',
        paper: isLight ? '#ffffff' : '#181b21',
      },
      divider: isLight ? 'rgba(15, 17, 21, 0.08)' : 'rgba(255, 255, 255, 0.08)',
    },
    shape: {
      borderRadius: 12,
    },
    spacing: 8,
    typography: {
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isLight ? '#f4f5f9' : '#0f1115',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: { boxShadow: 'none' },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 10, paddingInline: 18 },
        },
      },
      MuiTextField: {
        defaultProps: { size: 'small' },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
        },
      },
    },
  };
}

export function getTheme(mode: PaletteMode, accentColor?: string) {
  return createTheme(getDesignTokens(mode, accentColor));
}
