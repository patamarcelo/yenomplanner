import React, { createContext, useContext, useMemo, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { lightThemeSpec } from "./light.jsx";
import { darkThemeSpec } from "./dark.jsx";

const ThemeModeContext = createContext(null);

function buildTheme(spec) {
  return createTheme({
    ...spec,

    // ✅ 1) DENSIDADE GLOBAL (resolve o "app grande" sem zoom)
    typography: {
      ...(spec.typography || {}),
      fontSize: 13, // padrão MUI: 14 → deixa tudo mais compacto
    },
    spacing: 6, // padrão MUI: 8 → reduz paddings/margens do app inteiro

    // (opcional) ajustes finos de forma global
    shape: {
      ...(spec.shape || {}),
      borderRadius: 12,
    },

    components: {
      // mantém qualquer components vindo do spec (se existir)
      ...(spec.components || {}),

      // ✅ Paper/Card: mantém seu visual, mas com densidade melhor via spacing/typography
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

      // ✅ Reduz padding padrão dos CardContent (um dos grandes culpados)
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: 12,
            "&:last-child": {
              paddingBottom: 12,
            },
          },
        },
      },

      // ✅ Botões mais compactos (sem perder clique confortável)
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            minHeight: 34,
            boxShadow: "none",
            textTransform: "none",
          },
          sizeSmall: {
            minHeight: 30,
            paddingTop: 4,
            paddingBottom: 4,
            paddingLeft: 10,
            paddingRight: 10,
          },
        },
      },

      // ✅ Inputs mais compactos
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            background:
              spec.palette.mode === "dark"
                ? "rgba(255,255,255,0.02)"
                : "rgba(0,0,0,0.02)",
          },
          input: {
            paddingTop: 10,
            paddingBottom: 10,
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

      // ✅ Chips/badges menores (afetam muito em telas cheias de filtros)
      MuiChip: {
        styleOverrides: {
          root: {
            height: 24,
            fontSize: "0.78rem",
          },
          label: {
            paddingLeft: 8,
            paddingRight: 8,
          },
        },
      },

      // ✅ Tabelas mais densas
      MuiTableCell: {
        styleOverrides: {
          root: {
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 12,
            paddingRight: 12,
          },
          head: {
            fontWeight: 700,
          },
        },
      },

      // ✅ AppBar/Drawer mantidos
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

      // ✅ DataGrid (se você usa): aqui costuma vir 50% do "tá tudo grande"
      MuiDataGrid: {
        defaultProps: {
          // density: "compact",
          rowHeight: 36,
          columnHeaderHeight: 40,
        },
        styleOverrides: {
          root: {
            border: `1px solid ${spec.palette.divider}`,
            borderRadius: 14,
          },
          cell: {
            outline: "none",
          },
          columnHeaders: {
            borderBottom: `1px solid ${spec.palette.divider}`,
          },
        },
      },

      // ✅ Dialog mais compacto (forms)
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            padding: 12,
            fontSize: "1rem",
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: 12,
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: 12,
          },
        },
      },

      // ✅ Tooltips um pouco menores
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: "0.78rem",
            padding: "6px 8px",
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
