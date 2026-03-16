export const lightThemeSpec = {
  palette: {
    mode: "light",
    background: {
      default: "#F3F6FB",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#0F172A",
      secondary: "#667085",
    },
    primary: { main: "#2563EB" },
    secondary: { main: "#4F46E5" },
    success: { main: "#16A34A" },
    warning: { main: "#F59E0B" },
    error: { main: "#DC2626" },
    info: { main: "#0EA5E9" },
    divider: "rgba(15,23,42,0.10)",
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial",
    h5: { fontWeight: 750, letterSpacing: -0.25 },
    h6: { fontWeight: 750, letterSpacing: -0.2 },
    button: { textTransform: "none", fontWeight: 650 },
  },
};