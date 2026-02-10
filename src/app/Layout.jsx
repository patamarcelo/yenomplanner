import React, { useMemo, useState, useEffect } from "react";
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
  useMediaQuery,
} from "@mui/material";

import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";

import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ViewWeekRoundedIcon from "@mui/icons-material/ViewWeekRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

import MonthPicker from "../components/MonthPicker";
import NewTransactionModal from "../components/NewTransactionModal";
import { useThemeMode } from "../theme";

import { useSelector, useDispatch } from "react-redux";
import { setMonth } from "../store/financeSlice.js";

import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import { toggleHideValues, selectHideValues } from "../store/uiSlice";
import { alpha } from "@mui/material/styles";

import DashboardFilters from "../components/DashboardFilters.jsx";
import { meThunk } from "../store/authSlice";

import ExitToAppRoundedIcon from "@mui/icons-material/ExitToAppRounded";
import { logout } from "../store/authSlice";

import { fetchAccountsThunk } from "../store/accountsSlice.js";
import { fetchAllTransactionsThunk } from "../store/transactionsSlice.js";


const DRAWER_EXPANDED = 270;
const DRAWER_COLLAPSED = 76;
const TOP_H = 64;

const navItems = [
  { to: "/", label: "Dashboard", icon: <DashboardRoundedIcon /> },
  { to: "/contas", label: "Contas", icon: <AccountBalanceRoundedIcon /> },
  { to: "/lancamentos", label: "Lançamentos", icon: <CreditCardRoundedIcon /> },
  { to: "/faturas", label: "Faturas", icon: <ReceiptLongRoundedIcon /> },
  { to: "/parcelamentos", label: "Parcelamentos", icon: <ViewWeekRoundedIcon /> },
];

function NavItem({ to, label, icon, collapsed }) {
  const theme = useTheme();

  const base = (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: collapsed ? 0 : 10,
        padding: collapsed ? "10px 10px" : "10px 12px",
        borderRadius: 14,
        color: theme.palette.text.primary,
        textDecoration: "none",
        background: isActive
          ? theme.palette.mode === "dark"
            ? "rgba(10,132,255,0.18)"
            : "rgba(0,122,255,0.10)"
          : "transparent",
      })}
    >
      <Box sx={{ opacity: 0.9, display: "grid", placeItems: "center", width: 36 }}>
        {icon}
      </Box>
      {!collapsed ? <Typography sx={{ fontWeight: 650 }}>{label}</Typography> : null}
    </NavLink>
  );

  if (!collapsed) return base;

  return (
    <Tooltip title={label} placement="right">
      <Box>{base}</Box>
    </Tooltip>
  );
}

