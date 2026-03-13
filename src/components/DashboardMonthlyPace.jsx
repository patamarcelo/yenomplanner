import React, { useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Divider,
  LinearProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import PieChartRoundedIcon from "@mui/icons-material/PieChartRounded";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Legend,
  ReferenceLine,
} from "recharts";

function normalizeISODate(d) {
  if (!d) return "";
  if (d instanceof Date && !isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  const s = String(d || "");
  if (!s) return "";
  if (s.includes("T")) return s.slice(0, 10);
  return s.slice(0, 10);
}

function ymFromISODate(d) {
  const iso = normalizeISODate(d);
  return iso ? iso.slice(0, 7) : "";
}

function dayFromISODate(d) {
  const iso = normalizeISODate(d);
  if (!iso || iso.length < 10) return null;
  const n = Number(iso.slice(8, 10));
  return Number.isFinite(n) ? n : null;
}

function normalizeYM(v) {
  const s0 = String(v || "").trim();
  if (!s0) return "";
  const iso = s0.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const br = s0.match(/^(\d{2})\/(\d{4})/);
  if (br) return `${br[2]}-${br[1]}`;
  const slash = s0.match(/^(\d{4})\/(\d{2})/);
  if (slash) return `${slash[1]}-${slash[2]}`;
  return s0.slice(0, 7);
}

function parseYM(ym) {
  const m = String(ym || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) };
}

function daysInMonth(ym) {
  const p = parseYM(ym);
  if (!p) return 30;
  return new Date(p.y, p.m, 0).getDate();
}

function addMonthsYM(ym, add = 0) {
  const p = parseYM(ym);
  if (!p) return "";
  const base = p.y * 12 + (p.m - 1) + Number(add || 0);
  const y2 = Math.floor(base / 12);
  const m2 = (base % 12) + 1;
  return `${y2}-${String(m2).padStart(2, "0")}`;
}

