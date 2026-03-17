import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
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

function safeNum(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
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
    borderRadius: 1.25,
    border: `1px solid ${alpha(theme.palette.divider, 0.68)}`,
    boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
    background: `linear-gradient(180deg, ${alpha(base, 0.06)}, ${alpha(
      theme.palette.background.paper,
      0.88
    )})`,
  };
}

function pickFallbackColor(theme, key) {
  const palette = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.info.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
  ];
  let h = 0;
  const s = String(key || "x");
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  const idx = Math.abs(h) % palette.length;
  return palette[idx];
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
          p: 1.2,
          borderRadius: 1.2,
          border: `1px solid ${alpha(theme.palette.divider, 0.76)}`,
          background: alpha(theme.palette.background.paper, 0.76),
          minHeight: 92,
          boxShadow: `inset 0 0 0 1px ${alpha(base, 0.05)}`,
        };
      }}
    >
      <Stack spacing={0.6}>
        <Stack direction="row" spacing={0.9} alignItems="center">
          <Box
            sx={(theme) => ({
              width: 30,
              height: 30,
              borderRadius: 1,
              display: "grid",
              placeItems: "center",
              background: alpha(theme.palette.primary.main, 0.1),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
              flexShrink: 0,
            })}
          >
            {Icon ? <Icon sx={{ fontSize: 17 }} /> : null}
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
            letterSpacing: -0.35,
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
        p: 1.15,
        borderRadius: 1.1,
        background: alpha(theme.palette.background.paper, 0.97),
        border: `1px solid ${alpha(theme.palette.divider, 0.82)}`,
        boxShadow: "0 12px 28px rgba(0,0,0,0.14)",
        minWidth: 210,
      })}
    >
      <Typography sx={{ fontWeight: 900, mb: 0.75, fontSize: 12.5 }}>
        {String(label)}
      </Typography>

      <Stack spacing={0.5}>
        {payload.map((item) => (
          <Stack
            key={String(item.dataKey)}
            direction="row"
            justifyContent="space-between"
            spacing={1}
            alignItems="center"
          >
            <Stack direction="row" spacing={0.7} alignItems="center" sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
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

function resolveCategoryInfo(t, categoriesById, theme) {
  const rawId = String(t?.categoryId ?? t?.category_id ?? t?.category ?? "outros");
  const cat = categoriesById?.get?.(rawId);

  return {
    key: String(cat?.id ?? rawId),
    name: String(cat?.name ?? t?.categoryName ?? t?.categoria ?? rawId ?? "Outros"),
    color: cat?.color || cat?.tint || null,
    fallbackColor: pickFallbackColor(theme, rawId),
  };
}

function formatPercentBR(v) {
  return `${Number(v || 0).toFixed(1)}%`;
}

export default function DashboardMonthlyPace({
  month,
  transactions = [],
  money = (v) => String(v || 0),
  cardBg,
  title = "Ritmo de gastos",
  monthsBack = 6,
  isExcluded,
  categoriesById,
}) {
  const theme = useTheme();
  const resolvedCardBg = cardBg || defaultCardBg;
  const excludeResolver = isExcluded || (() => false);

  const [mode, setMode] = useState("purchase");
  const [selectedCategoryKey, setSelectedCategoryKey] = useState("");
  const [categorySortBy, setCategorySortBy] = useState("previous");

  const handleModeChange = (_, value) => {
    if (!value) return;
    setMode(value);
  };

  const handleCategorySortChange = (_, value) => {
    if (!value) return;
    setCategorySortBy(value);
  };

  const chartColors = useMemo(
    () => ({
      // gráfico comparativo (barras)
      compareFull: alpha(theme.palette.grey[500], 0.32),
      comparePartial: theme.palette.warning.main,

      // gráfico evolução (linhas)
      currentLine: theme.palette.error.main,
      previousLine: theme.palette.success.main,

      // gráfico categoria selecionada
      categoryPreviousLine: alpha(theme.palette.info.main, 0.95),
    }),
    [theme]
  );

  const analysis = useMemo(() => {
    if (!month) {
      return {
        cutoffDay: 1,
        currentMonthLabel: "",
        previousMonthLabel: "",
        currentSpent: 0,
        previousSpent: 0,
        projectedLinear: 0,
        deltaVsPrev: 0,
        currentOneOff: 0,
        currentInstallments: 0,
        barData: [],
        lineData: [],
        categoryImpactRows: [],
        categoryLineDataByKey: {},
      };
    }

    const today = new Date();
    const realTodayDay = today.getDate();
    const selectedMonthDays = daysInMonth(month);
    const cutoffDay = clamp(realTodayDay, 1, selectedMonthDays);

    const { monthList, map: monthsMap } = buildMonthBuckets(month, monthsBack);
    const previousMonthYM = addMonthsYM(month, -1);

    const categoryAcc = new Map();

    function ensureCategoryRow(catInfo) {
      if (!categoryAcc.has(catInfo.key)) {
        categoryAcc.set(catInfo.key, {
          key: catInfo.key,
          name: catInfo.name,
          color: catInfo.color || catInfo.fallbackColor,
          currentTotal: 0,
          previousTotal: 0,
          currentDays: Array.from({ length: selectedMonthDays }, (_, idx) => ({
            day: idx + 1,
            value: 0,
            cumulative: 0,
          })),
          previousDays: Array.from({ length: selectedMonthDays }, (_, idx) => ({
            day: idx + 1,
            value: 0,
            cumulative: 0,
          })),
        });
      }
      return categoryAcc.get(catInfo.key);
    }

    function addToCategory(catInfo, refYM, day, amount) {
      if (!catInfo?.key || !day || !amount) return;
      if (refYM !== month && refYM !== previousMonthYM) return;
      if (day < 1 || day > selectedMonthDays) return;

      const row = ensureCategoryRow(catInfo);

      if (refYM === month) {
        row.currentTotal += amount;
        row.currentDays[day - 1].value += amount;
      } else if (refYM === previousMonthYM) {
        row.previousTotal += amount;
        row.previousDays[day - 1].value += amount;
      }
    }

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

        const catInfo = resolveCategoryInfo(t, categoriesById, theme);
        addToCategory(catInfo, purchaseYM, day, amount);
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

        const catInfo = resolveCategoryInfo(t, categoriesById, theme);
        addToCategory(catInfo, refYM, day, amount);
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

    const categoryImpactRows = Array.from(categoryAcc.values())
      .map((row) => {
        let accCurr = 0;
        let accPrev = 0;

        const currentDays = row.currentDays.map((d) => {
          accCurr += safeNum(d.value);
          return {
            ...d,
            value: Number(safeNum(d.value).toFixed(2)),
            cumulative: Number(accCurr.toFixed(2)),
          };
        });

        const previousDays = row.previousDays.map((d) => {
          accPrev += safeNum(d.value);
          return {
            ...d,
            value: Number(safeNum(d.value).toFixed(2)),
            cumulative: Number(accPrev.toFixed(2)),
          };
        });

        const currentTotal = Number(safeNum(row.currentTotal).toFixed(2));
        const previousTotal = Number(safeNum(row.previousTotal).toFixed(2));
        const delta = Number((currentTotal - previousTotal).toFixed(2));

        let pctVsPrevious = 0;
        let isExtrapolated = false;
        let hasPreviousBase = previousTotal > 0;

        if (previousTotal > 0) {
          pctVsPrevious = Number(((currentTotal / previousTotal) * 100).toFixed(1));
          isExtrapolated = pctVsPrevious > 100;
        } else if (currentTotal > 0) {
          pctVsPrevious = 999.9;
          isExtrapolated = true;
          hasPreviousBase = false;
        }

        return {
          key: row.key,
          name: row.name,
          color: row.color || pickFallbackColor(theme, row.key),
          currentTotal,
          previousTotal,
          delta,
          currentDays,
          previousDays,
          pctVsPrevious,
          isExtrapolated,
          hasPreviousBase,
        };
      })
      .filter((row) => row.currentTotal > 0 || row.previousTotal > 0);

    const categoryLineDataByKey = {};
    categoryImpactRows.forEach((row) => {
      categoryLineDataByKey[row.key] = lineDays.map((day) => ({
        day,
        atual: Number(safeNum(row.currentDays?.[day - 1]?.cumulative).toFixed(2)),
        anterior: Number(safeNum(row.previousDays?.[day - 1]?.cumulative).toFixed(2)),
      }));
    });

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
      categoryImpactRows,
      categoryLineDataByKey,
    };
  }, [month, monthsBack, transactions, excludeResolver, mode, categoriesById, theme]);

  const sortedCategoryRows = useMemo(() => {
    const rows = [...(analysis.categoryImpactRows || [])];
    if (categorySortBy === "current") {
      rows.sort((a, b) => {
        if (b.currentTotal !== a.currentTotal) return b.currentTotal - a.currentTotal;
        return b.previousTotal - a.previousTotal;
      });
      return rows;
    }

    rows.sort((a, b) => {
      if (b.previousTotal !== a.previousTotal) return b.previousTotal - a.previousTotal;
      return b.currentTotal - a.currentTotal;
    });
    return rows;
  }, [analysis.categoryImpactRows, categorySortBy]);

  const topCategoryRows = useMemo(() => {
    return sortedCategoryRows.slice(0, 10);
  }, [sortedCategoryRows]);

  useEffect(() => {
    if (!topCategoryRows.length) {
      setSelectedCategoryKey("");
      return;
    }

    const exists = topCategoryRows.some((r) => r.key === selectedCategoryKey);
    if (!selectedCategoryKey || !exists) {
      setSelectedCategoryKey(topCategoryRows[0].key);
    }
  }, [topCategoryRows, selectedCategoryKey]);

  const selectedCategory =
    topCategoryRows.find((r) => r.key === selectedCategoryKey) ||
    sortedCategoryRows.find((r) => r.key === selectedCategoryKey) ||
    null;

  const selectedCategoryLineData = selectedCategory
    ? analysis.categoryLineDataByKey?.[selectedCategory.key] || []
    : [];

  const deltaTonePrev =
    analysis.deltaVsPrev > 0 ? "error" : analysis.deltaVsPrev < 0 ? "success" : "info";

  const modeLabel = mode === "purchase" ? "compra consolidada" : "fatura/competência";

  const installmentsPct =
    analysis.currentSpent > 0
      ? clamp((analysis.currentInstallments / analysis.currentSpent) * 100, 0, 100)
      : 0;

  return (
    <Card sx={(t) => resolvedCardBg(t, "warning")}>
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", lg: "center" }}
            spacing={1.4}
          >
            <Stack spacing={0.3}>
              <Typography sx={{ fontWeight: 950, letterSpacing: -0.35 }}>
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
                  gap: 0.9, // 👈 espaço ENTRE os botões
                  "& .MuiToggleButton-root": {
                    px: 1.15,
                    py: 0.5,
                    fontWeight: 900,
                    textTransform: "none",
                    borderRadius: 1,
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
              gap: 1.15,
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
              p: 1.1,
              borderRadius: 1.15,
              border: `1px solid ${alpha(theme.palette.divider, 0.68)}`,
              background: alpha(theme.palette.background.paper, 0.62),
            })}
          >
            <Stack spacing={0.7}>
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
                  background: alpha(theme.palette.info.main, 0.1),
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
              gap: 1.25,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "minmax(0, 0.95fr) minmax(0, 1.05fr)",
              },
              alignItems: "stretch",
            }}
          >
            <Box
              sx={(theme) => ({
                minWidth: 0,
                borderRadius: 1.2,
                border: `1px solid ${alpha(theme.palette.divider, 0.68)}`,
                background: alpha(theme.palette.background.paper, 0.58),
                p: 1,
              })}
            >
              <Stack spacing={0.9}>
                <Stack spacing={0.1}>
                  <Typography sx={{ fontWeight: 900, fontSize: 14 }}>
                    Comparativo até o dia {analysis.cutoffDay}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    cinza = mês fechado • laranja = até hoje
                  </Typography>
                </Stack>

                <Box sx={{ width: "100%", height: 290 }}>
                  <ResponsiveContainer>
                    <BarChart data={analysis.barData} barGap={6}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
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
                        radius={[6, 6, 0, 0]}
                        fill={chartColors.compareFull}
                      />
                      <Bar
                        dataKey="ateHoje"
                        name={`Até dia ${analysis.cutoffDay}`}
                        radius={[6, 6, 0, 0]}
                        fill={chartColors.comparePartial}
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
                border: `1px solid ${alpha(theme.palette.divider, 0.68)}`,
                background: alpha(theme.palette.background.paper, 0.58),
                p: 1,
              })}
            >
              <Stack spacing={0.9}>
                <Stack spacing={0.1}>
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.18} />
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
                        stroke={alpha(theme.palette.text.secondary, 0.38)}
                        strokeDasharray="4 4"
                      />
                      <Line
                        type="monotone"
                        dataKey="atual"
                        name="Mês atual"
                        stroke={chartColors.currentLine}
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="anterior"
                        name="Mês anterior"
                        stroke={chartColors.previousLine}
                        strokeWidth={2.4}
                        strokeDasharray="7 4"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Stack>
            </Box>
          </Box>

          <Divider />

          <Box
            sx={{
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "minmax(0, 0.95fr) minmax(0, 1.05fr)",
              },
              alignItems: "stretch",
            }}
          >
            <Box
              sx={(theme) => ({
                minWidth: 0,
                borderRadius: 1.2,
                border: `1px solid ${alpha(theme.palette.divider, 0.68)}`,
                background: alpha(theme.palette.background.paper, 0.58),
                p: 1,
              })}
            >
              <Stack spacing={1}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  spacing={1}
                >
                  <Stack spacing={0.1}>
                    <Typography sx={{ fontWeight: 900, fontSize: 14 }}>
                      Top 10 categorias
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      barra = % do mês atual sobre o mês anterior
                    </Typography>
                  </Stack>

                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={categorySortBy}
                    onChange={handleCategorySortChange}
                    sx={{
                      "& .MuiToggleButton-root": {
                        px: 1.05,
                        py: 0.45,
                        fontWeight: 900,
                        textTransform: "none",
                        borderRadius: 1,
                      },
                    }}
                  >
                    <ToggleButton value="previous">Ordenar: mês anterior</ToggleButton>
                    <ToggleButton value="current">Ordenar: mês atual</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>

                <Box
  sx={(theme) => ({
    flex: 1,
    maxHeight: 430,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    pr: 0.35,
    scrollbarWidth: "thin",
    scrollbarColor: `${alpha(theme.palette.text.primary, 0.18)} transparent`,
    "&::-webkit-scrollbar": {
      width: 6,
      height: 6,
    },
    "&::-webkit-scrollbar-track": {
      background: "transparent",
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: alpha(theme.palette.text.primary, 0.16),
      borderRadius: 999,
    },
    "&::-webkit-scrollbar-thumb:hover": {
      backgroundColor: alpha(theme.palette.text.primary, 0.24),
    },
  })}
