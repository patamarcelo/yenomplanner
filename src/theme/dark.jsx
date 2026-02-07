export const darkThemeSpec = {
  palette: {
    mode: "dark",
    background: {
      default: "#0B0B0F",
      paper: "#14141A",
    },
    text: {
      primary: "#F2F2F7",
      secondary: "rgba(242,242,247,0.65)",
    },
    primary: { main: "#0A84FF" },
    success: { main: "#30D158" },
    warning: { main: "#FF9F0A" },
    error: { main: "#FF453A" },
    divider: "rgba(242,242,247,0.10)",
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
