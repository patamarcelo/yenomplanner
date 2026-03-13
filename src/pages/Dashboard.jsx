// src/pages/Dashboard.jsx
import React, { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Box, Card, CardContent, Stack, Typography, LinearProgress, Divider } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ViewWeekRoundedIcon from "@mui/icons-material/ViewWeekRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";

import { formatBRL } from "../utils/money";
import { selectHideValues } from "../store/uiSlice";
import { selectTransactionsUi } from "../store/transactionsSlice";
import Spinner from "../components/ui/Spinner";

import AccountsMatrix from "../components/AccountsMatrix";

import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

import { Button, Collapse } from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";

import DashboardChart from "../components/DashboardChart";
import DashboardChartNivo from "../components/DashboardChartNivo";
import DashboardMonthlyPace from "../components/DashboardMonthlyPace";



// =============================
// DEBUG
// =============================
const DEBUG = false;
// eslint-disable-next-line no-console
const dbg = (...args) => DEBUG && console.log(...args);
// eslint-disable-next-line no-console
const dbgGroup = (title, fn) => {
  if (!DEBUG) return;
  console.groupCollapsed(title);
  try {
    fn?.();
  } finally {
    console.groupEnd();
  }
};

// =============================
// Helpers minimalistas
// =============================



function normalizeISODate(d) {
  if (!d) return "";
  if (d instanceof Date && !isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  const s = String(d);
  if (s.includes("T")) return s.slice(0, 10);
  return s.slice(0, 10);
}

function ymFromISODate(d) {
  const iso = normalizeISODate(d);
  return iso ? iso.slice(0, 7) : "";
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

function dayFromISODate(d) {
  const iso = normalizeISODate(d);
  if (!iso || iso.length < 10) return null;
  const n = Number(iso.slice(8, 10));
  return Number.isFinite(n) ? n : null;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function sum(arr) {
  return (arr || []).reduce((a, b) => a + b, 0);
}

function normalizeDirectionFromTxn(t) {
  const d = String(t?.direction || "").toLowerCase();
  if (["income", "receita", "entrada"].includes(d)) return "income";
  return "expense";
}

function signedAmountNormalized(t) {
  const v = Number(t?.amount ?? t?.value ?? 0);
  const abs = Math.abs(v);
  if (v < 0) return v;
  return normalizeDirectionFromTxn(t) === "income" ? abs : -abs;
}

function isInstallment(t) {
  const k = String(t?.kind || "").toLowerCase();
  return ["installment", "parcelado", "parcela"].includes(k);
}

function addMonthsYM(ym, add = 1) {
  const s = String(ym || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return "";
  const base = y * 12 + (mo - 1) + Number(add || 0);
  const y2 = Math.floor(base / 12);
  const m2 = (base % 12) + 1;
  return `${y2}-${String(m2).padStart(2, "0")}`;
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

function formatMonthBR(ym) {
  if (!ym) return "-";
  const [y, m] = String(ym).split("-").map(Number);
  if (!y || !m) return String(ym);
  const dt = new Date(y, m - 1, 1);
  const s = dt.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  return s.replace(" de ", "/");
}

function cardBg(theme, tone = "primary") {
  const map = {
    primary: theme.palette.primary.main,
    info: theme.palette.info.main,
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    error: theme.palette.error.main,
  };
  const base = map[tone] || map.primary;

  return {
    borderRadius: 2,
    border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
    background: `linear-gradient(180deg, ${alpha(base, 0.07)}, ${alpha(theme.palette.background.paper, 0.85)})`,
  };
}

// =============================
// Datas de competência (parcelas)
// =============================
function daysInMonthUTC(y, m1to12) {
  return new Date(Date.UTC(y, m1to12, 0)).getUTCDate();
}

function parseYMD(ymd) {
  const iso = normalizeISODate(ymd);
  const [y, m, d] = String(iso || "").slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function fmtYMD(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addMonthsClampDay(ymd, add) {
  const p = parseYMD(ymd);
  if (!p) return null;

  let y = p.y;
  let m = p.m + Number(add || 0);
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }

  const dim = daysInMonthUTC(y, m);
  const d = Math.min(p.d, dim);
  return fmtYMD(y, m, d);
}

function monthsDiffYM(fromYM, toYM) {
  const a = String(fromYM || "").match(/^(\d{4})-(\d{2})$/);
  const b = String(toYM || "").match(/^(\d{4})-(\d{2})$/);
  if (!a || !b) return 0;
  const y1 = Number(a[1]), m1 = Number(a[2]);
  const y2 = Number(b[1]), m2 = Number(b[2]);
  return (y2 * 12 + (m2 - 1)) - (y1 * 12 + (m1 - 1));
}

function getInstallmentIndex(t) {
  const n = Number(
    t?.installmentIndex ??
    t?.installment_index ??
    t?.installmentNo ??
    t?.installment_no ??
    t?.installment ??
    1
  );
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function getInstallmentsTotal(t) {
  const n = Number(
    t?.installmentsTotal ??
    t?.installments_total ??
    t?.installments ??
    t?.totalInstallments ??
    t?.installmentsCount ??
    0
  );
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function resolveCompetenceDateYMD(t) {
  const purchase = normalizeISODate(
    t?.purchaseDate ?? t?.purchase_date ?? t?.chargeDate ?? t?.charge_date ?? ""
  );
  if (!purchase) return "";

  const pYM = ymFromISODate(purchase);
  const invYM = normalizeYM(t?.invoiceMonth ?? t?.invoice_month ?? "");

  if (invYM) {
    const diff = monthsDiffYM(pYM, invYM);
    return addMonthsClampDay(purchase, diff) || purchase;
  }

  if (isInstallment(t)) {
    const idx = getInstallmentIndex(t);
    return addMonthsClampDay(purchase, Math.max(0, idx - 1)) || purchase;
  }

  return purchase;
}

function resolveInstallmentAmount(t, mode) {
  const raw = Math.abs(Math.min(0, signedAmountNormalized(t)));
  if (!raw) return 0;

  if (!isInstallment(t)) return raw;

  if (mode === "consolidate_purchase") {
    return raw;
  }

  const explicitPart = Number(
    t?.installmentAmount ?? t?.installment_amount ?? t?.perInstallment ?? t?.per_installment ?? NaN
  );
  if (Number.isFinite(explicitPart) && explicitPart > 0) return explicitPart;

  const totalN = getInstallmentsTotal(t);
  if (totalN > 1) return Number((raw / totalN).toFixed(2));

  return raw;
}

// =============================
// UI
// =============================
function KpiCard({ title, value, icon: Icon, tone = "neutral" }) {
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
              variant="h6"
              sx={{
                fontWeight: 950,
                letterSpacing: -0.4,
                lineHeight: 1.1,
                wordBreak: "break-word",
              }}
            >
              {value}
            </Typography>
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

function StackedDayTooltip({ active, payload, catMeta, money, theme }) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload?.[0]?.payload || {};
  const sp = row.__samplePurchase ? row.__samplePurchase : "";

  const items = (payload || [])
    .filter((p) => p && p.dataKey && p.dataKey !== "total" && Number(p.value) > 0)
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0));

  const total = (payload || []).find((p) => p?.dataKey === "total")?.value || 0;

  function brFromISO(iso) {
    const s = String(iso || "").slice(0, 10);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "—";
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 0.6,
        border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
        background: alpha(theme.palette.background.paper, 0.95),
        boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
        minWidth: 220,
      }}
    >
      <Stack spacing={0.8}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="baseline"
          sx={{ my: 3 }}
        >
          <Typography sx={{ fontWeight: 950, fontSize: 12 }}>Dia {brFromISO(sp)}</Typography>
          <Typography sx={{ fontWeight: 950, fontSize: 12 }}>{money(total)}</Typography>
        </Stack>

        <Divider sx={{ opacity: 0.6 }} />

        {items.slice(0, 10).map((it) => {
          const meta = catMeta?.get?.(String(it.dataKey)) || {};
          return (
            <Stack
              key={String(it.dataKey)}
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: meta.color || pickFallbackColor(theme, it.dataKey),
                    flexShrink: 0,
                    boxShadow: `0 0 0 3px ${alpha(
                      meta.color || pickFallbackColor(theme, it.dataKey),
                      0.12
                    )}`,
                  }}
                />
                <Typography sx={{ fontSize: 12, fontWeight: 850 }} noWrap>
                  {meta.name || String(it.dataKey)}
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: 12, fontWeight: 950, whiteSpace: "nowrap" }}>
                {money(it.value)}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

// =============================
// Dashboard
// =============================
export default function Dashboard() {
  const theme = useTheme();

  const month = useSelector((s) => s.finance.month);
  const txns = useSelector(selectTransactionsUi);
  const accounts = useSelector((s) => s.accounts.accounts);

  const hideValues = useSelector(selectHideValues);

  const accountsStatus = useSelector((s) => s.accounts.status);
  const txStatus = useSelector((s) => s.transactions.status);
  const bootstrapStatus = useSelector((s) => s.bootstrap.status);
  const isBootLoading = bootstrapStatus === "loading";

  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllCards, setShowAllCards] = useState(false);

  const categories = useSelector((s) => s.categories?.items || s.categories?.categories || []);

  const hasAnyData =
    (accounts?.length || 0) > 0 ||
    (txns?.length || 0) > 0 ||
    (categories?.length || 0) > 0;

  const [vizRef, setVizRef] = useState("purchase");
  const [vizInstallments, setVizInstallments] = useState("consolidate_purchase");
  const [chartLib, setChartLib] = useState("recharts");

  const maskMoney = (formatted) => (hideValues ? "••••" : formatted);
  const money = (n) => maskMoney(formatBRL(Number(n || 0)));



  const categoriesById = useMemo(() => {
    const m = new Map();
    (categories || []).forEach((c) => {
      if (!c?.id) return;
      m.set(String(c.id), c);
    });
    return m;
  }, [categories]);

  const isTransferCategory = useMemo(() => {
    return (t) => {
      const catId = String(t?.categoryId ?? t?.category_id ?? t?.category ?? "");
      const cat = categoriesById?.get?.(catId);

      const catName = String(cat?.name || catId || "")
        .trim()
        .toLowerCase();

      return catName === "transferencia" || catName === "transferência";
    };
  }, [categoriesById]);


  const onChangeVizRef = (_, v) => {
    if (!v) return;
    setVizRef(v);
  };

  const onChangeVizInstallments = (_, v) => {
    if (!v) return;
    setVizInstallments(v);
  };

  const accountsById = useMemo(() => {
    const m = {};
    for (const a of accounts || []) {
      if (!a?.id) continue;
      m[String(a.id)] = a;
    }
    return m;
  }, [accounts]);

  const resolveAccountIdFromTxn = useMemo(() => {
    return (t) => {
      const apiAcc =
        t?.accountId ??
        t?.account_id ??
        t?.account?.id ??
        (typeof t?.account === "string" || typeof t?.account === "number" ? t.account : null);

      if (apiAcc != null) return String(apiAcc);
      return t?.accountId ? String(t.accountId) : null;
    };
  }, []);

  function isBillFromInvoice(b) {
    const notes = String(b?.notes || "").trim().toLowerCase();

    return (
      notes.startsWith("auto-gerado ao fechar fatura") ||
      (notes.includes("auto-gerado") && notes.includes("fechar fatura"))
    );
  }

  const isCardTxn = useMemo(() => {
    return (t) => {
      if (!t) return false;

      const billId = (t?.billId ?? t?.bill_id ?? "").toString().trim();
      if (billId) return false;

      const invYM = normalizeYM(t?.invoiceMonth ?? t?.invoice_month ?? "");
      if (invYM) return true;

      const accId = resolveAccountIdFromTxn(t);
      if (!accId) return false;

      const acc = accountsById?.[String(accId)];
      return String(acc?.type || "").toLowerCase() === "credit_card";
    };
  }, [resolveAccountIdFromTxn, accountsById]);

  const getTxnMonthKey = useMemo(() => {
    return (t) => {
      const invYM = normalizeYM(t?.invoiceMonth ?? t?.invoice_month ?? "");
      if (invYM) return { kind: "card", ym: invYM };

      const d = t?.purchaseDate ?? t?.purchase_date ?? t?.chargeDate ?? t?.charge_date ?? "";
      const ym = ymFromISODate(d);
      return { kind: "normal", ym };
    };
  }, []);

  const targetInvoiceYM = useMemo(() => addMonthsYM(month, 1), [month]);

  const monthTx = useMemo(() => {
    if (!month) return [];

    const out = (txns || []).filter((t) => {
      const billId = String(t?.billId ?? t?.bill_id ?? "").trim();
      if (billId) return false;
      if (isTransferCategory(t)) return false;
      const k = getTxnMonthKey(t);
      if (k.kind === "card") return k.ym === targetInvoiceYM;
      return k.ym === month;
    });

    return out;
  }, [txns, month, targetInvoiceYM, getTxnMonthKey, isTransferCategory]);


  const totalEntradaMes = useMemo(() => {
    if (!month) return 0;

    return sum(
      (txns || [])
        .filter((t) => {
          if (normalizeDirectionFromTxn(t) !== "income") return false;
          const d = t?.purchaseDate ?? t?.purchase_date ?? t?.chargeDate ?? t?.charge_date ?? "";
          return ymFromISODate(d) === month;
        })
        .map((t) => Math.max(0, signedAmountNormalized(t)))
    );
  }, [txns, month]);

  const totalSaidaMes = useMemo(() => {
    return Math.abs(sum(monthTx.map((t) => Math.min(0, signedAmountNormalized(t)))));
  }, [monthTx]);

  const totalCartoesMes = useMemo(() => {
    return sum(
      monthTx
        .filter((t) => normalizeYM(t?.invoiceMonth ?? t?.invoice_month ?? ""))
        .map((t) => Math.abs(Math.min(0, signedAmountNormalized(t))))
    );
  }, [monthTx]);

  const bills = useSelector((s) => s.bills?.items || s.bills?.bills || []);

  const totalDespesasMensais = useMemo(() => {
    if (!month) return 0;

    const ym = String(month);

    return (bills || [])
      .filter((b) => {
        if (!b?.active) return false;
        if (isBillFromInvoice(b)) return false;

        const kind = String(b?.kind || "").toLowerCase();
        if (kind === "cc_invoice" || kind === "credit_card_invoice") return false;

        const start = String(b?.startMonth || "").slice(0, 7);
        const end = String(b?.endMonth || "").slice(0, 7) || start;
        if (!/^\d{4}-\d{2}$/.test(start)) return false;

        return ym >= start && ym <= end;
      })
      .reduce((acc, b) => acc + Math.abs(Number(b?.defaultAmount || 0)), 0);
  }, [bills, month]);

  const totalAvulso = useMemo(() => {
    return sum(
      monthTx
        .filter((t) => normalizeDirectionFromTxn(t) === "expense")
        .filter((t) => String(t?.kind || "").toLowerCase() === "one_off")
        .map((t) => Math.abs(Math.min(0, signedAmountNormalized(t))))
    );
  }, [monthTx]);

  const totalParcelamento = useMemo(() => {
    return sum(
      monthTx
        .filter((t) => normalizeDirectionFromTxn(t) === "expense")
        .filter((t) => isInstallment(t))
        .map((t) => Math.abs(Math.min(0, signedAmountNormalized(t))))
    );
  }, [monthTx]);

  const resolveVizDateYMD = useMemo(() => {
    return (t) => {
      const purchase = normalizeISODate(
        t?.purchaseDate ?? t?.purchase_date ?? t?.chargeDate ?? t?.charge_date ?? ""
      );
      if (!purchase) return "";

      if (vizRef === "purchase") return purchase;

      if (vizInstallments === "consolidate_purchase" && isInstallment(t)) {
        return purchase;
      }

      return resolveCompetenceDateYMD(t) || purchase;
    };
  }, [vizRef, vizInstallments]);

  const resolveVizAmountExpense = useMemo(() => {
    return (t) => {
      if (normalizeDirectionFromTxn(t) !== "expense") return 0;

      if (vizInstallments === "hide" && isInstallment(t)) return 0;

      if (isInstallment(t)) {
        return resolveInstallmentAmount(
          t,
          vizInstallments === "consolidate_purchase" ? "consolidate_purchase" : "parts"
        );
      }

      return Math.abs(Math.min(0, signedAmountNormalized(t)));
    };
  }, [vizInstallments]);

  const monthVizTx = useMemo(() => {
    if (!month) return [];

    const seenConsolidated = new Set();
    const out = [];

    for (const t of txns || []) {
      if (!t) continue;
      if (!isCardTxn(t)) continue;
      if (normalizeDirectionFromTxn(t) !== "expense") continue;
      if (isTransferCategory(t)) continue;

      const refYMD = resolveVizDateYMD(t);
      if (!refYMD) continue;
      if (ymFromISODate(refYMD) !== month) continue;

      if (vizInstallments === "hide" && isInstallment(t)) continue;

      if (vizInstallments === "consolidate_purchase" && isInstallment(t)) {
        const gid = String(
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

        const purchase = normalizeISODate(t?.purchaseDate ?? t?.purchase_date ?? "");
        const raw = Math.abs(Math.min(0, signedAmountNormalized(t)));
        const fallbackKey = `${purchase}::${String(t?.description || t?.merchant || "").slice(
          0,
          80
        )}::${raw}`;

        const key = gid ? `gid:${gid}` : `fb:${fallbackKey}`;
        if (seenConsolidated.has(key)) continue;
        seenConsolidated.add(key);
      }

      const v = resolveVizAmountExpense(t);
      if (!v) continue;

      out.push(t);
    }

    return out;
  }, [txns, month, vizInstallments, resolveVizDateYMD, resolveVizAmountExpense, isCardTxn, isTransferCategory]);

  const chartStack = useMemo(() => {
    if (!month) return { data: [], catKeys: [], catMeta: new Map() };

    const [y, m] = String(month).split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    const byDay = new Map();
    for (let d = 1; d <= daysInMonth; d++) {
      byDay.set(String(d), {
        label: String(d),
        total: 0,
        __samplePurchase: "",
        __sampleCompetence: "",
        __mixCount: 0,
      });
    }

    const catMeta = new Map();
    const catKeysSet = new Set();

    for (const t of monthVizTx || []) {
      const purchase = normalizeISODate(
        t?.purchaseDate ?? t?.purchase_date ?? t?.chargeDate ?? t?.charge_date ?? ""
      );
      if (!purchase) continue;

      const competence = resolveCompetenceDateYMD(t);
      const refYMD = resolveVizDateYMD(t);
      if (!refYMD) continue;

      const dayN = dayFromISODate(refYMD);
      const day = String(dayN || "");
      if (!byDay.has(day)) continue;

      const v = resolveVizAmountExpense(t);
      if (!v) continue;

      const catId = String(t?.categoryId ?? t?.category_id ?? t?.category ?? "outros");
      const cat = categoriesById?.get?.(catId);
      const key = String(cat?.id ?? catId);

      catKeysSet.add(key);
      if (!catMeta.has(key)) {
        catMeta.set(key, {
          name: cat?.name || catId,
          color: cat?.color || cat?.tint || null,
        });
      }

      const row = byDay.get(day);

      if (!row.__samplePurchase) row.__samplePurchase = purchase;
      if (!row.__sampleCompetence) row.__sampleCompetence = competence;
      if (row.__samplePurchase && row.__samplePurchase !== purchase) row.__mixCount += 1;
      if (row.__sampleCompetence && row.__sampleCompetence !== competence) row.__mixCount += 1;

      row[key] = (row[key] || 0) + v;
      row.total += v;
    }

    const totalsByCat = new Map();
    for (const row of byDay.values()) {
      for (const k of catKeysSet) {
        const v = Number(row[k] || 0);
        if (!v) continue;
        totalsByCat.set(k, (totalsByCat.get(k) || 0) + v);
      }
    }

    const catKeys = Array.from(catKeysSet).sort(
      (a, b) => (totalsByCat.get(b) || 0) - (totalsByCat.get(a) || 0)
    );

    const data = Array.from(byDay.values()).map((r) => {
      const out = { ...r };
      out.total = Number((out.total || 0).toFixed(2));
      for (const k of catKeys) out[k] = Number((out[k] || 0).toFixed(2));
      return out;
    });

    return { data, catKeys, catMeta };
  }, [month, monthVizTx, categoriesById, resolveVizDateYMD, resolveVizAmountExpense]);

  const maxChartValue = useMemo(() => {
    return Math.max(0, ...(chartStack.data || []).map((d) => Number(d.total || 0)));
  }, [chartStack]);

  const categoriesRank = useMemo(() => {
    const rowsMap = new Map();

    for (const t of monthVizTx || []) {
      const v = resolveVizAmountExpense(t);
      if (!v) continue;

      const catId = String(t?.categoryId ?? t?.category_id ?? t?.category ?? "outros");
      const cat = categoriesById?.get?.(catId);

      const key = String(cat?.id ?? catId);
      const name = String(cat?.name ?? catId);
      const color = cat?.color ?? cat?.tint ?? null;

      const cur = rowsMap.get(key) || { key, name, color, total: 0 };
      cur.total += v;
      if (!cur.color && color) cur.color = color;
      if (!cur.name && name) cur.name = name;
      rowsMap.set(key, cur);
    }

    const rows = Array.from(rowsMap.values())
      .map((r) => ({ ...r, total: Number((r.total || 0).toFixed(2)) }))
      .sort((a, b) => (b.total || 0) - (a.total || 0));

    const totalGastoMes = rows.reduce((acc, r) => acc + Number(r.total || 0), 0);
    return { rows, totalGastoMes: Number(totalGastoMes.toFixed(2)) };
  }, [monthVizTx, categoriesById, resolveVizAmountExpense]);

  const invoicesByCard = useMemo(() => {
    const sums = new Map();
    const invYMByAcc = new Map();

    const pad2 = (n) => String(n).padStart(2, "0");

    const brFromYMAndDay = (ym, day) => {
      if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "—";
      const [yy, mm] = ym.split("-").map(Number);
      if (!Number.isFinite(yy) || !Number.isFinite(mm)) return "—";

      const dueDay = Number(day);
      if (!Number.isFinite(dueDay) || dueDay < 1) return "—";

      const lastDay = new Date(yy, mm, 0).getDate();
      const dd = Math.min(dueDay, lastDay);

      return `${pad2(dd)}/${pad2(mm)}/${yy}`;
    };

    const getDueDayFromAccount = (a) => {
      const v =
        a?.statement?.dueDay ??
        a?.statement?.due_day ??
        a?.dueDay ??
        a?.due_day;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    for (const t of monthTx || []) {
      const invYM = normalizeYM(t?.invoiceMonth ?? t?.invoice_month ?? "");
      if (!invYM) continue;

      if (normalizeDirectionFromTxn(t) !== "expense") continue;

      const accId =
        t?.accountId ??
        t?.account_id ??
        t?.account?.id ??
        (typeof t?.account === "string" || typeof t?.account === "number" ? t.account : null);

      if (!accId) continue;

      const v = Math.abs(Math.min(0, signedAmountNormalized(t)));
      if (!v) continue;

      const k = String(accId);

      sums.set(k, (sums.get(k) || 0) + v);

      const prev = invYMByAcc.get(k);
      if (!prev || String(invYM).localeCompare(String(prev)) > 0) {
        invYMByAcc.set(k, invYM);
      }
    }

    return Array.from(sums.entries())
      .map(([accId, total]) => {
        const a = accountsById?.[String(accId)] || {};

        const invYM = invYMByAcc.get(String(accId)) || "";
        const dueDay = getDueDayFromAccount(a);
        const dueLabel = dueDay ? brFromYMAndDay(invYM, dueDay) : "—";

        return {
          id: String(accId),
          name: a?.name || "Cartão",
          color: a?.color || null,
          total: Number((total || 0).toFixed(2)),
          dueLabel,
        };
      })
      .sort((a, b) => (b.total || 0) - (a.total || 0));
  }, [monthTx, accountsById]);

  const totalInvoicesMonth = useMemo(() => {
    return Number(
      (invoicesByCard || []).reduce((acc, r) => acc + Number(r.total || 0), 0).toFixed(2)
    );
  }, [invoicesByCard]);

  if ((isBootLoading || accountsStatus === "loading" || txStatus === "loading") && !hasAnyData) {
    return <Spinner status="loading" />;
  }

  const installmentsLabel =
    vizInstallments === "parts"
      ? "parcelas"
      : vizInstallments === "consolidate_purchase"
        ? "consolidado"
        : "sem parcelados";

  return (
    <Stack spacing={2.25} sx={{ width: "100%" }}>
      {isBootLoading && hasAnyData ? (
        <Box sx={{ width: "100%" }}>
          <LinearProgress />
        </Box>
      ) : null}

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
        <KpiCard title="Total de entradas" value={money(totalEntradaMes)} icon={TrendingUpRoundedIcon} tone="good" />
        <KpiCard title="Total de saídas" value={money(totalSaidaMes + totalDespesasMensais)} icon={TrendingDownRoundedIcon} tone="bad" />
        <KpiCard title="Total em cartões" value={money(totalCartoesMes)} icon={CreditCardRoundedIcon} tone="info" />
        <KpiCard title="Despesas mensais" value={money(totalDespesasMensais)} icon={CalendarMonthRoundedIcon} tone="bad" />
        <KpiCard title="Total avulso" value={money(totalAvulso)} icon={BoltRoundedIcon} tone="neutral" />
        <KpiCard title="Total parcelamento" value={money(totalParcelamento)} icon={ViewWeekRoundedIcon} tone="info" />
      </Box>

      <Box
        sx={{
          width: "100%",
          display: "grid",
          gap: 2,
          alignItems: "stretch",
          gridTemplateColumns: { xs: "1fr" },
        }}
      >
        <Card sx={(t) => cardBg(t, "primary")}>
          <CardContent sx={{ p: 2.25 }}>
            <Stack spacing={1.2}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 950, letterSpacing: -0.4 }}>Despesas por dia</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    referência: {vizRef === "purchase" ? "compra" : "competência"} • {formatMonthBR(month)} • {installmentsLabel}
                  </Typography>
                </Stack>

                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                  sx={{ justifyContent: "flex-end" }}
                >
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={vizRef}
                    onChange={onChangeVizRef}
                    sx={{
                      "& .MuiToggleButton-root": { px: 1.1, py: 0.55, fontWeight: 900, textTransform: "none" },
                    }}
                  >
                    <ToggleButton value="purchase">Compra</ToggleButton>
                    <ToggleButton value="competence">Competência (fatura)</ToggleButton>
                  </ToggleButtonGroup>

                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={vizInstallments}
                    onChange={onChangeVizInstallments}
                    sx={{
                      "& .MuiToggleButton-root": { px: 1.1, py: 0.55, fontWeight: 900, textTransform: "none" },
                    }}
                  >
                    <ToggleButton value="parts">Parcelados: parcela</ToggleButton>
                    <ToggleButton value="consolidate_purchase">Consolidado na compra</ToggleButton>
                    <ToggleButton value="hide">Ocultar</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
              </Stack>

              <Box sx={{ width: "100%", height: 360, minHeight: 360 }}>
                {chartLib === "nivo" ? (
                  <DashboardChartNivo
                    data={chartStack.data}
                    catKeys={chartStack.catKeys}
                    catMeta={chartStack.catMeta}
                    maxChartValue={maxChartValue}
                    hideValues={hideValues}
                    money={money}
                    theme={theme}
                    formatBRL={formatBRL}
                    pickFallbackColor={pickFallbackColor}
                  />
                ) : (
                  <DashboardChart
                    data={chartStack.data}
                    catKeys={chartStack.catKeys}
                    catMeta={chartStack.catMeta}
                    maxChartValue={maxChartValue}
                    hideValues={hideValues}
                    money={money}
                    theme={theme}
                    vizRef={vizRef}
                    formatBRL={formatBRL}
                    month={month}
                    pickFallbackColor={pickFallbackColor}
                    StackedDayTooltip={StackedDayTooltip}
                  />
                )}
              </Box>

              <Divider />
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Box
        sx={{
          width: "100%",
          display: "grid",
          gap: 2,
          minHeight: "350px",
          alignItems: "stretch",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <Card sx={(t) => cardBg(t, "info")}>
          <CardContent sx={{ p: 2.25, height: "100%" }}>
            <Stack spacing={1} sx={{ height: "100%" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Stack spacing={0.2}>
                  <Typography sx={{ fontWeight: 950, letterSpacing: -0.4 }}>Categorias</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    referência: {vizRef === "purchase" ? "compra" : "competência"} • {formatMonthBR(month)} • {installmentsLabel}
                  </Typography>
                </Stack>
                <Stack spacing={0} alignItems="flex-end">
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>Total</Typography>
                  <Typography sx={{ fontWeight: 950 }}>{money(categoriesRank.totalGastoMes || 0)}</Typography>
                </Stack>
              </Stack>

              <Divider />

              <Box sx={{ flex: 1, overflow: "auto" }}>
                {(categoriesRank.rows || []).length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>Sem gastos no mês.</Typography>
                ) : (
                  <Stack spacing={0}>
                    {(() => {
                      const rows = categoriesRank.rows || [];
                      const maxValue = rows[0]?.total || 1;

                      const first = rows.slice(0, 6);
                      const rest = rows.slice(6);

                      const renderRow = (row, idx, isLast) => {
                        const pct = clamp((Number(row.total || 0) / Number(maxValue)) * 100, 0, 100);
                        const base = row.color || pickFallbackColor(theme, row.key);

                        return (
                          <React.Fragment key={row.key}>
                            <Box
                              sx={(t) => ({
                                py: 1,
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                borderRadius: 1.5,
                                px: 0.5,
                                transition: "background 140ms ease",
                                "&:hover": { background: alpha(t.palette.action.hover, 0.7) },
                              })}
                            >
                              <Box sx={{ width: 10, height: 10, borderRadius: 999, background: base, flexShrink: 0 }} />
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography sx={{ fontWeight: 900, fontSize: 13 }} noWrap>{row.name}</Typography>
                                <Box sx={{ mt: 0.55 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={pct}
                                    sx={{
                                      height: 4,
                                      borderRadius: 999,
                                      background: alpha(base, 0.12),
                                      "& .MuiLinearProgress-bar": {
                                        borderRadius: 999,
                                        backgroundColor: alpha(base, 0.95),
                                      },
                                    }}
                                  />
                                </Box>
                              </Box>
                              <Typography sx={{ fontWeight: 950, fontSize: 13, whiteSpace: "nowrap" }}>
                                {money(row.total)}
                              </Typography>
                            </Box>

                            {!isLast && <Divider sx={{ opacity: 0.5 }} />}
                          </React.Fragment>
                        );
                      };

                      return (
                        <>
                          {first.map((row, i) =>
                            renderRow(row, i, i === first.length - 1 && rest.length === 0 && !showAllCategories)
                          )}

                          {rest.length > 0 ? (
                            <>
                              <Box sx={{ py: 0.75, display: "flex", justifyContent: "center" }}>
                                <Button
                                  size="small"
                                  onClick={() => setShowAllCategories((v) => !v)}
                                  endIcon={showAllCategories ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                                  sx={{ fontWeight: 900, textTransform: "none" }}
                                >
                                  {showAllCategories ? "Mostrar menos" : `Ver todas (${rows.length})`}
                                </Button>
                              </Box>

                              <Collapse in={showAllCategories} timeout={180} unmountOnExit>
                                <Stack spacing={0}>
                                  <Divider sx={{ opacity: 0.5, mb: 0.5 }} />
                                  {rest.map((row, i) => renderRow(row, i, i === rest.length - 1))}
                                </Stack>
                              </Collapse>
                            </>
                          ) : null}
                        </>
                      );
                    })()}
                  </Stack>
                )}
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={(t) => cardBg(t, "success")}>
          <CardContent sx={{ p: 2.25, height: "100%" }}>
            <Stack spacing={1} sx={{ height: "100%" }}>
              <Stack spacing={0.4}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                  <Typography sx={{ fontWeight: 950, letterSpacing: -0.4 }}>Faturas (cartões)</Typography>
                  <Typography sx={{ fontWeight: 950, fontSize: 15, letterSpacing: -0.2 }}>
                    {money(totalInvoicesMonth)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    baseado no invoiceMonth • {formatMonthBR(addMonthsYM(month, 1))}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                    {(invoicesByCard || []).length} cartões
                  </Typography>
                </Stack>
              </Stack>

              <Divider />

              <Box sx={{ flex: 1, overflow: "auto" }}>
                {(invoicesByCard || []).length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>Nenhum cartão ativo.</Typography>
                ) : (
                  <Stack spacing={0}>
                    {(() => {
                      const rows = invoicesByCard || [];
                      const top = rows[0]?.total || 1;

                      const first = rows.slice(0, 6);
                      const rest = rows.slice(6);

                      const renderRow = (c, isLast) => {
                        const pct = clamp((Number(c.total || 0) / Number(top || 1)) * 100, 0, 100);
                        const base = c.color || pickFallbackColor(theme, c.id || c.name);

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
                                "&:hover": { background: alpha(t.palette.action.hover, 0.7) },
                              })}
                            >
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 999,
                                  background: base,
                                  flexShrink: 0,
                                  boxShadow: `0 0 0 3px ${alpha(base, 0.12)}`,
                                }}
                              />
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography sx={{ fontWeight: 950, fontSize: 13 }} noWrap>{c.name}</Typography>
                                <Typography
                                  sx={{
                                    mt: 0.15,
                                    fontSize: 9.6,
                                    fontWeight: 850,
                                    color: "text.secondary",
                                    lineHeight: 1.1,
                                  }}
                                  noWrap
                                >
                                  Vence aprox. {c.dueLabel}
                                </Typography>
                                <Box sx={{ mt: 0.75 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={pct}
                                    sx={{
                                      height: 4,
                                      borderRadius: 999,
                                      background: alpha(base, 0.14),
                                      "& .MuiLinearProgress-bar": {
                                        borderRadius: 999,
                                        backgroundColor: alpha(base, 0.92),
                                      },
                                    }}
                                  />
                                </Box>
                              </Box>
                              <Typography sx={{ fontWeight: 950, fontSize: 13, whiteSpace: "nowrap" }}>
                                {money(c.total)}
                              </Typography>
                            </Box>

                            {!isLast && <Divider sx={{ opacity: 0.5 }} />}
                          </React.Fragment>
                        );
                      };

                      return (
                        <>
                          {first.map((c, i) => renderRow(c, i === first.length - 1 && rest.length === 0 && !showAllCards))}

                          {rest.length > 0 ? (
                            <>
                              <Box sx={{ py: 0.75, display: "flex", justifyContent: "center" }}>
                                <Button
                                  size="small"
                                  onClick={() => setShowAllCards((v) => !v)}
                                  endIcon={showAllCards ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                                  sx={{ fontWeight: 900, textTransform: "none" }}
                                >
                                  {showAllCards ? "Mostrar menos" : `Ver todos (${rows.length})`}
                                </Button>
                              </Box>

                              <Collapse in={showAllCards} timeout={180} unmountOnExit>
                                <Stack spacing={0}>
                                  <Divider sx={{ opacity: 0.5, mb: 0.5 }} />
                                  {rest.map((c, i) => renderRow(c, i === rest.length - 1))}
                                </Stack>
                              </Collapse>
                            </>
                          ) : null}
                        </>
                      );
                    })()}
                  </Stack>
                )}
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Box
        sx={{
          width: "100%",
          display: "grid",
          gap: 2,
          alignItems: "stretch",
          gridTemplateColumns: { xs: "1fr" },
        }}
      >
        <DashboardMonthlyPace
          month={month}
          transactions={txns}
          money={money}
          cardBg={cardBg}
          getDateYMD={resolveVizDateYMD}
          getExpenseAmount={resolveVizAmountExpense}
          isExcluded={(t) => {
            const billId = String(t?.billId ?? t?.bill_id ?? "").trim();
            if (billId) return true;
            if (isTransferCategory(t)) return true;
            return false;
          }}
        />
      </Box>

      <Box
        sx={{
          width: "100%",
          display: "grid",
          gap: 2,
          minHeight: "350px",
          alignItems: "stretch",
          gridTemplateColumns: { xs: "1fr", md: "1fr" },
        }}
      >
        <AccountsMatrix />
      </Box>
    </Stack>
  );
}