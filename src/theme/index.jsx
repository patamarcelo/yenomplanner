import React, { createContext, useContext, useMemo, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { lightThemeSpec } from "./light.jsx";
import { darkThemeSpec } from "./dark.jsx";

const ThemeModeContext = createContext(null);

function buildTheme(spec) {
  return createTheme({
    ...spec,
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: "var(--radius-xl)",
            boxShadow:
              spec.palette.mode === "dark"
                ? "var(--shadow-soft-dark)"
                : "var(--shadow-soft)",
            border: `1px solid ${spec.palette.divider}`,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: "var(--radius-xl)",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            paddingLeft: 14,
            paddingRight: 14,
            boxShadow: "none",
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            background:
              spec.palette.mode === "dark"
                ? "rgba(255,255,255,0.02)"
                : "rgba(0,0,0,0.02)",
          },
          notchedOutline: {
            borderColor: spec.palette.divider,
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color:
              spec.palette.mode === "dark"
                ? "rgba(242,242,247,0.65)"
                : "#6B7280",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: "none",
            borderBottom: `1px solid ${spec.palette.divider}`,
            background: spec.palette.background.paper,
            color: spec.palette.text.primary,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: `1px solid ${spec.palette.divider}`,
            background: spec.palette.background.paper,
          },
        },
      },
    },
  });
}

export function AppThemeProvider({ children }) {
  const [mode, setMode] = useState("light");

  const theme = useMemo(() => {
    const spec = mode === "dark" ? darkThemeSpec : lightThemeSpec;
    return buildTheme(spec);
  }, [mode]);

  const api = useMemo(
    () => ({
      mode,
      setMode,
      toggle: () => setMode((m) => (m === "dark" ? "light" : "dark")),
    }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={api}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode must be used within AppThemeProvider");
  return ctx;
}
