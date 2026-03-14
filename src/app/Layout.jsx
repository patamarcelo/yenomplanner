// src/layouts/Layout.jsx
import React, { useMemo, useState, useEffect, useRef, lazy, Suspense, useCallback } from "react";
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
  FormControl,
  Select,
  MenuItem,
  Fab,
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

import { useThemeMode } from "../theme";

import { useSelector, useDispatch } from "react-redux";
import { setMonth } from "../store/financeSlice.js";

import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import { toggleHideValues, selectHideValues } from "../store/uiSlice";
import { alpha } from "@mui/material/styles";

import { meThunk, logout, selectAuthUser } from "../store/authSlice";
import { bootstrapThunk } from "../store/bootstrapThunk";

import ExitToAppRoundedIcon from "@mui/icons-material/ExitToAppRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";

import { Toaster } from "react-hot-toast";
import { trackEvent } from "../utils/analytics.js";

const NewTransactionModal = lazy(() => import("../components/NewTransactionModal"));

const DRAWER_EXPANDED = 230;
const DRAWER_COLLAPSED = 76;
const TOP_H = 64;
const BOOTSTRAP_REFRESH_MS = 45 * 1000;

const navItems = [
  { to: "/", label: "Dashboard", icon: <DashboardRoundedIcon />, color: "#3b82f6" },
  { to: "/contas", label: "Contas", icon: <AccountBalanceRoundedIcon />, color: "#22c55e" },
  { to: "/despesas", label: "Despesas", icon: <PaymentsRoundedIcon />, color: "#f59e0b" },
  { to: "/lancamentos", label: "Lançamentos", icon: <CreditCardRoundedIcon />, color: "#a855f7" },
  { to: "/faturas", label: "Faturas", icon: <ReceiptLongRoundedIcon />, color: "#ef4444" },
  { to: "/parcelamentos", label: "Parcelamentos", icon: <ViewWeekRoundedIcon />, color: "#06b6d4" },
  { to: "/cadastros", label: "Cadastros", icon: <SettingsRoundedIcon />, color: "#64748b" },
];

