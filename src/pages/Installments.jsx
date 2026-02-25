// src/pages/InstallmentsMatrix.jsx
import React, { useMemo, useState } from "react";
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
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { alpha } from "@mui/material/styles";

import { formatBRLNegativeValues as formatBRL } from "../utils/money";
import { selectTransactionsUi } from "../store/transactionsSlice";
import { selectAccounts } from "../store/accountsSlice";

/* =========================
   Helpers
========================= */
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
   Regra: sai da visão se estiver FATURADO
========================= */
const isInvoiced = (t) => {
  const st = String(t?.status || "").toLowerCase();
  if (["faturado", "invoiced", "invoice", "closed"].includes(st)) return true;
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

export default function InstallmentsMatrix() {
  const theme = useTheme();
  const txns = useSelector(selectTransactionsUi);
  const accounts = useSelector(selectAccounts);

  const [monthsAhead, setMonthsAhead] = useState(18);
  const [hideInvoiced, setHideInvoiced] = useState(true);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);

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
      if (hideInvoiced && isInvoiced(t)) return false;
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
      const first = sorted[0];

      const accountId = resolveAccountId(first);
      const acc = accountId != null ? accountsById.get(String(accountId)) : null;

      const accountName = acc?.name || acc?.nickname || acc?.label || (accountId != null ? String(accountId) : "Cartão");
      const tint = acc?.tint || acc?.color || "rgba(0,0,0,0.06)";

      const byMonth = new Map();
      for (const t of sorted) {
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

      return {
        groupId,
        accountId,
        accountName,
        tint,
        merchant: first?.merchant || first?.description || "Parcelamento",
        total,
        totalParts,
        installmentsCount: sorted.length,
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
        .sort((a, b) => safeNumber(b.total) - safeNumber(a.total) || ymCompare(a.firstMonth, b.firstMonth));

      const total = groupsSorted.reduce((acc2, x) => acc2 + safeNumber(x.total), 0);

      const accountName = groupsSorted[0]?.accountName || (accountId != null ? String(accountId) : "Cartão");
      const tint = groupsSorted[0]?.tint || "rgba(0,0,0,0.06)";

      const groupsCount = groupsSorted.length;
      const installmentsCount = groupsSorted.reduce((acc2, g) => acc2 + (g.installmentsCount || 0), 0);

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
        installmentsCount,
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

  const months = useMemo(() => {
    const start = model.globalMinMonth || ymFromAny(new Date().toISOString());
    const out = [];
    for (let i = 0; i < monthsAhead; i++) {
      const ym = ymAddMonths(start, i);
      if (ym) out.push(ym);
    }
    return out;
  }, [model.globalMinMonth, monthsAhead]);

  const openGroupDrawer = (g) => {
    setActiveGroup(g || null);
    setDrawerOpen(true);
  };
  const closeGroupDrawer = () => setDrawerOpen(false);

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
  const HEADER_ROW_H = 44; // Travamos a altura exata em 44px
  const TOP_ROW1 = 0;
  const TOP_ROW2 = HEADER_ROW_H;
  const TOP_CARD = HEADER_ROW_H * 2; // O cartão entra exatamente após os 88px dos headers

  const dividerDot = alpha(theme.palette.divider, theme.palette.mode === "dark" ? 0.75 : 0.95);
  const dashedRight = (isLastMonthCol) => (isLastMonthCol ? "none" : `1px dotted ${dividerDot}`);

  // Helper de fundo opaco
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
    // Removido: backgroundClip: "padding-box" para fechar a fresta na borda
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

  return (
    <>
      <Stack spacing={2} sx={{ minHeight: "calc(100vh - 120px)" }}>
        {/* Header */}
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
                  }}
                >
                  <TableHead>
                    {/* Linha 1: meses */}
                    <TableRow sx={{ height: HEADER_ROW_H }}>
                      {/* INTERSEÇÃO TOPO-ESQUERDA 1: Header da 1ª coluna sticky */}
                      <TableCell
                        sx={{
                          ...stickyFirstColSx({ minWidth: 380, fontWeight: 950 }),
                          ...stickyHeaderSx(TOP_ROW1, headerMonthsBg, {
                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                          }),
                          zIndex: 300, // Força sobreposição nos eixos X e Y
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

                    {/* Linha 2: total geral */}
                    <TableRow sx={{ height: HEADER_ROW_H }}>
                      {/* INTERSEÇÃO TOPO-ESQUERDA 2: Total Geral */}
                      <TableCell
                        sx={{
                          ...stickyFirstColSx({ fontWeight: 950 }),
                          ...stickyHeaderSx(TOP_ROW2, headerTotalsBg, {
                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                          }),
                          zIndex: 300, // Força sobreposição nos eixos X e Y
                        }}
                      >
                        TOTAL GERAL
                      </TableCell>

                      {months.map((ym, idx) => {
                        const v = safeNumber(model.globalTotalsByMonth.get(ym) || 0);
                        return (
                          <TableCell
                            key={ym}
                            align="right"
                            sx={stickyHeaderSx(TOP_ROW2, headerTotalsBg, {
                              fontWeight: 980,
                              whiteSpace: "nowrap",
                              borderRight: dashedRight(idx === months.length - 1),
                              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                            })}
                          >
                            {v ? formatBRL(v) : ""}
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
                    {model.cardsOut.map((c) => (
                      <React.Fragment key={String(c.accountId)}>
                        {/* Linha do cartão sticky ao encostar */}
                        <TableRow>
                          {/* INTERSEÇÃO CARTÃO-ESQUERDA: Célula de identificação do cartão */}
                          <TableCell
                            sx={{
                              ...stickyFirstColSx({
                                minWidth: 380,
                                // borderTop: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                                py: 1.0,
                              }),
                              ...stickyCardRowSx(),
                              zIndex: 250, // Maior que a primeira coluna (200), menor que os cabeçalhos (300)
                              background: solidBg(alpha(c.tint, theme.palette.mode === "dark" ? 0.30 : 0.18)),
                            }}
                          >
                            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                <Box
                                  sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 999,
                                    background: c.tint,
                                    border: `1px solid ${alpha(theme.palette.text.primary, 0.16)}`,
                                  }}
                                />
                                <Typography sx={{ fontWeight: 980 }}>{c.accountName}</Typography>
                                <Chip
                                  size="small"
                                  label={`${c.groupsCount} parcelamentos`}
                                  variant="outlined"
                                  sx={{ fontWeight: 850, opacity: 0.92 }}
                                />
                                <Chip
                                  size="small"
                                  label={`${c.installmentsCount} parcelas`}
                                  variant="outlined"
                                  sx={{ fontWeight: 850, opacity: 0.92 }}
                                />
                              </Stack>
                            </Stack>
                          </TableCell>

                          {months.map((ym, idx) => {
                            const v = safeNumber(c.totalsByMonth.get(ym) || 0);
                            return (
                              <TableCell
                                key={ym}
                                align="right"
                                sx={{
                                  ...stickyCardRowSx({
                                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                                    borderRight: dashedRight(idx === months.length - 1),
                                  }),
                                  fontWeight: 980,
                                  whiteSpace: "nowrap",
                                  background: solidBg(alpha(c.tint, theme.palette.mode === "dark" ? 0.24 : 0.14)),
                                }}
                              >
                                {v ? formatBRL(v) : ""}
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

                        {/* Linhas dos parcelamentos (grupos) */}
                        {c.groups.map((g) => (
                          <TableRow
                            key={g.groupId}
                            hover
                            onClick={() => openGroupDrawer(g)}
                            sx={{
                              cursor: "pointer",
                              "&:hover td": { background: alpha(theme.palette.primary.main, 0.03) },
                            }}
                          >
                            {/* COLUNA NOMES STICKY (horizontal padrão) */}
                            <TableCell
                              sx={{
                                ...stickyFirstColSx({ minWidth: 380 }),
                              }}
                            >
                              <Stack spacing={0.2}>
                                <Typography sx={{ fontWeight: 950, lineHeight: 1.15 }}>
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
                                    background: alpha(c.tint, 0.10),
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

                        {/* separador */}
                        <TableRow>
                          <TableCell colSpan={months.length + 2} sx={{ p: 0 }}>
                            <Divider />
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </Box>

              <Box sx={{ px: 2, py: 1.0 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Headers opacos • coluna de nomes sticky • cartões sticky ao encostar no topo.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}
      </Stack>

      {/* Drawer de detalhes do grupo */}
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