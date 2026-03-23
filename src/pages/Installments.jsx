// src/pages/InstallmentsMatrix.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
  Button,
  Tooltip,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import { alpha } from "@mui/material/styles";

import { formatBRLNegativeValues as formatBRL } from "../utils/money";
import { selectTransactionsUi } from "../store/transactionsSlice";
import { selectAccounts } from "../store/accountsSlice";

/* =========================
   Helpers
========================= */
const OPEN_CARDS_STORAGE_KEY = "installments-matrix-open-cards-v1";

const ymFromAny = (v) => {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
  return s.length >= 7 ? s.slice(0, 7) : s;
};

const ymCompare = (a, b) => (String(a) > String(b) ? 1 : String(a) < String(b) ? -1 : 0);

const ymToParts = (ym) => {
  const s = String(ym || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) };
};

const ymAddMonths = (ym, add) => {
  const p = ymToParts(ym);
  if (!p) return null;

  let y = p.y;
  let m = p.m + add;

  while (m > 12) {
    y += 1;
    m -= 12;
  }
  while (m < 1) {
    y -= 1;
    m += 12;
  }

  return `${y}-${String(m).padStart(2, "0")}`;
};

const ymLabelBR = (ym) => {
  const p = ymToParts(ym);
  if (!p) return ym;
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${monthNames[p.m - 1]}/${String(p.y).slice(2)}`;
};

const safeNumber = (v) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
};

/* =========================
   Regras
========================= */
const isInvoiced = (t) => {
  const st = String(t?.status || "").toLowerCase();
  if (["faturado", "invoiced", "invoice", "closed", 'paid', 'pago'].includes(st)) return true;
  if (t?.invoiced === true || t?.isInvoiced === true) return true;
  if (t?.invoiceId || t?.invoice_id) return true;
  return false;
};

const resolveGroupId = (t) =>
  t?.installment?.groupId ||
  t?.installmentGroupId ||
  t?.installment_group_id ||
  t?.installment?.group_id ||
  null;

const resolveAccountId = (t) =>
  t?.accountId ||
  t?.account_id ||
  t?.cardId ||
  t?.card_id ||
  t?.account?.id ||
  null;

/* =========================
   UI Delta
========================= */
function DeltaMonthInfo({ current, previous, theme }) {
  const delta = safeNumber(current) - safeNumber(previous);
  if (!delta) {
    return (
      <Typography
        variant="caption"
        sx={{
          display: "block",
          mt: 0.15,
          fontSize: 10,
          lineHeight: 1,
          color: "text.disabled",
          opacity: 0.75,
        }}
      >
        —
      </Typography>
    );
  }

  const positive = delta > 0;
  const color = positive ? theme.palette.info.main : theme.palette.error.main;

  return (
    <Typography
      variant="caption"
      sx={{
        display: "block",
        mt: 0.15,
        fontSize: 10,
        lineHeight: 1,
        fontWeight: 900,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {positive ? "" : ""}
      {formatBRL(delta)}
    </Typography>
  );
}

export default function InstallmentsMatrix() {
  const theme = useTheme();
  const txns = useSelector(selectTransactionsUi);
  const accounts = useSelector(selectAccounts);

  const [monthsAhead, setMonthsAhead] = useState(18);
  const [hideInvoiced, setHideInvoiced] = useState(true);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);

  // Accordion cartões
  const [openCards, setOpenCards] = useState({});
  const didHydrateOpenCardsRef = useRef(false);

  const accountsById = useMemo(() => {
    const m = new Map();
    for (const a of Array.isArray(accounts) ? accounts : []) {
      if (!a?.id) continue;
      m.set(String(a.id), a);
    }
    return m;
  }, [accounts]);

  const model = useMemo(() => {
    const list = Array.isArray(txns) ? txns : [];

    const installments = list.filter((t) => {
      if (t?.kind !== "installment") return false;
      const gid = resolveGroupId(t);
      if (!gid) return false;
      const ym = ymFromAny(t?.invoiceMonth || t?.invoice_month);
      if (!ym) return false;
      return true;
    });

    const groupsMap = new Map();
    for (const t of installments) {
      const gid = resolveGroupId(t);
      if (!gid) continue;
      if (!groupsMap.has(gid)) groupsMap.set(gid, []);
      groupsMap.get(gid).push(t);
    }

    const groups = Array.from(groupsMap.entries()).map(([groupId, arr]) => {
      const sorted = arr.slice().sort((a, b) => ymCompare(ymFromAny(a?.invoiceMonth), ymFromAny(b?.invoiceMonth)));
      const openItems = sorted.filter((x) => !isInvoiced(x));
      const remainingOpen = openItems.length;
      const first = sorted[0];

      const accountId = resolveAccountId(first);
      const acc = accountId != null ? accountsById.get(String(accountId)) : null;

      const accountName = acc?.name || acc?.nickname || acc?.label || (accountId != null ? String(accountId) : "Cartão");
      const tint = acc?.tint || acc?.color || "rgba(0,0,0,0.06)";

      const byMonth = new Map();
      for (const t of sorted) {
        if (hideInvoiced && isInvoiced(t)) continue;
        const ym = ymFromAny(t?.invoiceMonth || t?.invoice_month);
        const v = safeNumber(t?.amount);
        if (!ym || !v) continue;
        byMonth.set(ym, (byMonth.get(ym) || 0) + v);
      }

      const total = sorted.reduce((acc2, x) => acc2 + safeNumber(x?.amount), 0);

      const totalParts =
        first?.installment?.total ??
        first?.installmentTotal ??
        first?.installment_total ??
        sorted.length;

      const invoicedCount = arr.reduce((n, x) => n + (isInvoiced(x) ? 1 : 0), 0);
      const remainingParts = Math.max(0, safeNumber(totalParts) - safeNumber(invoicedCount));

      return {
        groupId,
        accountId,
        remainingOpen,
        openCount: remainingOpen,
        closedCount: sorted.length - remainingOpen,
        accountName,
        tint,
        merchant: first?.merchant || first?.description || "Parcelamento",
        total,
        totalParts,
        installmentsCount: sorted.length,
        remainingParts,
        byMonth,
        firstMonth: ymFromAny(sorted[0]?.invoiceMonth),
        lastMonth: ymFromAny(sorted[sorted.length - 1]?.invoiceMonth),
        items: sorted,
      };
    });

    const byAccount = new Map();
    for (const g of groups) {
      const k = g.accountId ?? "—";
      if (!byAccount.has(k)) byAccount.set(k, []);
      byAccount.get(k).push(g);
    }

    const cardsOut = Array.from(byAccount.entries()).map(([accountId, arr]) => {
      const groupsSorted = arr
        .slice()
        .sort((a, b) =>
          safeNumber(a.remainingOpen) - safeNumber(b.remainingOpen) ||
          safeNumber(b.total) - safeNumber(a.total) ||
          ymCompare(a.firstMonth, b.firstMonth)
        );

      const total = groupsSorted.reduce((acc2, x) => acc2 + safeNumber(x.total), 0);

      const accountName = groupsSorted[0]?.accountName || (accountId != null ? String(accountId) : "Cartão");
      const tint = groupsSorted[0]?.tint || "rgba(0,0,0,0.06)";
      const groupsCount = groupsSorted.length;

      const totalsByMonth = new Map();
      for (const g of groupsSorted) {
        for (const [ym, v] of g.byMonth.entries()) {
          totalsByMonth.set(ym, (totalsByMonth.get(ym) || 0) + safeNumber(v));
        }
      }

      const minMonth = groupsSorted.reduce(
        (min, g) => (!min || (g.firstMonth && ymCompare(g.firstMonth, min) < 0) ? g.firstMonth : min),
        ""
      );

      return {
        accountId,
        accountName,
        tint,
        groups: groupsSorted,
        total,
        minMonth,
        groupsCount,
        totalsByMonth,
      };
    });

    cardsOut.sort((a, b) => safeNumber(b.total) - safeNumber(a.total));

    const globalMin = cardsOut.reduce(
      (min, c) => (!min || (c.minMonth && ymCompare(c.minMonth, min) < 0) ? c.minMonth : min),
      ""
    );

    const globalTotalsByMonth = new Map();
    for (const c of cardsOut) {
      for (const [ym, v] of c.totalsByMonth.entries()) {
        globalTotalsByMonth.set(ym, (globalTotalsByMonth.get(ym) || 0) + safeNumber(v));
      }
    }

    const totalAll = cardsOut.reduce((acc2, c) => acc2 + safeNumber(c.total), 0);

    return {
      cardsOut,
      globalMinMonth: globalMin || "",
      totalGroups: groups.length,
      totalInstallments: installments.length,
      totalAll,
      globalTotalsByMonth,
    };
  }, [txns, hideInvoiced, accountsById]);

  /* =========================
     sessionStorage open/close
  ========================= */
  useEffect(() => {
    const cardKeys = model.cardsOut.map((c) => String(c.accountId ?? "—"));

    if (!didHydrateOpenCardsRef.current) {
      let saved = {};
      try {
        const raw = sessionStorage.getItem(OPEN_CARDS_STORAGE_KEY);
        saved = raw ? JSON.parse(raw) : {};
      } catch {
        saved = {};
      }

      const hydrated = {};
      for (const key of cardKeys) {
        hydrated[key] = typeof saved[key] === "boolean" ? saved[key] : true;
      }

      setOpenCards(hydrated);
      didHydrateOpenCardsRef.current = true;
      return;
    }

    setOpenCards((prev) => {
      const next = {};
      for (const key of cardKeys) {
        next[key] = typeof prev[key] === "boolean" ? prev[key] : true;
      }

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const sameSize = prevKeys.length === nextKeys.length;
      const sameValues = sameSize && nextKeys.every((k) => prev[k] === next[k]);

      return sameValues ? prev : next;
    });
  }, [model.cardsOut]);

  useEffect(() => {
    if (!didHydrateOpenCardsRef.current) return;
    try {
      sessionStorage.setItem(OPEN_CARDS_STORAGE_KEY, JSON.stringify(openCards));
    } catch {
      // noop
    }
  }, [openCards]);

  const months = useMemo(() => {
    const allMonths = Array.from(model.globalTotalsByMonth.keys()).sort(ymCompare);

    return allMonths;
  }, [model.globalTotalsByMonth]);

  const openGroupDrawer = (g) => {
    setActiveGroup(g || null);
    setDrawerOpen(true);
  };

  const closeGroupDrawer = () => setDrawerOpen(false);

  const toggleCard = (accountId) => {
    const key = String(accountId ?? "—");
    setOpenCards((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const setAllCards = (open) => {
    const next = {};
    for (const c of model.cardsOut) {
      next[String(c.accountId ?? "—")] = open;
    }
    setOpenCards(next);
  };

  const drawerSummary = useMemo(() => {
    const g = activeGroup;
    if (!g) return null;

    const byMonth = new Map();
    for (const t of g.items || []) {
      const ym = ymFromAny(t?.invoiceMonth || t?.invoice_month);
      const v = safeNumber(t?.amount);
      if (!ym || !v) continue;
      byMonth.set(ym, (byMonth.get(ym) || 0) + v);
    }
    const monthsSorted = Array.from(byMonth.keys()).sort(ymCompare);
    return { byMonth, monthsSorted };
  }, [activeGroup]);

  /* =========================
     Sticky + grid
  ========================= */
  const HEADER_ROW_H = 44;
  const TOP_ROW1 = 0;
  const TOP_ROW2 = HEADER_ROW_H;
  const TOP_CARD = HEADER_ROW_H * 2;

  const dividerDot = alpha(theme.palette.divider, theme.palette.mode === "dark" ? 0.75 : 0.95);
  const dashedRight = (isLastMonthCol) => (isLastMonthCol ? "none" : `1px dotted ${dividerDot}`);

  const solidBg = (overlay) => `linear-gradient(${overlay}, ${overlay}), ${theme.palette.background.paper}`;

  const headerMonthsBg = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.35 : 0.16);
  const headerTotalsBg = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.48 : 0.22);
  const headerTextColor = theme.palette.mode === "dark" ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.86)";

  const stickyHeaderSx = (top, bg, extra = {}) => ({
    position: "sticky",
    top,
    zIndex: 120,
    background: solidBg(bg),
    color: headerTextColor,
    ...extra,
  });

  const stickyFirstColSx = (extra = {}) => ({
    position: "sticky",
    left: 0,
    zIndex: 200,
    background: theme.palette.background.paper,
    ...extra,
  });

  const stickyCardRowSx = (extra = {}) => ({
    position: "sticky",
    top: TOP_CARD,
    zIndex: 110,
    ...extra,
  });

  const tableViewportH = "calc(100vh - 165px)";
  const FIRST_COL_W = 280;

  return (
    <>
      <Stack spacing={2} sx={{ minHeight: "calc(100vh - 120px)" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Stack spacing={0.2}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {model.totalGroups} parcelamentos • {model.totalInstallments} parcelas • total geral:{" "}
              <span style={{ fontWeight: 900 }}>{formatBRL(model.totalAll)}</span>
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip
              size="small"
              label={hideInvoiced ? "Somente não faturadas" : "Inclui faturadas"}
              variant={hideInvoiced ? "filled" : "outlined"}
              onClick={() => setHideInvoiced((v) => !v)}
              sx={{ fontWeight: 900 }}
            />

            <Chip
              size="small"
              label="Abrir todos"
              variant="outlined"
              onClick={() => setAllCards(true)}
              sx={{ fontWeight: 900 }}
            />

            <Chip
              size="small"
              label="Fechar todos"
              variant="outlined"
              onClick={() => setAllCards(false)}
              sx={{ fontWeight: 900 }}
            />

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                horizonte:
              </Typography>
              {[12, 18, 24].map((n) => (
                <Chip
                  key={n}
                  label={`${n}m`}
                  size="small"
                  variant={monthsAhead === n ? "filled" : "outlined"}
                  onClick={() => setMonthsAhead(n)}
                  sx={{ fontWeight: 800 }}
                />
              ))}
            </Stack>
          </Stack>
        </Stack>

        {model.cardsOut.length === 0 ? (
          <Card>
            <CardContent>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Nenhum parcelamento encontrado.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Card sx={{ overflow: "hidden", flex: 1 }}>
            <CardContent sx={{ p: 0, height: "100%" }}>
              <Box
                sx={{
                  overflow: "auto",
                  height: tableViewportH,
                  width: "100%",
                }}
              >
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    minWidth: 980,
                    borderCollapse: "separate",
                    borderSpacing: 0,
                    tableLayout: "auto",
                  }}
                >
                  <TableHead>
                    <TableRow sx={{ height: HEADER_ROW_H }}>
                      <TableCell
                        sx={{
                          ...stickyFirstColSx({
                            width: FIRST_COL_W,
                            minWidth: FIRST_COL_W,
                            maxWidth: FIRST_COL_W,
                            fontWeight: 950,
                          }),
                          ...stickyHeaderSx(TOP_ROW1, headerMonthsBg, {
                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                          }),
                          zIndex: 300,
                        }}
                      >
                        Cartão / Parcelamento
                      </TableCell>

                      {months.map((ym, idx) => (
                        <TableCell
                          key={ym}
                          align="right"
                          sx={stickyHeaderSx(TOP_ROW1, headerMonthsBg, {
                            fontWeight: 900,
                            whiteSpace: "nowrap",
                            borderRight: dashedRight(idx === months.length - 1),
                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                          })}
                        >
                          {ymLabelBR(ym)}
                        </TableCell>
                      ))}

                      <TableCell
                        align="right"
                        sx={stickyHeaderSx(TOP_ROW1, headerMonthsBg, {
                          fontWeight: 980,
                          whiteSpace: "nowrap",
                          borderLeft: `1px dotted ${dividerDot}`,
                          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                        })}
                      >
                        Total
                      </TableCell>
                    </TableRow>

                    <TableRow sx={{ height: HEADER_ROW_H }}>
                      <TableCell
                        sx={{
                          ...stickyFirstColSx({
                            width: FIRST_COL_W,
                            minWidth: FIRST_COL_W,
                            maxWidth: FIRST_COL_W,
                            fontWeight: 950,
                          }),
                          ...stickyHeaderSx(TOP_ROW2, headerTotalsBg, {
                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                          }),
                          zIndex: 300,
                        }}
                      >
                        TOTAL GERAL
                      </TableCell>

                      {months.map((ym, idx) => {
                        const current = safeNumber(model.globalTotalsByMonth.get(ym) || 0);
                        const previousYm = ymAddMonths(ym, -1);
                        const previous = safeNumber(model.globalTotalsByMonth.get(previousYm) || 0);

                        return (
                          <TableCell
                            key={ym}
                            align="right"
                            sx={stickyHeaderSx(TOP_ROW2, headerTotalsBg, {
                              fontWeight: 980,
                              whiteSpace: "nowrap",
                              borderRight: dashedRight(idx === months.length - 1),
                              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                              verticalAlign: "top",
                            })}
                          >
                            <Typography sx={{ fontWeight: 980, fontSize: 13, lineHeight: 1.1 }}>
                              {current ? formatBRL(current) : ""}
                            </Typography>
                            <DeltaMonthInfo current={current} previous={previous} theme={theme} />
                          </TableCell>
                        );
                      })}

                      <TableCell
                        align="right"
                        sx={stickyHeaderSx(TOP_ROW2, headerTotalsBg, {
                          fontWeight: 999,
                          whiteSpace: "nowrap",
                          borderLeft: `1px dotted ${dividerDot}`,
                          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                        })}
                      >
                        {formatBRL(model.totalAll)}
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {model.cardsOut.map((c) => {
                      const cardKey = String(c.accountId ?? "—");
                      const isOpen = openCards[cardKey] !== false;

                      return (
                        <React.Fragment key={cardKey}>
                          <TableRow>
                            <TableCell
                              sx={{
                                ...stickyFirstColSx({
                                  width: FIRST_COL_W,
                                  minWidth: FIRST_COL_W,
                                  maxWidth: FIRST_COL_W,
                                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                                  py: 1,
                                }),
                                ...stickyCardRowSx(),
                                zIndex: 250,
                                background: solidBg(alpha(c.tint, theme.palette.mode === "dark" ? 0.3 : 0.18)),
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                  sx={{ minWidth: 0, overflow: "hidden" }}
                                >
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleCard(c.accountId);
                                    }}
                                    sx={{ p: 0.25, flexShrink: 0 }}
                                  >
                                    {isOpen ? <KeyboardArrowDownRoundedIcon /> : <KeyboardArrowRightRoundedIcon />}
                                  </IconButton>

                                  <Box
                                    sx={{
                                      width: 12,
                                      height: 12,
                                      borderRadius: 999,
                                      background: c.tint,
                                      border: `1px solid ${alpha(theme.palette.text.primary, 0.16)}`,
                                      flexShrink: 0,
                                    }}
                                  />

                                  <Tooltip title={c.accountName}>
                                    <Typography
                                      sx={{
                                        fontWeight: 980,
                                        minWidth: 0,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {c.accountName}
                                    </Typography>
                                  </Tooltip>

                                  <Chip
                                    size="small"
                                    label={`${c.groupsCount} Compras`}
                                    variant="outlined"
                                    sx={{ fontWeight: 850, opacity: 0.92, flexShrink: 0 }}
                                  />
                                </Stack>
                              </Stack>
                            </TableCell>

                            {months.map((ym, idx) => {
                              const current = safeNumber(c.totalsByMonth.get(ym) || 0);
                              const previousYm = ymAddMonths(ym, -1);
                              const previous = safeNumber(c.totalsByMonth.get(previousYm) || 0);

                              return (
                                <TableCell
                                  key={ym}
                                  align="right"
                                  sx={{
                                    ...stickyCardRowSx({
                                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                                      borderRight: dashedRight(idx === months.length - 1),
                                    }),
                                    whiteSpace: "nowrap",
                                    background: solidBg(alpha(c.tint, theme.palette.mode === "dark" ? 0.24 : 0.14)),
                                    verticalAlign: "top",
                                  }}
                                >
                                  <Typography sx={{ fontWeight: 980, fontSize: 13, lineHeight: 1.1 }}>
                                    {current ? formatBRL(current) : ""}
                                  </Typography>
                                  <DeltaMonthInfo current={current} previous={previous} theme={theme} />
                                </TableCell>
                              );
                            })}

                            <TableCell
                              align="right"
                              sx={{
                                ...stickyCardRowSx({
                                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                                  borderLeft: `1px dotted ${dividerDot}`,
                                }),
                                fontWeight: 999,
                                whiteSpace: "nowrap",
                                background: solidBg(alpha(c.tint, theme.palette.mode === "dark" ? 0.24 : 0.14)),
                              }}
                            >
                              {formatBRL(c.total)}
                            </TableCell>
                          </TableRow>

                          {isOpen &&
                            c.groups.map((g) => (
                              <TableRow
                                key={g.groupId}
                                hover
                                onClick={() => openGroupDrawer(g)}
                                sx={{
                                  cursor: "pointer",
                                  "&:hover td": { background: alpha(theme.palette.primary.main, 0.03) },
                                }}
                              >
                                <TableCell
                                  sx={{
                                    ...stickyFirstColSx({
                                      width: FIRST_COL_W,
                                      minWidth: FIRST_COL_W,
                                      maxWidth: FIRST_COL_W,
                                    }),
                                  }}
                                >
                                  <Stack spacing={0.2} sx={{ minWidth: 0 }}>
                                    <Typography
                                      sx={{
                                        fontWeight: 950,
                                        lineHeight: 1.15,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {g.merchant}{" "}
                                      <span style={{ opacity: 0.65, fontWeight: 900 }}>• {g.totalParts}x</span>
                                    </Typography>
                                  </Stack>
                                </TableCell>

                                {months.map((ym, idx) => {
                                  const v = safeNumber(g.byMonth.get(ym) || 0);

                                  if (!v) {
                                    return (
                                      <TableCell
                                        key={ym}
                                        align="right"
                                        sx={{
                                          opacity: 0.25,
                                          borderRight: dashedRight(idx === months.length - 1),
                                        }}
                                      />
                                    );
                                  }

                                  return (
                                    <TableCell
                                      key={ym}
                                      align="right"
                                      sx={{
                                        fontWeight: 950,
                                        whiteSpace: "nowrap",
                                        background: alpha(c.tint, 0.1),
                                        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.65)}`,
                                        borderRight: dashedRight(idx === months.length - 1),
                                      }}
                                    >
                                      {formatBRL(v)}
                                    </TableCell>
                                  );
                                })}

                                <TableCell
                                  align="right"
                                  sx={{
                                    fontWeight: 980,
                                    whiteSpace: "nowrap",
                                    borderLeft: `1px dotted ${dividerDot}`,
                                  }}
                                >
                                  {formatBRL(g.total)}
                                </TableCell>
                              </TableRow>
                            ))}

                          <TableRow>
                            <TableCell colSpan={months.length + 2} sx={{ p: 0 }}>
                              <Divider />
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>

              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Delta mensal exibido nas linhas de totais. Estado aberto/fechado salvo por sessão.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}
      </Stack>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeGroupDrawer}
        PaperProps={{ sx: { width: { xs: "100%", sm: 440 }, maxWidth: "100vw" } }}
      >
        <Box sx={{ p: 2 }}>
          <Stack spacing={1.2}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
              <Stack spacing={0.2}>
                <Typography sx={{ fontWeight: 980, letterSpacing: -0.2 }}>
                  {activeGroup?.merchant || "Parcelamento"}{" "}
                  {activeGroup?.totalParts ? (
                    <span style={{ opacity: 0.65, fontWeight: 900 }}>• {activeGroup.totalParts}x</span>
                  ) : null}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {activeGroup?.accountName || "Cartão"} • {ymLabelBR(activeGroup?.firstMonth)} →{" "}
                  {ymLabelBR(activeGroup?.lastMonth)}
                </Typography>
              </Stack>

              <IconButton onClick={closeGroupDrawer}>
                <CloseRoundedIcon />
              </IconButton>
            </Stack>

            <Divider />

            {activeGroup ? (
              <Stack spacing={0.8}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Total do grupo
                  </Typography>
                  <Typography sx={{ fontWeight: 980 }}>{formatBRL(safeNumber(activeGroup.total))}</Typography>
                </Stack>

                {drawerSummary ? (
                  <Box
                    sx={{
                      mt: 1,
                      border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 950 }}>Mês</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 950 }}>
                            Valor
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {drawerSummary.monthsSorted.map((ym) => (
                          <TableRow key={ym}>
                            <TableCell sx={{ whiteSpace: "nowrap" }}>{ymLabelBR(ym)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 900, whiteSpace: "nowrap" }}>
                              {formatBRL(safeNumber(drawerSummary.byMonth.get(ym) || 0))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                ) : null}

                <Divider sx={{ my: 0.5 }} />

                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button disabled variant="outlined">
                    Cancelar futuras
                  </Button>
                  <Button disabled variant="outlined">
                    Editar grupo
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Selecione um parcelamento na tabela.
              </Typography>
            )}
          </Stack>
        </Box>
      </Drawer>
    </>
  );
}