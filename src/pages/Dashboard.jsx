// src/pages/Dashboard.jsx
import React, { useMemo, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Box,
  Card,
  CardContent,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";


import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ViewWeekRoundedIcon from "@mui/icons-material/ViewWeekRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList
} from "recharts";

import { formatBRL } from "../utils/money";
import { formatMonthBR, formatDateBR } from "../utils/dateBR";
// import { categories } from "../data/mockCategories";
import { selectHideValues } from "../store/uiSlice";

import { selectTransactionsUi } from "../store/transactionsSlice";
import { bootstrapThunk } from "../store/bootstrapThunk";
import { selectCategories } from "../store/categoriesSlice";
import Spinner from "../components/ui/Spinner"
// -----------------------------
// Helpers
// -----------------------------
function cardBg(theme, color = "primary") {
  const base = theme.palette[color]?.main || theme.palette.primary.main;
  return {
    borderRadius: 2,
    border: `1px solid ${alpha(base, 0.25)}`,
    background: `linear-gradient(180deg,
      ${alpha(base, 0.08)} 0%,
      ${theme.palette.background.paper} 45%
    )`,
    boxShadow: "0 12px 40px rgba(0,0,0,0.07)",
    overflow: "hidden",
    minWidth: 0,
  };
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// direction real: income|expense
function signedAmount(t) {
  const raw = Number(t?.amount || 0);
  const abs = Math.abs(raw);
  if (raw < 0) return raw;

  const dir = String(t?.direction || "").toLowerCase();
  if (dir === "income" || dir === "entrada") return abs;
  if (dir === "expense" || dir === "despesa" || dir === "saida" || dir === "saída") return -abs;

  // legado: se não souber, assume despesa
  return -abs;
}

function resolvedDirection(t) {
  const d = String(t?.direction || "").toLowerCase();
  if (d === "income" || d === "expense") return d;
  return signedAmount(t) < 0 ? "expense" : "income";
}

function isInstallment(t) {
  const k = String(t?.kind || "").toLowerCase();
  return k === "installment" || k === "parcelado" || k === "parcela";
}

function normalizeISODate(d) {
  if (!d) return "";

  if (d instanceof Date && !isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  const s = String(d);

  if (s.includes("T")) return s.slice(0, 10);

  if (s.includes("/")) {
    const [dd, mm, yy] = s.split("/");
    if (yy && mm && dd) {
      return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }

  return s.slice(0, 10);
}

function ymFromISODate(d) {
  const iso = normalizeISODate(d);
  return iso ? iso.slice(0, 7) : "";
}

function dayFromISODate(d) {
  const iso = normalizeISODate(d);
  if (!iso) return null;
  const n = Number(iso.slice(8, 10));
  return Number.isFinite(n) ? n : null;
}

function dueDateISO(monthYM, dueDay) {
  if (!monthYM) return "";
  const [y, m] = String(monthYM).split("-").map(Number);
  if (!y || !m) return "";
  const d = clamp(Number(dueDay || 1), 1, 31);
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function normalizeStatus(s) {
  const v = String(s || "").toLowerCase();
  if (v === "confirmado" || v === "confirmed") return "confirmed";
  if (v === "previsto" || v === "planned") return "planned";
  if (v === "pago" || v === "paid") return "paid";
  if (v === "atrasado" || v === "overdue") return "overdue";
  return v || "";
}

function normalizeDirectionFromTxn(t) {
  const d = String(t?.direction || "").toLowerCase();
  if (d === "income" || d === "receita" || d === "entrada") return "income";
  if (d === "expense" || d === "despesa" || d === "saida" || d === "saída") return "expense";

  // legado: se não tem direction, assume despesa
  // (se você quiser, podemos inferir por categoria depois)
  return "expense";
}

function signedAmountNormalized(t) {
  const v = Number(t?.amount || 0);
  const abs = Math.abs(v);

  // respeita negativo legado
  if (v < 0) return v;

  const dir = normalizeDirectionFromTxn(t);
  return dir === "income" ? abs : -abs;
}


function KpiCard({ title, value, subtitle, icon: Icon, tone = "neutral" }) {
  return (
    <Card
      sx={(theme) => {
        const tones = {
          good: theme.palette.success.main,
          bad: theme.palette.error.main,
          info: theme.palette.info.main,
          neutral: theme.palette.text.primary,
        };
        const accent = tones[tone] || tones.neutral;

        return {
          height: "100%",
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          overflow: "hidden",
          position: "relative",
          "&:before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${alpha(accent, 0.10)}, transparent 55%)`,
            pointerEvents: "none",
          },
        };
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
          <Stack spacing={0.45} sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
              {title}
            </Typography>

            <Typography
              variant="h5"
              sx={{
                fontWeight: 950,
                letterSpacing: -0.4,
                lineHeight: 1.1,
                wordBreak: "break-word",
              }}
            >
              {value}
            </Typography>

            {subtitle ? (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {subtitle}
              </Typography>
            ) : null}
          </Stack>

          {Icon ? (
            <Box
              sx={(theme) => ({
                width: 38,
                height: 38,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                background: alpha(theme.palette.background.paper, 0.7),
              })}
            >
              <Icon fontSize="small" />
            </Box>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

function BRLTooltip({ label, payload }) {
  const v = payload?.[0]?.value ?? 0;
  return (
    <Card sx={{ borderRadius: 2, border: "1px solid rgba(255,255,255,0.10)" }}>
      <CardContent sx={{ p: 1.1 }}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Dia {label}
        </Typography>
        <Typography sx={{ fontWeight: 900 }}>{formatBRL(v)}</Typography>
      </CardContent>
    </Card>
  );
}

// -----------------------------
// Dashboard
// -----------------------------
export default function Dashboard() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const month = useSelector((s) => s.finance.month);
  const txns = useSelector(selectTransactionsUi);
  const accounts = useSelector((s) => s.accounts.accounts);
  const extraFilters = useSelector((s) => s.finance.filters);



  const hideValues = useSelector(selectHideValues);
  const categories = useSelector(selectCategories); // exemplo


  const maskMoney = (formatted) => (hideValues ? "••••" : formatted);
  const maskNumber = (n) => (hideValues ? "••" : String(n));
  console.log('hide values', hideValues)

  const accountsById = useMemo(() => {
    const map = new Map();
    for (const a of accounts || []) map.set(a.id, a);
    return map;
  }, [accounts]);

  // escolha um sinal de “já carregou”
  const accountsStatus = useSelector((s) => s.accounts.status);
  const txStatus = useSelector((s) => s.transactions.status);

  useEffect(() => {
    // se já carregou, não faz de novo
    const alreadyLoaded = accountsStatus === "succeeded" && txStatus === "succeeded";
    if (alreadyLoaded) return;

    dispatch(bootstrapThunk());
  }, [dispatch, accountsStatus, txStatus]);

  // Resolve conta/cartão do lançamento (suporta legado `cardId`)
  const resolveAccountIdFromTxn = useMemo(() => {
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[\W_]+/g, "");




    const creditCards = (accounts || []).filter((a) => a.type === "credit_card");
    const byName = new Map();
    for (const a of creditCards) byName.set(norm(a.name), a.id);

    return (t) => {
      if (t?.accountId && accountsById.get(t.accountId)) return t.accountId;

      const cid = norm(t?.cardId);
      if (!cid) return null;

      if (byName.has(cid)) return byName.get(cid);

      for (const [k, id] of byName.entries()) {
        if (k.includes(cid) || cid.includes(k)) return id;
      }
      return null;
    };
  }, [accounts, accountsById]);



  // aplica filtros do header (multi-select) — com suporte a cardId legado
  const filteredTxns = useMemo(() => {
    let out = txns || [];
    const f = extraFilters || {};

    if (f.accountIds?.length) {
      out = out.filter((t) => {
        const rid = resolveAccountIdFromTxn(t);
        return rid ? f.accountIds.includes(rid) : false;
      });
    }

    if (f.categoryIds?.length) {
      out = out.filter((t) => f.categoryIds.includes(String(t.categoryId)));
    }

    if (f.kinds?.length) {
      out = out.filter((t) => f.kinds.includes(String(t.kind)));
    }

    if (f.directions?.length) {
      out = out.filter((t) => f.directions.includes(resolvedDirection(t)));
    }

    return out;
  }, [txns, extraFilters, resolveAccountIdFromTxn]);

  // ✅ REGRAS (como você definiu):
  // Card 1 e Card 2 e Chart: mês por PURCHASE DATE

  const monthTx = useMemo(() => {
    if (!month) return filteredTxns || []; // se usar "" como Todos
    return (filteredTxns || []).filter((t) => String(t?.invoiceMonth || "") === String(month));
  }, [filteredTxns, month]);

  const monthTxPurchase = useMemo(() => {
    if (!month) return filteredTxns || [];
    return (filteredTxns || []).filter((t) => ymFromISODate(t?.purchaseDate) === month);
  }, [filteredTxns, month]);

  // Card 3 (Faturas): mês por INVOICE MONTH
  const monthTxInvoice = useMemo(() => {
    if (!month) return filteredTxns || [];
    return (filteredTxns || []).filter((t) => String(t?.invoiceMonth || "") === String(month));
  }, [filteredTxns, month]);

  const isCardTxn = (t) => {
    const rid = resolveAccountIdFromTxn(t);
    if (!rid) return false;
    const acc = accountsById.get(rid);
    return acc?.type === "credit_card";
  };

  // -----------------------------
  // KPIs (purchaseDate)
  // -----------------------------
  // Entradas no mês (invoiceMonth)
  const totalEntradaMes = useMemo(() => {
    return sum((monthTx || []).map((t) => Math.max(0, signedAmountNormalized(t))));
  }, [monthTx]);

  // Saídas no mês (invoiceMonth)
  const totalSaidaMes = useMemo(() => {
    return Math.abs(sum((monthTx || []).map((t) => Math.min(0, signedAmountNormalized(t)))));
  }, [monthTx]);

  // Somente cartões (saídas + entradas se algum dia tiver estorno/receita em cartão)
  const totalCartoesMes = useMemo(() => {
    return sum(
      (monthTx || [])
        .filter((t) => isCardTxn(t)) // sua função que resolve accountId/cardId
        .map((t) => Math.abs(signedAmountNormalized(t)))
    );
  }, [monthTx, isCardTxn]);

  // Despesas mensais = saídas (mantém semântica simples)
  // Despesas mensais = somente recorrentes (kind === "recurring")
  const totalDespesasMensais = useMemo(() => {
    return sum(
      (monthTx || [])
        .filter((t) => normalizeDirectionFromTxn(t) === "expense")
        .filter((t) => String(t?.kind || "").toLowerCase() === "recurring")
        .map((t) => Math.abs(signedAmountNormalized(t)))
    );
  }, [monthTx]);


  // Total parcelamento (somente despesas parceladas)
  const totalParcelamento = useMemo(() => {
    return sum(
      (monthTx || [])
        .filter((t) => isInstallment(t))
        .filter((t) => normalizeDirectionFromTxn(t) === "expense")
        .map((t) => Math.abs(signedAmountNormalized(t)))
    );
  }, [monthTx]);

  // Total avulso (somente despesas não parceladas)
  const totalAvulso = useMemo(() => {
    return sum(
      (monthTx || [])
        .filter((t) => normalizeDirectionFromTxn(t) === "expense")
        .filter((t) => String(t?.kind || "").toLowerCase() === "one_off")
        .map((t) => Math.abs(signedAmountNormalized(t)))
    );
  }, [monthTx]);





  // -----------------------------
  // Chart (purchaseDate) — somando TODAS as despesas do mês
  // label = dia (1..31)
  // -----------------------------
  const chartData = useMemo(() => {
    if (!month) return [];
    const [y, m] = String(month).split("-").map(Number);
    if (!y || !m) return [];

    const daysInMonth = new Date(y, m, 0).getDate();
    const byDay = new Map();
    for (let d = 1; d <= daysInMonth; d++) byDay.set(d, 0);

    for (const t of monthTx || []) {
      if (resolvedDirection(t) !== "expense") continue;

      // compra do item que está nesta fatura
      const dnum = dayFromISODate(t?.purchaseDate) || 1;

      // atenção: se purchaseDate for de outro mês, ele cai em "1" (ou some)
      // pra não distorcer, melhor não forçar:
      // if (ymFromISODate(t?.purchaseDate) !== month) continue;

      if (!dnum || !byDay.has(dnum)) continue;
      byDay.set(dnum, byDay.get(dnum) + Math.abs(signedAmount(t)));
    }

    return Array.from(byDay.entries()).map(([day, value]) => ({
      day,
      label: String(day),
      value: Number(Number(value || 0).toFixed(2)),
    }));
  }, [month, monthTx]);


  const maxChartValue = useMemo(() => {
    return Math.max(0, ...(chartData || []).map((d) => Number(d.value || 0)));
  }, [chartData]);

  // -----------------------------
  // Categorias (purchaseDate)
  // -----------------------------
  const categoriesRank = useMemo(() => {
    const map = new Map(); // categoryId -> totalAbs

    for (const t of monthTx || []) {
      if (resolvedDirection(t) !== "expense") continue;

      const cid = String(t?.categoryId || "outros");
      map.set(cid, (map.get(cid) || 0) + Math.abs(signedAmount(t)));
    }

    const rows = Array.from(map.entries())
      .map(([categoryId, total]) => {
        const cat = (categories || []).find((c) => String(c.id) === String(categoryId));
        return {
          categoryId,
          name: cat?.name || "Outros",
          total: Number(Number(total || 0).toFixed(2)),
          tint: cat?.tint || cat?.color || "rgba(120,120,120,1)",
        };
      })
      .sort((a, b) => b.total - a.total);

    const totalGastoMes = rows.reduce((acc, r) => acc + r.total, 0);

    return {
      rows: rows.slice(0, 10),
      totalGastoMes: Number(totalGastoMes.toFixed(2)),
    };
  }, [monthTx]);


  // -----------------------------
  // Faturas por cartão (invoiceMonth)
  // -----------------------------
  const invoicesByCard = useMemo(() => {
    const creditCards = (accounts || []).filter((a) => a.active && a.type === "credit_card");

    const totals = new Map();
    for (const a of creditCards) totals.set(a.id, 0);

    for (const t of monthTxInvoice) {
      const rid = resolveAccountIdFromTxn(t);
      if (!rid) continue;

      const acc = accountsById.get(rid);
      if (!acc || acc.type !== "credit_card") continue;

      if (resolvedDirection(t) !== "expense") continue;

      const sa = signedAmount(t);
      totals.set(acc.id, (totals.get(acc.id) || 0) + Math.abs(sa));
    }

    return creditCards
      .map((a) => {
        const dueISO = dueDateISO(month, a?.due_day);
        return {
          id: a.id,
          name: a.name,
          color: a.color || alpha(theme.palette.primary.main, 0.18),
          dueISO,
          dueLabel: dueISO ? formatDateBR(dueISO) : "—",
          total: Number((totals.get(a.id) || 0).toFixed(2)),
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [accounts, accountsById, month, monthTxInvoice, resolveAccountIdFromTxn, theme]);

  // -----------------------------
  // Layout
  // -----------------------------

  const bootLoading = accountsStatus === "loading" || txStatus === "loading";

  if (bootLoading) {
    return (
      <Spinner status={bootLoading} />
    );
  }

  return (
    <Stack spacing={2.25} sx={{ width: "100%" }}>
      {/* Linha 1: 6 KPIs */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
            lg: "repeat(6, minmax(0, 1fr))",
          },
          gap: 2,
          width: "100%",
        }}
      >
        <KpiCard
          title="Total de entradas"
          value={maskMoney(formatBRL(totalEntradaMes))}
          // subtitle="purchaseDate"
          icon={TrendingUpRoundedIcon}
          tone="good"
        />
        <KpiCard
          title="Total de saídas"
          value={maskMoney(formatBRL(totalSaidaMes))}
          // subtitle="purchaseDate"
          icon={TrendingDownRoundedIcon}
          tone="bad"
        />
        <KpiCard
          title="Total em cartões"
          value={maskMoney(formatBRL(totalCartoesMes))}
          // subtitle="purchaseDate"
          icon={CreditCardRoundedIcon}
          tone="info"
        />
        <KpiCard
          title="Despesas mensais"
          value={maskMoney(formatBRL(totalDespesasMensais))}
          // subtitle="purchaseDate"
          icon={CalendarMonthRoundedIcon}
          tone="bad"
        />
        <KpiCard
          title="Total avulso"
          value={maskMoney(formatBRL(totalAvulso))}
          // subtitle="purchaseDate"
          icon={BoltRoundedIcon}
          tone="neutral"
        />
        <KpiCard
          title="Total parcelamento"
          value={maskMoney(formatBRL(totalParcelamento))}
          // subtitle="purchaseDate"
          icon={ViewWeekRoundedIcon}
          tone="info"
        />
      </Box>

      {/* Linha 2: 3 colunas */}
      <Box
        sx={{
          width: "100%",
          display: "grid",
          gap: 2,
          alignItems: "stretch",
          gridTemplateColumns: {
            xs: "1fr",
            md: "minmax(0, 1fr) 340px 340px",
          },
        }}
      >
        {/* Col 1: Chart */}
        <Card sx={(t) => cardBg(t, "primary")}>
          <CardContent sx={{ p: 2.25, height: "100%" }}>
            <Stack spacing={1.2} sx={{ height: "100%" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography sx={{ fontWeight: 950, letterSpacing: -0.4 }}>
                  Despesas por dia
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  purchaseDate • {formatMonthBR(month)}
                </Typography>
              </Stack>

              <Box sx={{ flex: 1, minHeight: 360 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 30, right: 18, left: 0, bottom: 0 }}
                  >
                    {/* 🔹 Gradiente das barras */}
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={1} />
                        <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={0.6} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      vertical={false}
                      stroke={theme.palette.divider}
                      strokeDasharray="4 4"
                      opacity={0.3}
                    />

                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                      domain={[0, Math.max(10, maxChartValue * 1.15)]}
                      tickFormatter={(v) => formatBRL(v)}
                    />

                    <Tooltip content={<BRLTooltip />} />

                    <Bar
                      dataKey="value"
                      fill="url(#barGradient)"
                      radius={[12, 12, 0, 0]}
                      barSize={24}
                      isAnimationActive
                      animationDuration={600}
                    >
                      {/* 🔹 Valor no topo da barra */}
                      <LabelList
                        dataKey="value"
                        position="top"
                        content={(props) => {
                          const { x, y, width, value } = props;

                          if (!value || Number(value) <= 0) return null; // ✅ só mostra se > 0

                          return (
                            <text
                              x={x + width / 2}
                              y={y - 6}
                              textAnchor="middle"
                              fontSize={12}
                              fontWeight={600}
                              fill={theme.palette.text.primary}
                            >
                              {formatBRL(value)}
                            </text>
                          );
                        }}
                      />

                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>

              <Divider />

              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Próximas visões: por cartão • parcelado vs avulso • múltiplas barras
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* Col 2: Categorias */}
        <Card sx={(t) => cardBg(t, "info")}>
          <CardContent sx={{ p: 2.25, height: "100%" }}>
            <Stack spacing={1} sx={{ height: "100%" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Stack spacing={0.2}>
                  <Typography sx={{ fontWeight: 950, letterSpacing: -0.4 }}>
                    Categorias
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    purchaseDate • {formatMonthBR(month)}
                  </Typography>
                </Stack>

                <Stack spacing={0} alignItems="flex-end">
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                    Total
                  </Typography>
                  <Typography sx={{ fontWeight: 950 }}>
                    {formatBRL(categoriesRank.totalGastoMes || 0)}
                  </Typography>
                </Stack>
              </Stack>

              <Divider />

              <Box sx={{ flex: 1, overflow: "auto" }}>
                {(categoriesRank.rows || []).length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Sem gastos no mês.
                  </Typography>
                ) : (
                  <Stack spacing={0}>
                    {(() => {
                      const maxValue = (categoriesRank.rows || [])[0]?.total || 1;

                      return (categoriesRank.rows || []).slice(0, 10).map((row, idx) => {
                        const pct = clamp((Number(row.total || 0) / Number(maxValue)) * 100, 0, 100);

                        return (
                          <React.Fragment key={row.categoryId}>
                            <Box
                              sx={(t) => ({
                                py: 1,
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                borderRadius: 1.5,
                                px: 0.5,
                                transition: "background 140ms ease",
                                "&:hover": {
                                  background: alpha(t.palette.action.hover, 0.7),
                                },
                              })}
                            >
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 999,
                                  background: row.tint,
                                  flexShrink: 0,
                                }}
                              />

                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography sx={{ fontWeight: 900, fontSize: 13 }} noWrap>
                                  {row.name}
                                </Typography>

                                <Box sx={{ mt: 0.55 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={pct}
                                    sx={(t) => ({
                                      height: 4,
                                      borderRadius: 999,
                                      background: alpha(t.palette.primary.main, 0.10),
                                      "& .MuiLinearProgress-bar": {
                                        borderRadius: 999,
                                        backgroundColor: alpha(t.palette.primary.main, 0.85),
                                      },
                                    })}
                                  />
                                </Box>
                              </Box>

                              <Typography sx={{ fontWeight: 950, fontSize: 13, whiteSpace: "nowrap" }}>
                                {formatBRL(row.total)}
                              </Typography>
                            </Box>

                            {idx < Math.min((categoriesRank.rows || []).length, 10) - 1 ? (
                              <Divider sx={{ opacity: 0.5 }} />
                            ) : null}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </Stack>
                )}
              </Box>

              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Top 10 • depois colocamos “ver todas”.
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* Col 3: Faturas */}
        <Card sx={(t) => cardBg(t, "success")}>
          <CardContent sx={{ p: 2.25, height: "100%" }}>
            <Stack spacing={1} sx={{ height: "100%" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Stack spacing={0.2}>
                  <Typography sx={{ fontWeight: 950, letterSpacing: -0.4 }}>
                    Faturas (cartões)
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    invoiceMonth • {formatMonthBR(month)}
                  </Typography>
                </Stack>

                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                  {(invoicesByCard || []).length} cartões
                </Typography>
              </Stack>

              <Divider />

              <Box sx={{ flex: 1, overflow: "auto" }}>
                {(invoicesByCard || []).length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Nenhum cartão ativo.
                  </Typography>
                ) : (
                  <Stack spacing={0}>
                    {(() => {
                      const top = (invoicesByCard || [])[0]?.total || 1;

                      return (invoicesByCard || []).map((c, idx) => {
                        const pct = clamp((Number(c.total || 0) / Number(top || 1)) * 100, 0, 100);

                        return (
                          <React.Fragment key={c.id}>
                            <Box
                              sx={(t) => ({
                                py: 1,
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                borderRadius: 1.5,
                                px: 0.5,
                                transition: "background 140ms ease",
                                "&:hover": {
                                  background: alpha(t.palette.action.hover, 0.7),
                                },
                              })}
                            >
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 999,
                                  background: c.color || alpha(theme.palette.success.main, 0.35),
                                  flexShrink: 0,
                                }}
                              />

                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                                  <Typography sx={{ fontWeight: 900, fontSize: 13 }} noWrap>
                                    {c.name}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{ color: "text.secondary", fontWeight: 800 }}
                                    noWrap
                                  >
                                    {c.dueLabel}
                                  </Typography>
                                </Stack>

                                <Box sx={{ mt: 0.55 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={pct}
                                    sx={(t) => ({
                                      height: 4,
                                      borderRadius: 999,
                                      background: alpha(t.palette.primary.main, 0.10),
                                      "& .MuiLinearProgress-bar": {
                                        borderRadius: 999,
                                        backgroundColor: alpha(t.palette.primary.main, 0.85),
                                      },
                                    })}
                                  />
                                </Box>
                              </Box>

                              <Typography sx={{ fontWeight: 950, fontSize: 13, whiteSpace: "nowrap" }}>
                                {formatBRL(c.total)}
                              </Typography>
                            </Box>

                            {idx < (invoicesByCard || []).length - 1 ? (
                              <Divider sx={{ opacity: 0.5 }} />
                            ) : null}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </Stack>
                )}
              </Box>

              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Depois: status (pago/previsto) por cartão e alertas.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Stack >
  );
}
