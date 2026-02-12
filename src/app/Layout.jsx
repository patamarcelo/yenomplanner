import React, { useMemo, useState, useEffect, useRef } from "react";
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

import NewTransactionModal from "../components/NewTransactionModal";
import { useThemeMode } from "../theme";

import { useSelector, useDispatch } from "react-redux";
import { setMonth } from "../store/financeSlice.js";

import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import { toggleHideValues, selectHideValues } from "../store/uiSlice";
import { alpha } from "@mui/material/styles";

import DashboardFilters from "../components/DashboardFilters.jsx";
import { meThunk, logout } from "../store/authSlice";

import ExitToAppRoundedIcon from "@mui/icons-material/ExitToAppRounded";
import { fetchAccountsThunk } from "../store/accountsSlice.js";
import { fetchAllTransactionsThunk } from "../store/transactionsSlice.js";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";

import { selectTransactionsUi } from "../store/transactionsSlice.js";
import { selectBills } from "../store/billsSlice.js";

const DRAWER_EXPANDED = 270;
const DRAWER_COLLAPSED = 76;
const TOP_H = 64;

const navItems = [
  { to: "/", label: "Dashboard", icon: <DashboardRoundedIcon /> },
  { to: "/contas", label: "Contas", icon: <AccountBalanceRoundedIcon /> },
  { to: "/despesas", label: "Despesas", icon: <PaymentsRoundedIcon /> },
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

function pad2(n) {
  return String(n).padStart(2, "0");
}

function getDefaultYM() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${pad2(m)}`;
}

function parseYM(ym) {
  // ym esperado: "YYYY-MM"
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

export default function Layout({ children }) {
  const theme = useTheme();
  const themeMode = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const month = useSelector((s) => s.finance.month); // "YYYY-MM"
  const hideValues = useSelector(selectHideValues);

  // ✅ auth (reducer registrado como "user" no store)
  const token = useSelector((s) => s.user.token) || localStorage.getItem("authToken") || "";
  const currentUser = useSelector((s) => s.user.user);
  const authStatus = useSelector((s) => s.user.status);

  const transactionsUi = useSelector(selectTransactionsUi);
  const bills = useSelector(selectBills);


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

  // ✅ evita re-fetch em loop (Layout re-renderiza bastante)
  const bootstrappedRef = useRef(false);

  // ✅ garante "YYYY-MM" válido (ano atual por padrão)
  useEffect(() => {
    if (isPublicRoute) return;
    if (!month) {
      dispatch(setMonth(getDefaultYM()));
      return;
    }
    // se estiver inválido, normaliza
    const { y, m } = parseYM(month);
    const normalized = `${y}-${pad2(m)}`;
    if (normalized !== month) dispatch(setMonth(normalized));
  }, [month, dispatch, isPublicRoute]);

  // ✅ Guard de auth + bootstrap do /me + carregar dados (somente logado)
  useEffect(() => {
    // rota pública: não faz nada
    if (isPublicRoute) {
      bootstrappedRef.current = false; // quando sair e voltar, permite bootstrap de novo
      return;
    }

    // sem token: manda login e não busca nada
    if (!token) {
      bootstrappedRef.current = false;
      navigate("/login", { replace: true });
      return;
    }

    // já bootstrapou nesta sessão do Layout? evita disparar de novo
    if (bootstrappedRef.current) return;

    // se não tem usuário ainda, carrega /me primeiro
    if (!currentUser && authStatus !== "loading") {
      dispatch(meThunk())
        .unwrap()
        .then(() => {
          bootstrappedRef.current = true;
        })
        .catch(() => {
          bootstrappedRef.current = false;
          dispatch(logout());
          navigate("/login", { replace: true });
        });

      return;
    }

    // se já tem usuário, carrega dados direto
    if (currentUser) {
      dispatch(fetchAccountsThunk());
      dispatch(fetchAllTransactionsThunk());
      bootstrappedRef.current = true;
    }
  }, [isPublicRoute, token, currentUser, authStatus, dispatch, navigate]);

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
    bootstrappedRef.current = false;
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
          position: "relative",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            width: "100%",
            minWidth: 0,
          }}
        >
          {!collapsed ? (
            <Box
              component="img"
              src="/assets/image/banner-1.png"
              alt="Yenom Planner"
              sx={{
                height: 64,
                width: "100%",
                maxWidth: 190,
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
              sx={(theme) => ({
                position: "absolute",
                right: 4,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: theme.zIndex.drawer + 20,
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: "background.paper",
                boxShadow: 3,
                border: "1px solid",
                borderColor: "divider",
                transition: "all .2s ease",
                opacity: 0.85,
                "&:hover": {
                  backgroundColor: "background.default",
                },
              })}
            >
              {theme.direction === "rtl" ? (
                collapsed ? <ChevronLeftRoundedIcon fontSize="small" /> : <ChevronRightRoundedIcon fontSize="small" />
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
              color: "#dc2626",
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

  // ✅ valores atuais do filtro
  const { y: selectedYear, m: selectedMonth } = parseYM(month || getDefaultYM());
  const currentYear = new Date().getFullYear();

  function extractYear(v) {
    if (!v) return null;

    // aceita Date
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v.getFullYear();

    const s = String(v).trim();
    if (!s) return null;

    // YYYY-MM / YYYY-MM-DD / YYYY...
    const m = s.match(/^(\d{4})/);
    if (!m) return null;

    const y = Number(m[1]);
    if (!Number.isFinite(y) || y < 1900 || y > 2500) return null;
    return y;
  }

  function collectYearsFromObject(obj) {
    if (!obj || typeof obj !== "object") return [];

    // tenta os campos mais prováveis (bills e transactions)
    const candidates = [
      obj.invoiceMonth,
      obj.invoice_month,
      obj.purchaseDate,
      obj.purchase_date,
      obj.chargeDate,
      obj.charge_date,
      obj.dueDate,
      obj.due_date,
      obj.date,
      obj.createdAt,
      obj.created_at,
      obj.paidAt,
      obj.paid_at,
      obj.month,
      obj.year, // se existir
    ];

    const out = [];
    for (const c of candidates) {
      const y = extractYear(c);
      if (y) out.push(y);
    }

    // caso raro: year numérico já vindo pronto
    if (typeof obj.year === "number" && Number.isFinite(obj.year)) out.push(obj.year);

    return out;
  }

  const years = useMemo(() => {
    // ✅ base fixa
    const base = [2025, 2026];
    const set = new Set(base);

    // ✅ anos vindos de transactions
    (transactionsUi || []).forEach((t) => {
      collectYearsFromObject(t).forEach((y) => set.add(y));
    });

    // ✅ anos vindos de bills
    (bills || []).forEach((b) => {
      collectYearsFromObject(b).forEach((y) => set.add(y));
    });

    // ✅ garante ano atualmente selecionado
    set.add(selectedYear);

    // ordena
    return Array.from(set).sort((a, b) => a - b);
  }, [transactionsUi, bills, selectedYear]);


  const pillSx = {
    border: (t) => `1px solid ${t.palette.divider}`,
    borderRadius: 999,
    px: 1,
    py: 0.35,
    bgcolor: (t) =>
      t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
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
              {location.pathname === "/" && <DashboardFilters />}

              {/* ✅ filtros separados: Mês e Ano */}
              <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: "none", sm: "flex" } }}>
                <Box sx={{ ...pillSx, minWidth: 120 }}>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={selectedMonth}
                      onChange={(e) => setYM(selectedYear, e.target.value)}
                      sx={selectSx}
                    >
                      {MONTHS_PT.map((mm) => (
                        <MenuItem key={mm.value} value={mm.value}>
                          {mm.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Box sx={{ ...pillSx, minWidth: 110 }}>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={selectedYear}
                      onChange={(e) => setYM(e.target.value, selectedMonth)}
                      sx={selectSx}
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

              {/* ✅ ações separadas (modo + eye) */}
              <Stack direction="row" spacing={0.6} alignItems="center" sx={pillSx}>
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
            </Stack>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: { xs: 1.5, md: 2.5 }, flex: 1, overflow: "auto" }}>{children}</Box>

        <NewTransactionModal open={newOpen} onClose={() => setNewOpen(false)} />
      </Box>
    </Box>
  );
}
