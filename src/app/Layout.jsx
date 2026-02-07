import React, { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Typography,
  Button,
  Divider,
  useTheme,
  Tooltip,
} from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ViewWeekRoundedIcon from "@mui/icons-material/ViewWeekRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";

import MonthPicker from "../components/MonthPicker";
import NewTransactionModal from "../components/NewTransactionModal";
import { useThemeMode } from "../theme";

import { useSelector, useDispatch } from "react-redux";
import { setMonth } from "../store/financeSlice.js";


const drawerW = 270;

const navItems = [
  { to: "/", label: "Dashboard", icon: <DashboardRoundedIcon /> },
  { to: "/lancamentos", label: "Lançamentos", icon: <CreditCardRoundedIcon /> },
  { to: "/faturas", label: "Faturas", icon: <ReceiptLongRoundedIcon /> },
  { to: "/parcelamentos", label: "Parcelamentos", icon: <ViewWeekRoundedIcon /> },
];

function NavItem({ to, label, icon }) {
  const theme = useTheme();
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 14,
        color: theme.palette.text.primary,
        background: isActive
          ? theme.palette.mode === "dark"
            ? "rgba(10,132,255,0.18)"
            : "rgba(0,122,255,0.10)"
          : "transparent",
      })}
    >
      <Box sx={{ opacity: 0.9 }}>{icon}</Box>
      <Typography sx={{ fontWeight: 650 }}>{label}</Typography>
    </NavLink>
  );
}

export default function Layout({ ctx, children }) {
  const theme = useTheme();
  const themeMode = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);

  const dispatch = useDispatch();
  const month = useSelector((s) => s.finance.month);


  const title = useMemo(() => {
    const hit = navItems.find((n) => n.to === location.pathname);
    if (location.pathname === "/") return "Dashboard";
    return hit?.label || "Finance";
  }, [location.pathname]);

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerW,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerW,
            boxSizing: "border-box",
            borderRight: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <Box sx={{ p: 2.2 }}>
          <Stack spacing={1.1}>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>
              Finance
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Controle por fatura e projeções
            </Typography>
          </Stack>
        </Box>

        <Divider />

        <Box sx={{ p: 1.4, display: "flex", flexDirection: "column", gap: 0.8 }}>
          {navItems.map((it) => (
            <NavItem key={it.to} to={it.to} label={it.label} icon={it.icon} />
          ))}
        </Box>

        <Box sx={{ flex: 1 }} />

        <Box sx={{ p: 1.6 }}>
          <Button
            fullWidth
            variant="contained"
            onClick={() => setNewOpen(true)}
            sx={{
              borderRadius: 999,
              height: 44,
              fontWeight: 750,
            }}
          >
            + Novo lançamento
          </Button>
          <Typography
            variant="caption"
            sx={{ display: "block", mt: 1, color: "text.secondary" }}
          >
            MVP com dados fictícios
          </Typography>
        </Box>
      </Drawer>

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <AppBar position="sticky" color="default">
          <Toolbar
            sx={{
              minHeight: 68,
              display: "flex",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 260 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {title}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1.2} alignItems="center">
              <MonthPicker value={month} onChange={(v) => dispatch(setMonth(v))} />

              <Button
                variant="contained"
                onClick={() => setNewOpen(true)}
                sx={{ height: 40, borderRadius: 999, fontWeight: 750 }}
              >
                + Lançamento
              </Button>

              <Tooltip title={themeMode.mode === "dark" ? "Modo claro" : "Modo escuro"}>
                <IconButton onClick={themeMode.toggle}>
                  {themeMode.mode === "dark" ? (
                    <LightModeRoundedIcon />
                  ) : (
                    <DarkModeRoundedIcon />
                  )}
                </IconButton>
              </Tooltip>
            </Stack>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: { xs: 2, md: 3 }, flex: 1, overflow: "auto" }}>{children}</Box>

        <NewTransactionModal open={newOpen} onClose={() => setNewOpen(false)} />
      </Box>
    </Box>
  );
}
