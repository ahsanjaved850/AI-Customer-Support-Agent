import { createTheme, type PaletteMode, type ThemeOptions } from '@mui/material/styles';

/**
 * Single source of truth for design tokens. Every color, radius, and type
 * scale used anywhere in the app should trace back to this file — no raw
 * hex codes or magic pixel values in component styles.
 */
function getDesignTokens(mode: PaletteMode): ThemeOptions {
  const isLight = mode === 'light';

  return {
    palette: {
      mode,
      primary: {
        main: '#4f46e5',
        light: '#818cf8',
        dark: '#3730a3',
        contrastText: '#ffffff',
      },
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

export function getTheme(mode: PaletteMode) {
  return createTheme(getDesignTokens(mode));
}