function formatMonthBR(ym) {
  const p = parseYM(ym);
  if (!p) return String(ym || "");
  const dt = new Date(p.y, p.m - 1, 1);
  return dt
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(" de ", "/");
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function defaultCardBg(theme, tone = "primary") {
  const map = {
    primary: theme.palette.primary.main,
    info: theme.palette.info.main,
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    error: theme.palette.error.main,
  };

  const base = map[tone] || map.primary;

  return {
    borderRadius: 1.2,
    border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
    background: `linear-gradient(180deg, ${alpha(base, 0.07)}, ${alpha(
      theme.palette.background.paper,
      0.86
    )})`,
  };
}

function MiniKpi({ icon: Icon, label, value, helper, tone = "primary" }) {
  return (
    <Box
      sx={(theme) => {
        const paletteMap = {
          primary: theme.palette.primary.main,
          success: theme.palette.success.main,
          warning: theme.palette.warning.main,
          error: theme.palette.error.main,
          info: theme.palette.info.main,
        };

        const base = paletteMap[tone] || paletteMap.primary;

        return {
          p: 1.35,
          borderRadius: 1.2,
          border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
          background: alpha(theme.palette.background.paper, 0.72),
          minHeight: 92,
          boxShadow: `inset 0 0 0 1px ${alpha(base, 0.06)}`,
        };
      }}
    >
      <Stack spacing={0.65}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={(theme) => ({
              width: 32,
              height: 32,
              borderRadius: 1.6,
              display: "grid",
              placeItems: "center",
              background: alpha(theme.palette.primary.main, 0.12),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
              flexShrink: 0,
            })}
          >
            {Icon ? <Icon sx={{ fontSize: 18 }} /> : null}
          </Box>

          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
            {label}
          </Typography>
        </Stack>

        <Typography
          sx={{
            fontWeight: 950,
            fontSize: 20,
            lineHeight: 1.1,
            letterSpacing: -0.4,
          }}
        >
          {value}
        </Typography>

        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
          {helper}
        </Typography>
      </Stack>
    </Box>
  );
}

function ChartTooltip({ active, payload, label, money }) {
  if (!active || !payload?.length) return null;

  return (
    <Box
      sx={(theme) => ({
        p: 1.2,
        borderRadius: 1.5,
        background: alpha(theme.palette.background.paper, 0.96),
        border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
        boxShadow: "0 16px 36px rgba(0,0,0,0.18)",
        minWidth: 210,
      })}
    >
      <Typography sx={{ fontWeight: 900, mb: 0.8, fontSize: 12.5 }}>
        {String(label)}
      </Typography>

      <Stack spacing={0.55}>
        {payload.map((item) => (
          <Stack
            key={String(item.dataKey)}
            direction="row"
            justifyContent="space-between"
            spacing={1}
            alignItems="center"
          >
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: item.color,
                  flexShrink: 0,
                }}
              />
              <Typography noWrap sx={{ fontSize: 12, fontWeight: 800 }}>
                {item.name}
              </Typography>
            </Stack>

            <Typography sx={{ fontSize: 12, fontWeight: 950, whiteSpace: "nowrap" }}>
              {money(item.value || 0)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function safeNum(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function getInstallmentsTotal(t) {
  const raw =
    t?.installmentsTotal ??
    t?.installments_total ??
    t?.installments ??
    t?.totalInstallments ??
    t?.installmentsCount ??
    t?.parcelaTotal ??
    0;

  if (typeof raw === "string" && raw.includes("/")) {
    const right = Number(raw.split("/")[1]);
    return Number.isFinite(right) && right > 0 ? right : 0;
  }

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function normalizeDirectionFromTxn(t) {
  const d = String(t?.direction || t?.direcao || "").toLowerCase();
  if (["income", "receita", "entrada"].includes(d)) return "income";
  return "expense";
}

function signedAmountNormalized(t) {
  const v = safeNum(t?.amount ?? t?.value ?? t?.valor ?? t?.valorOriginal ?? 0);
  const abs = Math.abs(v);
  if (v < 0) return v;
  return normalizeDirectionFromTxn(t) === "income" ? abs : -abs;
}

function isInstallment(t) {
  const k = String(t?.kind || t?.tipoLancamento || "").toLowerCase();
  return ["installment", "parcelado", "parcela"].includes(k);
}

function getInstallmentGroupKey(t) {
  const explicit = String(
    t?.installmentGroupId ??
    t?.installment_group_id ??
    t?.groupId ??
    t?.group_id ??
    t?.parentId ??
    t?.parent_id ??
    t?.originalId ??
    t?.original_id ??
    ""
  ).trim();

  if (explicit) return `gid:${explicit}`;

  const purchase = normalizeISODate(
    t?.purchaseDate ?? t?.purchase_date ?? t?.chargeDate ?? t?.charge_date ?? t?.data ?? ""
  );

  const desc = String(t?.description ?? t?.descricao ?? t?.merchant ?? t?.loja ?? "").trim();
  const total = safeNum(t?.originalAmount ?? t?.original_amount ?? t?.totalAmount ?? 0);
  const parcelValue = Math.abs(Math.min(0, signedAmountNormalized(t)));

  return `fb:${purchase}::${desc.slice(0, 80)}::${total || parcelValue}`;
}

function resolveInstallmentTotalAmount(t) {
  const explicitTotal = safeNum(
    t?.originalAmount ??
    t?.original_amount ??
    t?.totalAmount ??
    t?.total_amount ??
    t?.valorTotal ??
    t?.valor_total ??
    t?.groupAmount ??
    t?.group_amount
  );

  if (explicitTotal > 0) return explicitTotal;

  const parcelValue = Math.abs(Math.min(0, signedAmountNormalized(t)));
  const totalN = getInstallmentsTotal(t);
  if (parcelValue > 0 && totalN > 1) {
    return Number((parcelValue * totalN).toFixed(2));
  }

  return parcelValue;
}

function resolvePurchaseDateYMD(t) {
  return normalizeISODate(
    t?.purchaseDate ?? t?.purchase_date ?? t?.chargeDate ?? t?.charge_date ?? t?.data ?? ""
  );
}

function resolveInvoiceYM(t) {
  return normalizeYM(t?.invoiceMonth ?? t?.invoice_month ?? t?.mesFatura ?? "");
}

function buildMonthBuckets(baseMonth, monthsBack) {
  const monthList = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    monthList.push(addMonthsYM(baseMonth, -i));
  }

  const map = new Map();
  monthList.forEach((ym) => {
    const dim = daysInMonth(ym);
    map.set(ym, {
      ym,
      full: 0,
      partial: 0,
      oneOffPartial: 0,
      installmentPartial: 0,
      days: Array.from({ length: dim }, (_, idx) => ({
        day: idx + 1,
        value: 0,
        cumulative: 0,
      })),
    });
  });

  return { monthList, map };
}

export default function DashboardMonthlyPace({
  month,
  transactions = [],
  money = (v) => String(v || 0),
  cardBg,
  title = "Ritmo de gastos",
  monthsBack = 6,
  isExcluded,
}) {
  const theme = useTheme();
  const resolvedCardBg = cardBg || defaultCardBg;
  const excludeResolver = isExcluded || (() => false);

  const [mode, setMode] = useState("purchase");

  const handleModeChange = (_, value) => {
    if (!value) return;
    setMode(value);
  };

  const analysis = useMemo(() => {
    if (!month) {
      return {
        cutoffDay: 1,
        currentMonthLabel: "",
        currentSpent: 0,
        previousSpent: 0,
        projectedLinear: 0,
        deltaVsPrev: 0,
        currentOneOff: 0,
        currentInstallments: 0,
        barData: [],
        lineData: [],
      };
    }

    const today = new Date();
    const realTodayDay = today.getDate();
    const selectedMonthDays = daysInMonth(month);
    const cutoffDay = clamp(realTodayDay, 1, selectedMonthDays);

    const { monthList, map: monthsMap } = buildMonthBuckets(month, monthsBack);

    if (mode === "purchase") {
      const seenInstallments = new Set();

      for (const t of transactions || []) {
        if (!t) continue;
        if (excludeResolver(t)) continue;
        if (normalizeDirectionFromTxn(t) !== "expense") continue;

        const purchaseYMD = resolvePurchaseDateYMD(t);
        const purchaseYM = ymFromISODate(purchaseYMD);
        if (!purchaseYMD || !monthsMap.has(purchaseYM)) continue;

        const day = dayFromISODate(purchaseYMD);
        if (!day) continue;

        let amount = 0;
        let kindBucket = "oneOff";

        if (isInstallment(t)) {
          const key = getInstallmentGroupKey(t);
          if (seenInstallments.has(key)) continue;
          seenInstallments.add(key);

          amount = resolveInstallmentTotalAmount(t);
          kindBucket = "installment";
        } else {
          amount = Math.abs(Math.min(0, signedAmountNormalized(t)));
        }

        if (!amount || amount <= 0) continue;

        const bucket = monthsMap.get(purchaseYM);
        if (!bucket?.days?.[day - 1]) continue;

        bucket.days[day - 1].value += amount;
        bucket.full += amount;

        if (day <= cutoffDay) {
          bucket.partial += amount;
          if (kindBucket === "installment") bucket.installmentPartial += amount;
          else bucket.oneOffPartial += amount;
        }
      }
    } else {
      for (const t of transactions || []) {
        if (!t) continue;
        if (excludeResolver(t)) continue;
        if (normalizeDirectionFromTxn(t) !== "expense") continue;

        const purchaseYMD = resolvePurchaseDateYMD(t);
        const invoiceYM = resolveInvoiceYM(t);
        const refYM = invoiceYM || ymFromISODate(purchaseYMD);

        if (!refYM || !monthsMap.has(refYM)) continue;

        const amount = Math.abs(Math.min(0, signedAmountNormalized(t)));
        if (!amount || amount <= 0) continue;

        const kindBucket = isInstallment(t) ? "installment" : "oneOff";

        let day = null;
        if (invoiceYM) {
          const purchaseDay = dayFromISODate(purchaseYMD);
          day = clamp(purchaseDay || 1, 1, daysInMonth(refYM));
        } else {
          day = dayFromISODate(purchaseYMD);
        }

        if (!day) continue;

        const bucket = monthsMap.get(refYM);
        if (!bucket?.days?.[day - 1]) continue;

        bucket.days[day - 1].value += amount;
        bucket.full += amount;

        if (day <= cutoffDay) {
          bucket.partial += amount;
          if (kindBucket === "installment") bucket.installmentPartial += amount;
          else bucket.oneOffPartial += amount;
        }
      }
    }

    for (const bucket of monthsMap.values()) {
      let acc = 0;
      bucket.days = bucket.days.map((d) => {
        acc += safeNum(d.value);
        return {
          ...d,
          value: Number(safeNum(d.value).toFixed(2)),
          cumulative: Number(acc.toFixed(2)),
        };
      });

      bucket.full = Number(bucket.full.toFixed(2));
      bucket.partial = Number(bucket.partial.toFixed(2));
      bucket.oneOffPartial = Number(bucket.oneOffPartial.toFixed(2));
      bucket.installmentPartial = Number(bucket.installmentPartial.toFixed(2));
    }

    const current = monthsMap.get(month) || {
      ym: month,
      full: 0,
      partial: 0,
      oneOffPartial: 0,
      installmentPartial: 0,
      days: [],
    };

    const previousMonthYM = addMonthsYM(month, -1);

    
    
    const previous = monthsMap.get(previousMonthYM) || {
      ym: previousMonthYM,
      full: 0,
      partial: 0,
      oneOffPartial: 0,
      installmentPartial: 0,
      days: Array.from({ length: selectedMonthDays }, (_, idx) => ({
        day: idx + 1,
        value: 0,
        cumulative: 0,
      })),
    };

    const currentSpent = Number(safeNum(current.partial).toFixed(2));
    const previousSpent = Number(safeNum(previous.partial).toFixed(2));
    const deltaVsPrev = Number((currentSpent - previousSpent).toFixed(2));

    const monthProgressLinear = cutoffDay / selectedMonthDays;
    const projectedLinear =
      monthProgressLinear > 0
        ? Number((currentSpent / monthProgressLinear).toFixed(2))
        : currentSpent;

    const barData = monthList.map((ym) => {
      const row = monthsMap.get(ym);
      return {
        ym,
        label: formatMonthBR(ym),
        ateHoje: Number(safeNum(row?.partial).toFixed(2)),
        mesFechado: Number(safeNum(row?.full).toFixed(2)),
        isCurrent: ym === month,
        isPrevious: ym === previousMonthYM,
      };
    });

    const lineDays = Array.from({ length: selectedMonthDays }, (_, i) => i + 1);

    const lineData = lineDays.map((day) => ({
      day,
      atual: Number(safeNum(current.days?.[day - 1]?.cumulative).toFixed(2)),
      anterior: Number(safeNum(previous.days?.[day - 1]?.cumulative).toFixed(2)),
    }));

    return {
      cutoffDay,
      currentMonthLabel: formatMonthBR(month),
      previousMonthLabel: formatMonthBR(previousMonthYM),
      currentSpent,
      previousSpent,
      projectedLinear,
      deltaVsPrev,
      currentOneOff: Number(safeNum(current.oneOffPartial).toFixed(2)),
      currentInstallments: Number(safeNum(current.installmentPartial).toFixed(2)),
      barData,
      lineData,
    };
  }, [month, monthsBack, transactions, excludeResolver, mode]);

  const deltaTonePrev =
    analysis.deltaVsPrev > 0 ? "error" : analysis.deltaVsPrev < 0 ? "success" : "info";

  const modeLabel = mode === "purchase" ? "compra consolidada" : "fatura/competência";

  const installmentsPct =
    analysis.currentSpent > 0
      ? clamp((analysis.currentInstallments / analysis.currentSpent) * 100, 0, 100)
      : 0;

  return (
    <Card sx={(t) => resolvedCardBg(t, "warning")}>
      <CardContent sx={{ p: 2.25 }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", lg: "center" }}
            spacing={1.5}
          >
            <Stack spacing={0.35}>
              <Typography sx={{ fontWeight: 950, letterSpacing: -0.4 }}>
                {title}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Comparativo até o dia {analysis.cutoffDay} • {analysis.currentMonthLabel} • {modeLabel}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={mode}
                onChange={handleModeChange}
                sx={{
                  "& .MuiToggleButton-root": {
                    px: 1.2,
                    py: 0.55,
                    fontWeight: 900,
                    textTransform: "none",
                  },
                }}
              >
                <ToggleButton value="purchase">Compra</ToggleButton>
                <ToggleButton value="invoice">Fatura</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(4, minmax(0, 1fr))",
              },
            }}
          >
            <MiniKpi
              icon={CalendarMonthRoundedIcon}
              label={`Gasto até dia ${analysis.cutoffDay}`}
              value={money(analysis.currentSpent)}
              helper={analysis.currentMonthLabel}
              tone="primary"
            />

            <MiniKpi
              icon={QueryStatsRoundedIcon}
              label={`Mês anterior até dia ${analysis.cutoffDay}`}
              value={money(analysis.previousSpent)}
              helper={analysis.previousMonthLabel}
              tone="info"
            />

            <MiniKpi
              icon={analysis.deltaVsPrev > 0 ? TrendingUpRoundedIcon : TrendingDownRoundedIcon}
              label="Diferença vs mês anterior"
              value={`${analysis.deltaVsPrev >= 0 ? "+" : ""}${money(analysis.deltaVsPrev)}`}
              helper={
                analysis.deltaVsPrev > 0
                  ? "acima do mês anterior"
                  : analysis.deltaVsPrev < 0
                    ? "abaixo do mês anterior"
                    : "igual ao mês anterior"
              }
              tone={deltaTonePrev}
            />

            <MiniKpi
              icon={PieChartRoundedIcon}
              label="Projeção linear do mês"
              value={money(analysis.projectedLinear)}
              helper="mantendo o ritmo atual"
              tone="warning"
            />
          </Box>

          <Box
            sx={(theme) => ({
              p: 1.2,
              borderRadius: 1.2,
              border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
              background: alpha(theme.palette.background.paper, 0.6),
            })}
          >
            <Stack spacing={0.75}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={0.7}
              >
                <Typography sx={{ fontWeight: 900, fontSize: 13.5 }}>
                  Composição até o dia {analysis.cutoffDay}
                </Typography>

                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                  Avulsos: {money(analysis.currentOneOff)} • Parcelados: {money(analysis.currentInstallments)}
                </Typography>
              </Stack>

              <LinearProgress
                variant="determinate"
                value={installmentsPct}
                sx={{
                  height: 8,
                  borderRadius: 999,
                  background: alpha(theme.palette.info.main, 0.12),
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 999,
                  },
                }}
              />

              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                Parcelados representam {installmentsPct.toFixed(1)}% do total até agora
              </Typography>
            </Stack>
          </Box>

          <Divider />

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", xl: "1.05fr 1.4fr" },
              alignItems: "stretch",
            }}
          >
            <Box
              sx={(theme) => ({
                minWidth: 0,
                borderRadius: 1.2,
                border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                background: alpha(theme.palette.background.paper, 0.55),
                p: 1.1,
              })}
            >
              <Stack spacing={1}>
                <Stack spacing={0.15}>
                  <Typography sx={{ fontWeight: 900, fontSize: 14 }}>
                    Comparativo até o dia {analysis.cutoffDay}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    barras escuras = até hoje • barras claras = mês cheio
                  </Typography>
                </Stack>

                <Box sx={{ width: "100%", height: 290 }}>
                  <ResponsiveContainer>
                    <BarChart data={analysis.barData} barGap={6}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip content={<ChartTooltip money={money} />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        dataKey="mesFechado"
                        name="Mês fechado"
                        radius={[8, 8, 0, 0]}
                        fill={alpha(theme.palette.info.main, 0.26)}
                      />
                      <Bar
                        dataKey="ateHoje"
                        name={`Até dia ${analysis.cutoffDay}`}
                        radius={[8, 8, 0, 0]}
                        fill={theme.palette.primary.main}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Stack>
            </Box>

            <Box
              sx={(theme) => ({
                minWidth: 0,
                borderRadius: 1.2,
                border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                background: alpha(theme.palette.background.paper, 0.55),
                p: 1.1,
              })}
            >
              <Stack spacing={1}>
                <Stack spacing={0.15}>
                  <Typography sx={{ fontWeight: 900, fontSize: 14 }}>
                    Evolução acumulada por dia
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    mês atual vs mês anterior
                  </Typography>
                </Stack>

                <Box sx={{ width: "100%", height: 290 }}>
                  <ResponsiveContainer>
                    <LineChart data={analysis.lineData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.22} />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip content={<ChartTooltip money={money} />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <ReferenceLine
                        x={analysis.cutoffDay}
                        stroke={alpha(theme.palette.text.secondary, 0.45)}
                        strokeDasharray="4 4"
                      />
                      <Line
                        type="monotone"
                        dataKey="atual"
                        name="Mês atual"
                        stroke={theme.palette.primary.main}
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="anterior"
                        name="Mês anterior"
                        stroke={theme.palette.info.main}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Stack>
            </Box>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}