>
                  {topCategoryRows.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      Sem categorias para comparar.
                    </Typography>
                  ) : (
                    <Stack spacing={0}>
                      {topCategoryRows.map((row, idx) => {
                        const isSelected = selectedCategoryKey === row.key;
                        const isPositive = row.delta > 0;
                        const barColorBase = row.color || pickFallbackColor(theme, row.key);
                        const barColor = row.isExtrapolated
                          ? theme.palette.error.main
                          : barColorBase;

                        const progressValue = row.hasPreviousBase
                          ? Math.min(Math.max(row.pctVsPrevious || 0, 0), 100)
                          : 100;

                        return (
                          <React.Fragment key={row.key}>
                            <Button
                              onClick={() => setSelectedCategoryKey(row.key)}
                              sx={(theme) => ({
                                px: 0.7,
                                py: 0.9,
                                justifyContent: "flex-start",
                                textTransform: "none",
                                borderRadius: 1,
                                color: "inherit",
                                background: isSelected
                                  ? alpha(theme.palette.primary.main, 0.07)
                                  : "transparent",
                                "&:hover": {
                                  background: alpha(theme.palette.action.active, 0.045),
                                },
                              })}
                            >
                              <Box sx={{ width: "100%" }}>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                  justifyContent="space-between"
                                >
                                  <Stack
                                    direction="row"
                                    spacing={0.85}
                                    alignItems="center"
                                    sx={{ minWidth: 0, flex: 1 }}
                                  >
                                    <Box
                                      sx={{
                                        width: 9,
                                        height: 9,
                                        borderRadius: 999,
                                        background: barColorBase,
                                        flexShrink: 0,
                                      }}
                                    />
                                    <Typography sx={{ fontWeight: 900, fontSize: 13 }} noWrap>
                                      {row.name}
                                    </Typography>
                                  </Stack>

                                  <Stack spacing={0} alignItems="flex-end" sx={{ ml: 1 }}>
                                    <Typography
                                      sx={{
                                        fontWeight: 950,
                                        fontSize: 13,
                                        color: isPositive
                                          ? "error.main"
                                          : row.delta < 0
                                            ? "success.main"
                                            : "text.primary",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {row.delta >= 0 ? "+" : ""}
                                      {money(row.delta)}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{ color: "text.secondary", fontWeight: 700 }}
                                    >
                                      {money(row.currentTotal)} vs {money(row.previousTotal)}
                                    </Typography>
                                  </Stack>
                                </Stack>

                                <Box sx={{ mt: 0.7 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={progressValue}
                                    sx={{
                                      height: 6,
                                      borderRadius: 999,
                                      background: alpha(barColor, 0.12),
                                      overflow: "visible",
                                      "& .MuiLinearProgress-bar": {
                                        borderRadius: 999,
                                        backgroundColor: alpha(barColor, 0.96),
                                      },
                                    }}
                                  />
                                </Box>

                                <Stack
                                  direction={{ xs: "column", sm: "row" }}
                                  justifyContent="space-between"
                                  spacing={0.4}
                                  sx={{ mt: 0.5 }}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: row.isExtrapolated ? "error.main" : "text.secondary",
                                      fontWeight: 800,
                                    }}
                                  >
                                    {row.hasPreviousBase
                                      ? `${formatPercentBR(row.pctVsPrevious)} do mês anterior`
                                      : "sem base no mês anterior"}
                                  </Typography>

                                  {row.isExtrapolated ? (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: "error.main",
                                        fontWeight: 900,
                                      }}
                                    >
                                      acima de 100% do mês anterior
                                    </Typography>
                                  ) : null}
                                </Stack>
                              </Box>
                            </Button>

                            {idx < topCategoryRows.length - 1 ? (
                              <Divider sx={{ opacity: 0.4 }} />
                            ) : null}
                          </React.Fragment>
                        );
                      })}
                    </Stack>
                  )}
                </Box>
              </Stack>
            </Box>

            <Box
              sx={(theme) => ({
                minWidth: 0,
                borderRadius: 1.2,
                border: `1px solid ${alpha(theme.palette.divider, 0.68)}`,
                background: alpha(theme.palette.background.paper, 0.58),
                p: 1,
              })}
            >
              <Stack spacing={0.9}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="baseline"
                  spacing={1}
                >
                  <Stack spacing={0.1}>
                    <Typography sx={{ fontWeight: 900, fontSize: 14 }}>
                      {selectedCategory ? `Categoria: ${selectedCategory.name}` : "Categoria"}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      acumulado atual vs mês anterior
                    </Typography>
                  </Stack>

                  {selectedCategory ? (
                    <Stack alignItems="flex-end" spacing={0}>
                      <Typography
                        sx={{
                          fontWeight: 950,
                          fontSize: 13,
                          color:
                            selectedCategory.delta > 0
                              ? "error.main"
                              : selectedCategory.delta < 0
                                ? "success.main"
                                : "text.primary",
                        }}
                      >
                        {selectedCategory.delta >= 0 ? "+" : ""}
                        {money(selectedCategory.delta)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                        {money(selectedCategory.currentTotal)} vs {money(selectedCategory.previousTotal)}
                      </Typography>
                    </Stack>
                  ) : null}
                </Stack>

                <Box sx={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <LineChart data={selectedCategoryLineData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.18} />
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
                        stroke={alpha(theme.palette.text.secondary, 0.38)}
                        strokeDasharray="4 4"
                      />
                      <Line
                        type="monotone"
                        dataKey="atual"
                        name="Mês atual"
                        stroke={selectedCategory?.color || chartColors.currentLine}
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="anterior"
                        name="Mês anterior"
                        stroke={chartColors.categoryPreviousLine}
                        strokeWidth={2.4}
                        strokeDasharray="7 4"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Stack>
            </Box>
          </Box>

          <Box sx={{ display: "none" }}>
            {typeof window !== "undefined" ? (
              (() => {
                window.debugComparativoCategorias = sortedCategoryRows || [];
                return null;
              })()
            ) : null}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}