function NavItem({ to, label, icon, collapsed, color, onClick, isMobile }) {
  const theme = useTheme();
  const isRoot = to === "/";

  return (
    <NavLink
      to={to}
      end={isRoot}
      onClick={onClick}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: collapsed ? 0 : isMobile ? 8 : 10,
        padding: collapsed
          ? "10px 10px"
          : isMobile
            ? "9px 10px"
            : "10px 12px",
        borderRadius: 14,
        color: theme.palette.text.primary,
        textDecoration: "none",
        background: isActive
          ? theme.palette.mode === "dark"
            ? "rgba(10,132,255,0.18)"
            : "rgba(0,122,255,0.10)"
          : "transparent",
        transition: "all .18s ease",
      })}
    >
      {({ isActive }) => (
        <>
          <Box
            sx={{
              display: "grid",
              placeItems: "center",
              width: isMobile ? 32 : 36,
              minWidth: isMobile ? 32 : 36,
              color,
              transition: "all .18s ease",
              transform: isActive ? "scale(1.15)" : "scale(1)",
              filter: isActive ? "saturate(1.4)" : "saturate(0.9)",
              textShadow:
                isActive && theme.palette.mode === "dark"
                  ? `0 0 8px ${color}`
                  : "none",
              "& .MuiSvgIcon-root": {
                fontSize: isMobile ? 20 : 22,
              },
            }}
          >
            {icon}
          </Box>

          {!collapsed && (
            <Typography
              sx={{
                fontWeight: isActive ? 800 : 650,
                transition: "all .18s ease",
                fontSize: isMobile ? 14 : 15,
                lineHeight: 1.15,
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </Typography>
          )}
        </>
      )}
    </NavLink>
  );
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function getDefaultYM() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${pad2(m)}`;
}

const LS_FINANCE_YM_KEY = "yp.finance.filterYM";

function readStoredYM() {
  try {
    const v = localStorage.getItem(LS_FINANCE_YM_KEY);
    return v ? String(v) : "";
  } catch {
    return "";
  }
}

function writeStoredYM(ym) {
  try {
    if (ym) localStorage.setItem(LS_FINANCE_YM_KEY, String(ym));
  } catch {
    // ignore
  }
}

function parseYM(ym) {
  if (!ym || typeof ym !== "string" || !ym.includes("-")) {
    const def = getDefaultYM();
    const [y0, m0] = def.split("-");
    return { y: Number(y0), m: Number(m0) };
  }
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!y || !m || m < 1 || m > 12) {
    const def = getDefaultYM();
    const [y0, m0] = def.split("-");
    return { y: Number(y0), m: Number(m0) };
  }
  return { y, m };
}

const MONTHS_PT = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Fev" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Abr" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Ago" },
  { value: 9, label: "Set" },
  { value: 10, label: "Out" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dez" },
];

function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    if (window.gtag) {
      window.gtag("event", "page_view", {
        page_path: location.pathname,
      });
    }
  }, [location]);
}

export default function Layout({ children }) {
  usePageTracking();

  const theme = useTheme();
  const themeMode = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(selectAuthUser);

  const month = useSelector((s) => s.finance.month);
  const hideValues = useSelector(selectHideValues);

  const token = useSelector((s) => s.user.token) || localStorage.getItem("authToken") || "";
  const currentUser = useSelector((s) => s.user.user);
  const authStatus = useSelector((s) => s.user.status);

  const bootstrapStatus = useSelector((s) => s.bootstrap?.status || "idle");
  const bootstrapLastLoadedAt = useSelector((s) => s.bootstrap?.lastLoadedAt || null);

  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const isPublicRoute = useMemo(() => {
    const PUBLIC_ROUTES = ["/login", "/register", "/reset-password"];
    return PUBLIC_ROUTES.includes(location.pathname);
  }, [location.pathname]);

  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const title = useMemo(() => {
    if (location.pathname === "/") return "Dashboard";

    const sorted = [...navItems].sort((a, b) => b.to.length - a.to.length);
    const hit = sorted.find((n) => location.pathname === n.to || location.pathname.startsWith(n.to + "/"));

    if (location.pathname.startsWith("/cadastros/categorias")) return "Categorias";

    return hit?.label || "Finance";
  }, [location.pathname]);

  const activeNav = useMemo(() => {
    const sorted = [...navItems].sort((a, b) => b.to.length - a.to.length);
    return sorted.find((n) => location.pathname === n.to || location.pathname.startsWith(n.to + "/"));
  }, [location.pathname]);

  const activeIcon = location.pathname.startsWith("/cadastros") ? activeNav?.icon : null;

  const bootstrapInFlightRef = useRef(false);

  useEffect(() => {
    if (!isMdUp) setMobileOpen(false);
  }, [location.pathname, isMdUp]);

  const { y: selectedYear, m: selectedMonth } = parseYM(month || getDefaultYM());

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return [now - 1, now, now + 1];
  }, []);

  useEffect(() => {
    if (isPublicRoute) return;
    if (month) return;

    const stored = readStoredYM();
    const candidate = stored || getDefaultYM();

    const { y, m } = parseYM(candidate);
    const normalized = `${y}-${pad2(m)}`;

    dispatch(setMonth(normalized));
  }, [isPublicRoute, month, dispatch]);

  useEffect(() => {
    if (isPublicRoute) return;
    if (!month) return;

    const { y, m } = parseYM(month);
    const normalized = `${y}-${pad2(m)}`;

    if (normalized !== month) {
      dispatch(setMonth(normalized));
      return;
    }

    writeStoredYM(month);
  }, [isPublicRoute, month, dispatch]);

  const runBootstrap = useCallback(
    async ({ force = false } = {}) => {
      if (isPublicRoute) return;
      if (!token) return;
      if (!currentUser) return;
      if (bootstrapInFlightRef.current) return;
      if (bootstrapStatus === "loading") return;

      if (!force && bootstrapLastLoadedAt) {
        const elapsed = Date.now() - bootstrapLastLoadedAt;
        if (elapsed < BOOTSTRAP_REFRESH_MS) return;
      }

      bootstrapInFlightRef.current = true;

      try {
        await dispatch(bootstrapThunk()).unwrap();
      } catch (err) {
        console.error("Erro no bootstrap:", err);
      } finally {
        bootstrapInFlightRef.current = false;
      }
    },
    [
      isPublicRoute,
      token,
      currentUser,
      bootstrapStatus,
      bootstrapLastLoadedAt,
      dispatch,
    ]
  );

  useEffect(() => {
    if (isPublicRoute) return;

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    if (!currentUser && authStatus === "loading") return;

    if (!currentUser && authStatus !== "loading") {
      dispatch(meThunk())
        .unwrap()
        .catch(() => {
          dispatch(logout());
          navigate("/login", { replace: true });
        });
    }
  }, [isPublicRoute, token, currentUser, authStatus, dispatch, navigate]);

  useEffect(() => {
    if (!currentUser) return;

    if (bootstrapStatus === "idle" || bootstrapStatus === "failed") {
      runBootstrap({ force: true });
    }
  }, [currentUser, bootstrapStatus, runBootstrap]);

  useEffect(() => {
    if (!currentUser || isPublicRoute) return;

    const isDashboardRoute = location.pathname === "/";
    const isTransactionsRoute = location.pathname.startsWith("/lancamentos");

    if (isDashboardRoute || isTransactionsRoute) {
      runBootstrap();
    }
  }, [currentUser, isPublicRoute, location.pathname, runBootstrap]);

  useEffect(() => {
    if (isPublicRoute) return;

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && currentUser) {
        runBootstrap();
      }
    }

    function handleFocus() {
      if (currentUser) {
        runBootstrap();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isPublicRoute, currentUser, runBootstrap]);

  if (isPublicRoute) {
    return <Box sx={{ minHeight: "100vh" }}>{children}</Box>;
  }

  const drawerW = collapsed ? DRAWER_COLLAPSED : DRAWER_EXPANDED;
  const effectiveCollapsed = isMdUp ? collapsed : false;

  const drawerPaperSx = {
    width: drawerW,
    boxSizing: "border-box",
    borderRight: `1px solid ${theme.palette.divider}`,
    overflowX: "hidden",
    borderRadius: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    transition: theme.transitions.create(["width"], {
      duration: theme.transitions.duration.shortest,
    }),
  };

  function handleLogout() {
    setNewOpen(false);
    setMobileOpen(false);

    dispatch(logout());
    dispatch({ type: "app/reset" });

    trackEvent("logout_clicked");

    navigate("/login", { replace: true });
  }

  const DrawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4800,
          style: { borderRadius: "12px", marginTop: "-5px" },
          success: {
            style: {
              background: "rgba(34, 197, 94, 0.14)",
              color: "#052e16",
              border: "1px solid rgba(34, 197, 94, 0.65)",
            },
            iconTheme: { primary: "#16a34a", secondary: "#dcfce7" },
          },
          error: {
            style: {
              background: "rgba(239, 68, 68, 0.14)",
              color: "#450a0a",
              border: "1px solid rgba(239, 68, 68, 0.35)",
            },
            iconTheme: { primary: "#dc2626", secondary: "#fee2e2" },
          },
        }}
      />

      <Box
        sx={{
          height: TOP_H,
          px: effectiveCollapsed ? 1 : isMobile ? 1.4 : 2,
          display: "flex",
          alignItems: "center",
          justifyContent: effectiveCollapsed ? "center" : "space-between",
          gap: 1,
          position: "relative",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: effectiveCollapsed ? "center" : "flex-start",
            width: "100%",
            minWidth: 0,
          }}
        >
          {!effectiveCollapsed ? (
            <Box
              component="img"
              src="/assets/image/banner-1.png"
              alt="Yenom Planner"
              sx={{
                height: isMobile ? 58 : 64,
                width: "100%",
                maxWidth: isMobile ? 172 : 190,
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <Box
              component="img"
              src="/assets/image/LOGO-0.png"
              alt="YP"
              sx={{
                marginRight: "20px",
                height: 54,
                width: 54,
                objectFit: "contain",
                display: "block",
              }}
            />
          )}
        </Box>

        {isMdUp ? (
          <Tooltip title={collapsed ? "Expandir menu" : "Recolher menu"}>
            <IconButton
              size="small"
              onClick={() => setCollapsed((v) => !v)}
              sx={(t) => ({
                position: "absolute",
                right: 4,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: t.zIndex.drawer + 20,
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: "background.paper",
                boxShadow: 3,
                border: "1px solid",
                borderColor: "divider",
                transition: "all .2s ease",
                opacity: 0.85,
                "&:hover": { backgroundColor: "background.default" },
              })}
            >
              {theme.direction === "rtl" ? (
                collapsed ? (
                  <ChevronLeftRoundedIcon fontSize="small" />
                ) : (
                  <ChevronRightRoundedIcon fontSize="small" />
                )
              ) : collapsed ? (
                <ChevronRightRoundedIcon fontSize="small" />
              ) : (
                <ChevronLeftRoundedIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>

      <Divider />

      <Box
        sx={{
          p: effectiveCollapsed ? 1 : isMobile ? 1.15 : 1.4,
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? 0.55 : 0.8,
        }}
      >
        {navItems.map((it) => (
          <NavItem
            key={it.to}
            to={it.to}
            label={it.label}
            icon={it.icon}
            color={it.color}
            collapsed={effectiveCollapsed}
            isMobile={isMobile}
            onClick={() => {
              if (!isMdUp) setMobileOpen(false);
            }}
          />
        ))}
      </Box>

      <Box sx={{ flex: 1 }} />

      <Box sx={{ p: effectiveCollapsed ? 1 : isMobile ? 1.15 : 1.6, display: "flex", flexDirection: "column", gap: 1 }}>
        {!effectiveCollapsed ? (
          <Button
            fullWidth
            variant="contained"
            onClick={() => setNewOpen(true)}
            sx={{
              borderRadius: 999,
              height: isMobile ? 38 : 40,
              fontWeight: 800,
              fontSize: isMobile ? 13 : 14,
            }}
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

      <Box sx={{ p: effectiveCollapsed ? 1 : isMobile ? 1.15 : 1.6 }}>
        {!effectiveCollapsed ? (
          <Button
            fullWidth
            onClick={handleLogout}
            startIcon={<ExitToAppRoundedIcon />}
            sx={{
              height: isMobile ? 38 : 40,
              borderRadius: 999,
              fontWeight: 900,
              fontSize: isMobile ? 13 : 14,
              justifyContent: "center",
              px: 1.6,
              color: "#dc2626",
              border: "1px solid rgba(220,38,38,0.35)",
              bgcolor: "rgba(220,38,38,0.08)",
              "&:hover": { bgcolor: "rgba(220,38,38,0.14)" },
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
                "&:hover": { bgcolor: "rgba(220,38,38,0.14)" },
              }}
            >
              <ExitToAppRoundedIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );

  const pillSx = {
    border: (t) => `1px solid ${t.palette.divider}`,
    borderRadius: 999,
    px: 1,
    py: 0.35,
    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
  };

  const selectSx = {
    "& .MuiSelect-select": {
      py: 0.55,
      px: 1,
      fontWeight: 800,
      fontSize: 13,
      display: "flex",
      alignItems: "center",
    },
    "& fieldset": { border: "none" },
  };

  function setYM(nextYear, nextMonth) {
    const next = `${Number(nextYear)}-${pad2(Number(nextMonth))}`;
    dispatch(setMonth(next));
  }

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
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            },
          }}
        >
          {DrawerContent}
        </Drawer>
      )}

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
        <AppBar
          position="sticky"
          color="default"
          elevation={0}
          sx={{
            borderBottom: `1px solid ${theme.palette.divider}`,
            background: theme.palette.background.paper,
            borderRadius: "0px",
          }}
        >
          <Toolbar
            sx={{
              minHeight: TOP_H,
              display: "flex",
              justifyContent: "space-between",
              gap: { xs: 0.8, sm: 1.2 },
              px: { xs: 1, sm: 2 },
            }}
          >
            <Stack
              direction="row"
              spacing={{ xs: 0.75, sm: 1 }}
              alignItems="center"
              sx={{
                minWidth: 0,
                flex: 1,
                pr: { xs: 1.1, sm: 1.5 },
                overflow: "hidden",
              }}
            >
              {!isMdUp ? (
                <IconButton onClick={() => setMobileOpen(true)} size="small" sx={{ flexShrink: 0 }}>
                  <MenuRoundedIcon />
                </IconButton>
              ) : null}

              {activeIcon ? (
                <Box
                  sx={(t) => ({
                    width: { xs: 30, sm: 34 },
                    height: { xs: 30, sm: 34 },
                    borderRadius: { xs: 10, sm: 12 },
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    bgcolor: alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.12 : 0.08),
                    border: `1px solid ${alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.28 : 0.18)}`,
                    "& .MuiSvgIcon-root": { fontSize: { xs: 17, sm: 18 } },
                  })}
                >
                  {activeIcon}
                </Box>
              ) : null}

              <Stack
                spacing={0.1}
                sx={{
                  lineHeight: 1.05,
                  minWidth: 0,
                  maxWidth: { xs: "calc(100vw - 220px)", sm: "none" },
                  overflow: "hidden",
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 600,
                    opacity: 0.72,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontSize: { xs: 11, sm: 13 },
                    lineHeight: 1.05,
                  }}
                >
                  Olá, {user?.first_name} 👋
                </Typography>

                <Typography
                  sx={{
                    fontWeight: 900,
                    letterSpacing: { xs: -0.25, sm: -0.4 },
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontSize: { xs: 16, sm: 20 },
                    lineHeight: 1.05,
                  }}
                >
                  {title}
                </Typography>
              </Stack>
            </Stack>

            <Stack
              direction="row"
              spacing={{ xs: 0.55, sm: 1 }}
              alignItems="center"
              sx={{
                minWidth: 0,
                flexShrink: 0,
                pl: { xs: 0.5, sm: 0 },
              }}
            >
              {location.pathname === "/" && (
                <Stack
                  direction="row"
                  spacing={0.8}
                  alignItems="center"
                  sx={{
                    minWidth: 0,
                    flexShrink: 0,
                  }}
                >
                  <Box
                    sx={{
                      ...pillSx,
                      minWidth: { xs: 84, sm: 120 },
                      px: { xs: 0.35, sm: 1 },
                    }}
                  >
                    <FormControl size="small" fullWidth>
                      <Select
                        value={selectedMonth}
                        onChange={(e) => setYM(selectedYear, e.target.value)}
                        sx={{
                          ...selectSx,
                          "& .MuiSelect-select": {
                            py: { xs: 0.42, sm: 0.55 },
                            px: { xs: 0.65, sm: 1 },
                            fontWeight: 800,
                            fontSize: { xs: 11.5, sm: 13 },
                            display: "flex",
                            alignItems: "center",
                          },
                        }}
                      >
                        {MONTHS_PT.map((mm) => (
                          <MenuItem key={mm.value} value={mm.value}>
                            {mm.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  <Box
                    sx={{
                      ...pillSx,
                      minWidth: { xs: 72, sm: 110 },
                      px: { xs: 0.35, sm: 1 },
                    }}
                  >
                    <FormControl size="small" fullWidth>
                      <Select
                        value={selectedYear}
                        onChange={(e) => setYM(e.target.value, selectedMonth)}
                        sx={{
                          ...selectSx,
                          "& .MuiSelect-select": {
                            py: { xs: 0.42, sm: 0.55 },
                            px: { xs: 0.65, sm: 1 },
                            fontWeight: 800,
                            fontSize: { xs: 11.5, sm: 13 },
                            display: "flex",
                            alignItems: "center",
                          },
                        }}
                      >
                        {years.map((yy) => (
                          <MenuItem key={yy} value={yy}>
                            {yy}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                </Stack>
              )}

              <Stack
                direction="row"
                spacing={0.6}
                alignItems="center"
                sx={(t) => ({
                  ...pillSx,
                  px: { xs: 0.35, sm: 0.6 },
                  py: 0.35,
                  gap: { xs: 0.2, sm: 0.4 },

                  "& .hideValuesBtn": {
                    width: 0,
                    minWidth: 0,
                    padding: 0,
                    margin: 0,
                    opacity: 0,
                    overflow: "hidden",
                    pointerEvents: "none",
                    transition: "all .18s ease",
                  },

                  "&:hover .hideValuesBtn": {
                    width: 22,
                    minWidth: 22,
                    opacity: 1,
                    pointerEvents: "auto",
                  },

                  [t.breakpoints.down("sm")]: {
                    "& .hideValuesBtn": {
                      width: 22,
                      minWidth: 22,
                      opacity: 1,
                      pointerEvents: "auto",
                    },
                  },
                })}
              >
                {(() => {
                  const btnSx = (t) => ({
                    width: { xs: 29, sm: 32 },
                    height: { xs: 29, sm: 32 },
                    borderRadius: 999,
                    color: "text.secondary",
                    transition: "all .16s ease",
                    "&:hover": {
                      bgcolor: alpha(t.palette.text.primary, t.palette.mode === "dark" ? 0.08 : 0.06),
                      color: "text.primary",
                    },
                    "& .MuiSvgIcon-root": { fontSize: { xs: 17, sm: 18 } },
                  });

                  const dangerBtnSx = (t) => ({
                    width: { xs: 29, sm: 32 },
                    height: { xs: 29, sm: 32 },
                    borderRadius: 999,
                    color: t.palette.error.main,
                    transition: "all .16s ease",
                    "&:hover": { bgcolor: alpha(t.palette.error.main, t.palette.mode === "dark" ? 0.16 : 0.10) },
                    "& .MuiSvgIcon-root": { fontSize: { xs: 17, sm: 18 } },
                  });

                  return (
                    <>
                      <Tooltip title={themeMode.mode === "dark" ? "Modo claro" : "Modo escuro"}>
                        <IconButton onClick={themeMode.toggle} size="small" sx={btnSx}>
                          {themeMode.mode === "dark" ? (
                            <LightModeRoundedIcon fontSize="small" />
                          ) : (
                            <DarkModeRoundedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={hideValues ? "Mostrar valores" : "Ocultar valores"}>
                        <IconButton
                          size="small"
                          onClick={() => dispatch(toggleHideValues())}
                          sx={btnSx}
                          className="hideValuesBtn"
                        >
                          {hideValues ? (
                            <VisibilityOffRoundedIcon fontSize="small" />
                          ) : (
                            <VisibilityRoundedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>

                      <Box
                        sx={(t) => ({
                          width: 1,
                          height: { xs: 16, sm: 18 },
                          mx: { xs: 0.1, sm: 0.2 },
                          bgcolor: alpha(t.palette.divider, 0.9),
                        })}
                      />

                      <Tooltip title="Sair">
                        <IconButton size="small" onClick={handleLogout} sx={dangerBtnSx}>
                          <ExitToAppRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  );
                })()}
              </Stack>
            </Stack>
          </Toolbar>
        </AppBar>

        <Box
          sx={{
            flex: 1,
            overflow: "auto",
            width: "100%",
            minWidth: 0,
            px: { xs: 1, md: 2 },
            py: { xs: 1.0, md: 1.5 },
            pb: { xs: "calc(env(safe-area-inset-bottom, 0px) + 88px)", md: 2 },
          }}
        >
          {children}
        </Box>

        {!isPublicRoute && isMobile && !newOpen ? (
          <Fab
            color="primary"
            aria-label="Novo lançamento"
            onClick={() => setNewOpen(true)}
            sx={(t) => ({
              position: "fixed",
              right: 16,
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
              zIndex: t.zIndex.speedDial,
              width: 58,
              height: 58,
              borderRadius: "50%",
              fontWeight: 900,
              boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
            })}
          >
            <AddRoundedIcon />
          </Fab>
        ) : null}

        {newOpen ? (
          <Suspense fallback={null}>
            <NewTransactionModal open={newOpen} onClose={() => setNewOpen(false)} />
          </Suspense>
        ) : null}
      </Box>
    </Box>
  );
}