export default function Layout({ children }) {
  const theme = useTheme();
  const themeMode = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const month = useSelector((s) => s.finance.month);
  const hideValues = useSelector(selectHideValues);

  // ✅ auth (reducer registrado como "user" no store)
  const token = useSelector((s) => s.user.token) || localStorage.getItem("authToken") || "";
  const currentUser = useSelector((s) => s.user.user);
  const authStatus = useSelector((s) => s.user.status);

  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

  // ✅ rotas públicas: sem menu/topbar
  const isPublicRoute = useMemo(() => {
    return location.pathname === "/login" || location.pathname === "/register";
  }, [location.pathname]);

  // ✅ auto-colapse
  const [collapsed, setCollapsed] = useState(true);

  // ✅ mobile drawer
  const [mobileOpen, setMobileOpen] = useState(false);

  const [newOpen, setNewOpen] = useState(false);

  const title = useMemo(() => {
    const hit = navItems.find((n) => n.to === location.pathname);
    if (location.pathname === "/") return "Dashboard";
    return hit?.label || "Finance";
  }, [location.pathname]);

  // ✅ Guard de auth + bootstrap do /me
  useEffect(() => {
    if (isPublicRoute) return;

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    // carrega /me
    if (!currentUser && authStatus !== "loading") {
      dispatch(meThunk())
        .unwrap()
        .then(() => {
          dispatch(fetchAccountsThunk());
        })
        .catch(() => { });
      return;
    }

    // se já tem user e ainda não carregou contas
    if (currentUser) {
      dispatch(fetchAccountsThunk());
    }
  }, [isPublicRoute, token, currentUser, authStatus, dispatch, navigate]);


  useEffect(() => {
  dispatch(fetchAllTransactionsThunk());
}, [dispatch]);



  // ✅ em páginas públicas, não renderiza drawer/appbar
  if (isPublicRoute) {
    return <Box sx={{ minHeight: "100vh" }}>{children}</Box>;
  }

  const drawerW = collapsed ? DRAWER_COLLAPSED : DRAWER_EXPANDED;

  const drawerPaperSx = {
    width: drawerW,
    boxSizing: "border-box",
    borderRight: `1px solid ${theme.palette.divider}`,
    overflowX: "hidden",
    transition: theme.transitions.create(["width"], {
      duration: theme.transitions.duration.shortest,
    }),
  };



  function handleLogout() {
    dispatch(logout());
    navigate("/login", { replace: true });
  }


  const DrawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          height: TOP_H,
          px: collapsed ? 1 : 2,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 1,
        }}
      >
        {!collapsed ? (
          <Stack spacing={-0.2}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, letterSpacing: -0.3 }}>
              Yenom Planner
            </Typography>
          </Stack>
        ) : (
          <Typography sx={{ fontWeight: 900, letterSpacing: -0.3 }}>YP</Typography>
        )}

        {isMdUp ? (
          <Tooltip title={collapsed ? "Expandir menu" : "Recolher menu"}>
            <IconButton
              size="small"
              onClick={() => setCollapsed((v) => !v)}
              sx={{ ml: collapsed ? 0 : 1 }}
            >
              {theme.direction === "rtl" ? (
                collapsed ? <ChevronLeftRoundedIcon /> : <ChevronRightRoundedIcon />
              ) : collapsed ? (
                <ChevronRightRoundedIcon />
              ) : (
                <ChevronLeftRoundedIcon />
              )}
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>

      <Divider />

      <Box sx={{ p: collapsed ? 1 : 1.4, display: "flex", flexDirection: "column", gap: 0.8 }}>
        {navItems.map((it) => (
          <NavItem key={it.to} to={it.to} label={it.label} icon={it.icon} collapsed={collapsed} />
        ))}
      </Box>

      <Box sx={{ flex: 1 }} />

      <Box
        sx={{
          p: collapsed ? 1 : 1.6,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {!collapsed ? (
          <Button
            fullWidth
            variant="contained"
            onClick={() => setNewOpen(true)}
            sx={{ borderRadius: 999, height: 40, fontWeight: 800 }}
          >
            + Novo lançamento
          </Button>
        ) : (
          <Tooltip title="Novo lançamento" placement="right">
            <IconButton
              onClick={() => setNewOpen(true)}
              sx={{
                width: "100%",
                borderRadius: 14,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <AddRoundedIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>


      <Divider sx={{ opacity: 0.8 }} />

      <Box sx={{ p: collapsed ? 1 : 1.6 }}>
        {!collapsed ? (
          <Button
            fullWidth
            onClick={handleLogout}
            startIcon={<ExitToAppRoundedIcon />}
            sx={{
              height: 40,
              borderRadius: 999,
              fontWeight: 900,
              justifyContent: "center",
              px: 1.6,
              color: "#dc2626", // vermelho
              border: "1px solid rgba(220,38,38,0.35)",
              bgcolor: "rgba(220,38,38,0.08)",
              "&:hover": {
                bgcolor: "rgba(220,38,38,0.14)",
              },
            }}
          >
            Sair
          </Button>
        ) : (
          <Tooltip title="Sair" placement="right">
            <IconButton
              onClick={handleLogout}
              sx={{
                width: "100%",
                height: 40,
                borderRadius: 14,
                color: "#dc2626",
                border: "1px solid rgba(220,38,38,0.35)",
                bgcolor: "rgba(220,38,38,0.08)",
                "&:hover": {
                  bgcolor: "rgba(220,38,38,0.14)",
                },
              }}
            >
              <ExitToAppRoundedIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>




    </Box>
  );

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      {isMdUp ? (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerW,
            flexShrink: 0,
            "& .MuiDrawer-paper": drawerPaperSx,
          }}
        >
          {DrawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: DRAWER_EXPANDED,
              boxSizing: "border-box",
              borderRight: `1px solid ${theme.palette.divider}`,
            },
          }}
        >
          {DrawerContent}
        </Drawer>
      )}

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <AppBar
          position="sticky"
          color="default"
          elevation={0}
          sx={{
            borderBottom: `1px solid ${theme.palette.divider}`,
            background: theme.palette.background.paper,
          }}
        >
          <Toolbar
            sx={{
              minHeight: TOP_H,
              display: "flex",
              justifyContent: "space-between",
              gap: 1.2,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              {!isMdUp ? (
                <IconButton onClick={() => setMobileOpen(true)} size="small">
                  <MenuRoundedIcon />
                </IconButton>
              ) : null}

              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 900, letterSpacing: -0.2, whiteSpace: "nowrap" }}
              >
                {title}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <DashboardFilters />

              <Stack
                direction="row"
                spacing={0.8}
                alignItems="center"
                sx={{
                  border: (t) => `1px solid ${t.palette.divider}`,
                  borderRadius: 999,
                  px: 0.6,
                  py: 0.35,
                  bgcolor: (t) =>
                    t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                }}
              >
                <Box sx={{ display: { xs: "none", sm: "block" }, minWidth: 150 }}>
                  <MonthPicker value={month} onChange={(v) => dispatch(setMonth(v))} />
                </Box>

                <Box
                  sx={{
                    width: 1,
                    alignSelf: "stretch",
                    bgcolor: (t) => t.palette.divider,
                    mx: 0.2,
                  }}
                />

                <Tooltip title={themeMode.mode === "dark" ? "Modo claro" : "Modo escuro"}>
                  <IconButton
                    onClick={themeMode.toggle}
                    size="small"
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                    }}
                  >
                    {themeMode.mode === "dark" ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
                  </IconButton>
                </Tooltip>

                <Tooltip title={hideValues ? "Mostrar valores" : "Ocultar valores"}>
                  <IconButton
                    size="small"
                    onClick={() => dispatch(toggleHideValues())}
                    sx={(theme) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                      background: alpha(theme.palette.background.paper, 0.7),
                    })}
                  >
                    {hideValues ? (
                      <VisibilityOffRoundedIcon fontSize="small" />
                    ) : (
                      <VisibilityRoundedIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </Stack>

              <Stack direction="row" spacing={0.8} alignItems="center">
                <Button
                  variant="contained"
                  onClick={() => setNewOpen(true)}
                  sx={{
                    height: 36,
                    borderRadius: 999,
                    fontWeight: 850,
                    px: 1.4,
                    whiteSpace: "nowrap",
                    boxShadow: "none",
                  }}
                >
                  + Lançamento
                </Button>
              </Stack>

            </Stack>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: { xs: 1.5, md: 2.5 }, flex: 1, overflow: "auto" }}>{children}</Box>

        <NewTransactionModal open={newOpen} onClose={() => setNewOpen(false)} />
      </Box>
    </Box>
  );
}
