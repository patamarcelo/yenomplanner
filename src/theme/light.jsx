export const lightThemeSpec = {
  palette: {
    mode: "light",
    background: {
      default: "#F5F5F7",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#111114",
      secondary: "#6B7280",
    },
    primary: { main: "#007AFF" },
    success: { main: "#34C759" },
    warning: { main: "#FF9500" },
    error: { main: "#FF3B30" },
    divider: "rgba(17,17,20,0.10)",
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial",
    h5: { fontWeight: 700, letterSpacing: -0.2 },
    h6: { fontWeight: 700, letterSpacing: -0.2 },
    button: { textTransform: "none", fontWeight: 650 },
  },
};
