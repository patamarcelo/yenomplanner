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
  LabelList,
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

function avg(arr) {
  const list = Array.isArray(arr) ? arr.map((v) => safeNum(v)) : [];
  if (!list.length) return 0;
  return list.reduce((acc, n) => acc + n, 0) / list.length;
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

function formatAxisMoneyShort(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "R$ 0";

  if (Math.abs(n) >= 1000000) {
    return `R$ ${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)} mi`;
  }

  if (Math.abs(n) >= 1000) {
    return `R$ ${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)} mil`;
  }

  return `R$ ${Math.round(n)}`;
}

function formatBarValueLabel(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n) || n <= 0) return "";

  const valueToShow = Math.abs(n) >= 10000 ? Math.round(n) : n;

  return valueToShow.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function calcNiceTickStep(maxValue, targetTicks = 6) {
  const max = Math.max(1, Number(maxValue || 0));
  const rough = max / targetTicks;
  const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow10;

  let nice;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 5) nice = 5;
  else nice = 10;

  return nice * pow10;
}

function buildNiceTicks(maxValue, targetTicks = 6) {
  const max = Math.max(1, Number(maxValue || 0));
  const step = calcNiceTickStep(max, targetTicks);
  const top = Math.ceil(max / step) * step;

  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { ticks, domainMax: top };
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

  const compareOptions = useMemo(
    () => [1, 2, 3, 6].filter((n) => n <= Math.max(1, Number(monthsBack || 1) - 1)),
    [monthsBack]
  );

  const defaultCompareBack = compareOptions.includes(2)
    ? 2
    : compareOptions[0] || 1;

  const [mode, setMode] = useState("purchase");
  const [compareBack, setCompareBack] = useState(defaultCompareBack);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState("");
  const [categorySortBy, setCategorySortBy] = useState("baseline");

  useEffect(() => {
    if (!compareOptions.includes(compareBack)) {
      setCompareBack(defaultCompareBack);
    }
  }, [compareBack, compareOptions, defaultCompareBack]);

  const handleModeChange = (_, value) => {
    if (!value) return;
    setMode(value);
  };

  const handleCompareBackChange = (_, value) => {
    if (!value) return;
    setCompareBack(value);
  };

  const handleCategorySortChange = (_, value) => {
    if (!value) return;
    setCategorySortBy(value);
  };

  const comparisonLinePalette = useMemo(
    () => [
      theme.palette.success.main,
      theme.palette.info.main,
      theme.palette.secondary.main,
      theme.palette.warning.main,
      alpha(theme.palette.success.main, 0.72),
      alpha(theme.palette.info.main, 0.72),
    ],
    [theme]
  );

  const analysis = useMemo(() => {
    if (!month) {
      return {
        cutoffDay: 1,
        currentMonthLabel: "",
        comparisonLabel: "mês anterior",
        comparisonShortLabel: "mês anterior",
        currentSpent: 0,
        baselineSpent: 0,
        projectedLinear: 0,
        deltaVsBaseline: 0,
        currentOneOff: 0,
        currentInstallments: 0,
        comparisonRows: [],
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
    const comparisonMonths = Array.from({ length: compareBack }, (_, i) =>
      addMonthsYM(month, -(i + 1))
    );

    const trackedMonths = [month, ...comparisonMonths];
    const comparisonSet = new Set(comparisonMonths);

    const categoryAcc = new Map();

    function emptyDays() {
      return Array.from({ length: selectedMonthDays }, (_, idx) => ({
        day: idx + 1,
        value: 0,
        cumulative: 0,
      }));
    }

    function ensureCategoryRow(catInfo) {
      if (!categoryAcc.has(catInfo.key)) {
        const byMonth = {};
        trackedMonths.forEach((ym) => {
          byMonth[ym] = {
            total: 0,
            days: emptyDays(),
          };
        });

        categoryAcc.set(catInfo.key, {
          key: catInfo.key,
          name: catInfo.name,
          color: catInfo.color || catInfo.fallbackColor,
          byMonth,
        });
      }
      return categoryAcc.get(catInfo.key);
    }

    function addToCategory(catInfo, refYM, day, amount) {
      if (!catInfo?.key || !day || !amount) return;
      if (!trackedMonths.includes(refYM)) return;
      if (day < 1 || day > selectedMonthDays) return;

      const row = ensureCategoryRow(catInfo);
      row.byMonth[refYM].total += amount;
      row.byMonth[refYM].days[day - 1].value += amount;
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

    const emptyBucket = (ym) => ({
      ym,
      full: 0,
      partial: 0,
      oneOffPartial: 0,
      installmentPartial: 0,
      days: Array.from({ length: selectedMonthDays }, (_, idx) => ({
        day: idx + 1,
        value: 0,
        cumulative: 0,
      })),
    });

    const current = monthsMap.get(month) || emptyBucket(month);

    const comparisonRows = comparisonMonths.map((ym, idx) => {
      const row = monthsMap.get(ym) || emptyBucket(ym);
      return {
        ym,
        index: idx,
        key: `comp_${idx + 1}`,
        label: formatMonthBR(ym),
        spent: Number(safeNum(row.partial).toFixed(2)),
        full: Number(safeNum(row.full).toFixed(2)),
        oneOffPartial: Number(safeNum(row.oneOffPartial).toFixed(2)),
        installmentPartial: Number(safeNum(row.installmentPartial).toFixed(2)),
        days: row.days,
      };
    });

    const currentSpent = Number(safeNum(current.partial).toFixed(2));
    const baselineSpent = Number(avg(comparisonRows.map((r) => r.spent)).toFixed(2));
    const deltaVsBaseline = Number((currentSpent - baselineSpent).toFixed(2));

    const monthProgressLinear = cutoffDay / selectedMonthDays;
    const projectedLinear =
      monthProgressLinear > 0
        ? Number((currentSpent / monthProgressLinear).toFixed(2))
        : currentSpent;


    const barData = [
      ...[...comparisonRows].reverse().map((row) => ({
        key: row.key,
        label: row.label,
        ateHoje: row.spent,
        fechado: row.full,
        tipo: "comparison",
      })),
      {
        key: "current",
        label: formatMonthBR(month),
        ateHoje: currentSpent,
        fechado: Number(safeNum(current.full).toFixed(2)),
        tipo: "current",
      },
      {
        key: "baseline",
        label: compareBack === 1 ? "Referência" : `Média ${compareBack}m`,
        ateHoje: baselineSpent,
        fechado: Number(avg(comparisonRows.map((r) => r.full)).toFixed(2)),
        tipo: "baseline",
      },
    ];

    const lineDays = Array.from({ length: selectedMonthDays }, (_, i) => i + 1);

    const lineData = lineDays.map((day) => {
      const item = {
        day,
        atual: Number(safeNum(current.days?.[day - 1]?.cumulative).toFixed(2)),
      };

      comparisonRows.forEach((row) => {
        item[row.key] = Number(safeNum(row.days?.[day - 1]?.cumulative).toFixed(2));
      });

      return item;
    });

    const categoryImpactRows = Array.from(categoryAcc.values())
      .map((row) => {
        const finalizedByMonth = {};

        trackedMonths.forEach((ym) => {
          const base = row.byMonth?.[ym] || {
            total: 0,
            days: emptyDays(),
          };

          let acc = 0;
          const days = (base.days || emptyDays()).map((d) => {
            acc += safeNum(d.value);
            return {
              ...d,
              value: Number(safeNum(d.value).toFixed(2)),
              cumulative: Number(acc.toFixed(2)),
            };
          });

          finalizedByMonth[ym] = {
            total: Number(safeNum(base.total).toFixed(2)),
            days,
          };
        });

        const currentTotal = Number(safeNum(finalizedByMonth[month]?.total).toFixed(2));
        const baselineTotal = Number(
          avg(comparisonMonths.map((ym) => finalizedByMonth[ym]?.total || 0)).toFixed(2)
        );
        const delta = Number((currentTotal - baselineTotal).toFixed(2));

        let pctVsBaseline = 0;
        let isExtrapolated = false;
        let hasBaselineBase = baselineTotal > 0;

        if (baselineTotal > 0) {
          pctVsBaseline = Number(((currentTotal / baselineTotal) * 100).toFixed(1));
          isExtrapolated = pctVsBaseline > 100;
        } else if (currentTotal > 0) {
          pctVsBaseline = 999.9;
          isExtrapolated = true;
          hasBaselineBase = false;
        }

        return {
          key: row.key,
          name: row.name,
          color: row.color || pickFallbackColor(theme, row.key),
          currentTotal,
          baselineTotal,
          delta,
          pctVsBaseline,
          isExtrapolated,
          hasBaselineBase,
          byMonth: finalizedByMonth,
        };
      })
      .filter((row) => row.currentTotal > 0 || row.baselineTotal > 0);

    const categoryLineDataByKey = {};
    categoryImpactRows.forEach((row) => {
      categoryLineDataByKey[row.key] = lineDays.map((day) => {
        const item = {
          day,
          atual: Number(safeNum(row.byMonth?.[month]?.days?.[day - 1]?.cumulative).toFixed(2)),
        };

        comparisonRows.forEach((comparison) => {
          item[comparison.key] = Number(
            safeNum(row.byMonth?.[comparison.ym]?.days?.[day - 1]?.cumulative).toFixed(2)
          );
        });

        return item;
      });
    });

    const comparisonLabel =
      compareBack === 1 ? "mês anterior" : `média dos últimos ${compareBack} meses`;

    const comparisonShortLabel =
      compareBack === 1 ? comparisonRows[0]?.label || "mês anterior" : `média ${compareBack}m`;

    return {
      cutoffDay,
      currentMonthLabel: formatMonthBR(month),
      comparisonLabel,
      comparisonShortLabel,
      currentSpent,
      baselineSpent,
      projectedLinear,
      deltaVsBaseline,
      currentOneOff: Number(safeNum(current.oneOffPartial).toFixed(2)),
      currentInstallments: Number(safeNum(current.installmentPartial).toFixed(2)),
      comparisonRows,
      barData,
      lineData,
      categoryImpactRows,
      categoryLineDataByKey,
    };
  }, [month, monthsBack, compareBack, transactions, excludeResolver, mode, categoriesById, theme]);

  const sortedCategoryRows = useMemo(() => {
    const rows = [...(analysis.categoryImpactRows || [])];

    if (categorySortBy === "current") {
      rows.sort((a, b) => {
        if (b.currentTotal !== a.currentTotal) return b.currentTotal - a.currentTotal;
        return b.baselineTotal - a.baselineTotal;
      });
      return rows;
    }

    rows.sort((a, b) => {
      if (b.baselineTotal !== a.baselineTotal) return b.baselineTotal - a.baselineTotal;
      return b.currentTotal - a.currentTotal;
    });
    return rows;
  }, [analysis.categoryImpactRows, categorySortBy]);

  const topCategoryRows = useMemo(() => {
    return sortedCategoryRows
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
    analysis.deltaVsBaseline > 0
      ? "error"
      : analysis.deltaVsBaseline < 0
        ? "success"
        : "info";

  const barChartScale = useMemo(() => {
    const values = (analysis.barData || []).flatMap((item) => [
      Number(item?.ateHoje || 0),
      Number(item?.fechado || 0),
    ]);
    return buildNiceTicks(Math.max(0, ...values), 5);
  }, [analysis.barData]);

  const lineChartScale = useMemo(() => {
    const values = (analysis.lineData || []).flatMap((item) =>
      Object.entries(item || {})
        .filter(([key]) => key !== "day")
        .map(([, value]) => Number(value || 0))
    );
    return buildNiceTicks(Math.max(0, ...values), 6);
  }, [analysis.lineData]);

  const selectedCategoryLineScale = useMemo(() => {
    const values = (selectedCategoryLineData || []).flatMap((item) =>
      Object.entries(item || {})
        .filter(([key]) => key !== "day")
        .map(([, value]) => Number(value || 0))
    );
    return buildNiceTicks(Math.max(0, ...values), 6);
  }, [selectedCategoryLineData]);


  const modeLabel = mode === "purchase" ? "compra consolidada" : "fatura/competência";

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
                Comparativo até o dia {analysis.cutoffDay} • {analysis.currentMonthLabel} •{" "}
                {modeLabel}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={mode}
                onChange={handleModeChange}
                sx={{
                  gap: 0.9,
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

              <ToggleButtonGroup
                size="small"
                exclusive
                value={compareBack}
                onChange={handleCompareBackChange}
                sx={{
                  gap: 0.9,
                  "& .MuiToggleButton-root": {
                    px: 1.05,
                    py: 0.5,
                    fontWeight: 900,
                    textTransform: "none",
                    borderRadius: 1,
                  },
                }}
              >
                {compareOptions.map((n) => (
                  <ToggleButton key={n} value={n}>
                    {n === 1 ? "1 mês" : `${n} meses`}
                  </ToggleButton>
                ))}
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
              label={`${analysis.comparisonLabel} até dia ${analysis.cutoffDay}`}
              value={money(analysis.baselineSpent)}
              helper={analysis.comparisonShortLabel}
              tone="info"
            />

            <MiniKpi
              icon={
                analysis.deltaVsBaseline > 0 ? TrendingUpRoundedIcon : TrendingDownRoundedIcon
              }
              label={`Diferença vs ${analysis.comparisonLabel}`}
              value={`${analysis.deltaVsBaseline >= 0 ? "+" : ""}${money(analysis.deltaVsBaseline)}`}
              helper={
                analysis.deltaVsBaseline > 0
                  ? `acima da ${analysis.comparisonLabel}`
                  : analysis.deltaVsBaseline < 0
                    ? `abaixo da ${analysis.comparisonLabel}`
                    : `igual à ${analysis.comparisonLabel}`
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
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    comparação direta do acumulado até hoje
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    atual, meses comparados e base média até o dia {analysis.cutoffDay}
                  </Typography>
                </Stack>

                <Box sx={{ width: "100%", height: 310 }}>
                  <ResponsiveContainer>
                    <BarChart data={analysis.barData} barGap={6}>
                      <CartesianGrid
                        strokeDasharray="4 4"
                        vertical={false}
                        stroke={alpha(theme.palette.text.secondary, 0.22)}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, barChartScale.domainMax]}
                        ticks={barChartScale.ticks}
                        axisLine={false}
                        tickLine={false}
                        width={72}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary, fontWeight: 800 }}
                        tickFormatter={(v) => formatAxisMoneyShort(v)}
                      />
                      <Tooltip content={<ChartTooltip money={money} />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        dataKey="fechado"
                        name="Mês fechado"
                        radius={[6, 6, 0, 0]}
                        fill={alpha(theme.palette.grey[500], 0.24)}
                      >
                        <LabelList
                          dataKey="fechado"
                          position="top"
                          offset={6}
                          formatter={formatBarValueLabel}
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            fill: theme.palette.text.secondary,
                          }}
                        />
                      </Bar>

                      <Bar
                        dataKey="ateHoje"
                        name={`Até dia ${analysis.cutoffDay}`}
                        radius={[6, 6, 0, 0]}
                        fill={theme.palette.warning.main}
                      >
                        <LabelList
                          dataKey="ateHoje"
                          position="top"
                          offset={6}
                          formatter={formatBarValueLabel}
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            fill: theme.palette.text.primary,
                          }}
                        />
                      </Bar>
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
                    mês atual vs {analysis.comparisonLabel}
                  </Typography>
                </Stack>

                <Box sx={{ width: "100%", height: 310 }}>
                  <ResponsiveContainer>
                    <LineChart data={analysis.lineData}>
                      <CartesianGrid
                        strokeDasharray="4 4"
                        vertical={false}
                        stroke={alpha(theme.palette.text.secondary, 0.22)}
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, lineChartScale.domainMax]}
                        ticks={lineChartScale.ticks}
                        axisLine={false}
                        tickLine={false}
                        width={72}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary, fontWeight: 800 }}
                        tickFormatter={(v) => formatAxisMoneyShort(v)}
                      />
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
                        stroke={theme.palette.error.main}
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />

                      {analysis.comparisonRows.map((row, idx) => (
                        <Line
                          key={row.key}
                          type="monotone"
                          dataKey={row.key}
                          name={row.label}
                          stroke={comparisonLinePalette[idx % comparisonLinePalette.length]}
                          strokeWidth={2.4}
                          strokeDasharray="7 4"
                          dot={false}
                        />
                      ))}
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
                      Categorias
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      barra = % do mês atual sobre {analysis.comparisonLabel}
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
                    <ToggleButton value="baseline">Ordenar: base</ToggleButton>
                    <ToggleButton value="current">Ordenar: atual</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>

                <Box
                  sx={(theme) => ({
                    flex: 1,
                    maxHeight: 385,
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

                        const progressValue = row.hasBaselineBase
                          ? Math.min(Math.max(row.pctVsBaseline || 0, 0), 100)
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
                                      {money(row.currentTotal)} vs {money(row.baselineTotal)}
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
                                    {row.hasBaselineBase
                                      ? `${formatPercentBR(row.pctVsBaseline)} da base comparada`
                                      : "sem base comparativa"}
                                  </Typography>

                                  {row.isExtrapolated ? (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: "error.main",
                                        fontWeight: 900,
                                      }}
                                    >
                                      acima de 100% da base
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
                      acumulado atual vs base comparativa
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
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", fontWeight: 700 }}
                      >
                        {money(selectedCategory.currentTotal)} vs {money(selectedCategory.baselineTotal)}
                      </Typography>
                    </Stack>
                  ) : null}
                </Stack>

                <Box sx={{ width: "100%", height: 385 }}>
                  <ResponsiveContainer>
                    <LineChart data={selectedCategoryLineData}>
                      <CartesianGrid
                        strokeDasharray="4 4"
                        vertical={false}
                        stroke={alpha(theme.palette.text.secondary, 0.22)}
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, selectedCategoryLineScale.domainMax]}
                        ticks={selectedCategoryLineScale.ticks}
                        axisLine={false}
                        tickLine={false}
                        width={72}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary, fontWeight: 800 }}
                        tickFormatter={(v) => formatAxisMoneyShort(v)}
                      />
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
                        stroke={selectedCategory?.color || theme.palette.error.main}
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />

                      {analysis.comparisonRows.map((row, idx) => (
                        <Line
                          key={row.key}
                          type="monotone"
                          dataKey={row.key}
                          name={row.label}
                          stroke={comparisonLinePalette[idx % comparisonLinePalette.length]}
                          strokeWidth={2.4}
                          strokeDasharray="7 4"
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Stack>
            </Box>
          </Box>

          <Box sx={{ display: "none" }}>
            {typeof window !== "undefined"
              ? (() => {
                window.debugComparativoCategorias = sortedCategoryRows || [];
                return null;
              })()
              : null}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}