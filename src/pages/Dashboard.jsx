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
  LabelList,
} from "recharts";

import { formatBRL } from "../utils/money";
import { formatMonthBR, formatDateBR } from "../utils/dateBR";
import { selectHideValues } from "../store/uiSlice";
import { selectTransactionsUi } from "../store/transactionsSlice";
import { bootstrapThunk } from "../store/bootstrapThunk";
import { selectCategories } from "../store/categoriesSlice";
import Spinner from "../components/ui/Spinner";

// =============================
// DEBUG SWITCH (ÚNICO)
// =============================
const DEBUG = true;

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

// -----------------------------
// Helpers
// -----------------------------
function sum(arr) {
  return (arr || []).reduce((a, b) => a + b, 0);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function normalizeStatus(s) {
  const v = String(s || "").toLowerCase().trim();
  if (v === "confirmado" || v === "confirmed") return "confirmed";
  if (v === "previsto" || v === "planned") return "planned";
  if (v === "pago" || v === "paid") return "paid";
  if (v === "faturado" || v === "invoiced") return "invoiced";
  if (v === "atrasado" || v === "overdue") return "overdue";
  return v || "";
}

function statusRank(statusRaw) {
  const s = normalizeStatus(statusRaw);
  if (s === "paid") return 5;
  if (s === "confirmed") return 4;
  if (s === "overdue") return 3;
  if (s === "invoiced") return 2;
  if (s === "planned") return 1;
  return 0;
}

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

function addMonthsYM(ym, add = 1) {
  const [yy, mm] = String(ym || "").split("-").map(Number);
  if (!Number.isFinite(yy) || !Number.isFinite(mm)) return "";
  const base = yy * 12 + (mm - 1) + Number(add || 0);
  const y2 = Math.floor(base / 12);
  const m2 = (base % 12) + 1;
  return `${y2}-${String(m2).padStart(2, "0")}`;
}

function normalizeDirectionFromTxn(t) {
  const d = String(t?.direction || "").toLowerCase();
  if (d === "income" || d === "receita" || d === "entrada") return "income";
  if (d === "expense" || d === "despesa" || d === "saida" || d === "saída") return "expense";
  return "expense";
}

function signedAmountNormalized(t) {
  const v = Number(t?.amount ?? t?.value ?? 0);
  const abs = Math.abs(v);
  if (v < 0) return v;
  return normalizeDirectionFromTxn(t) === "income" ? abs : -abs;
}

function resolvedDirection(t) {
  const d = String(t?.direction || "").toLowerCase();
  if (d === "income" || d === "expense") return d;
  return signedAmountNormalized(t) < 0 ? "expense" : "income";
}

function isInstallment(t) {
  const k = String(t?.kind || "").toLowerCase();
  return k === "installment" || k === "parcelado" || k === "parcela";
}

function isLikelyInvoicePayment(t) {
  const k = String(t?.kind || "").toLowerCase();
  if (k.includes("bill_payment") || k.includes("invoice_payment") || k === "payment") return true;

  const desc = String(t?.description || t?.memo || t?.title || "").toLowerCase();
  if (desc.includes("pagamento de fatura") || desc.includes("pgto fatura") || desc.includes("fatura paga"))
    return true;

  return false;
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h);
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
  return palette[hashCode(String(key)) % palette.length];
}

function getCutoffDayFromAccount(acc) {
  const v =
    acc?.statement?.cutoffDay ??
    acc?.statement?.cutoff_day ??
    acc?.cutoffDay ??
    acc?.cutoff_day ??
    acc?.statementDay ??
    acc?.statement_day;

  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function billingYMForCardPurchase(purchaseISO, cutoffDay) {
  const iso = normalizeISODate(purchaseISO);
  if (!iso) return "";
  const ym = iso.slice(0, 7);
  const day = Number(iso.slice(8, 10));
  if (!Number.isFinite(day)) return "";

  const cd = Number(cutoffDay);
  if (!Number.isFinite(cd) || cd <= 0) return "";

  return day <= cd ? ym : addMonthsYM(ym, 1);
}

function dueDateISO(monthYM, dueDay) {
  if (!monthYM) return "";
  const [y, m] = String(monthYM).split("-").map(Number);
  if (!y || !m) return "";
  const lastDay = new Date(y, m, 0).getDate();
  const d0 = Number(dueDay);
  const d = clamp(Number.isFinite(d0) && d0 > 0 ? d0 : 10, 1, lastDay);
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

// ✅ Dedupe Bills: planned + paid (mesmo billId) => fica só o mais forte
function dedupeBillsForDashboard(list, { month, billingYMForTxn, isCardTxn }) {
  const map = new Map();
  const removed = [];

  for (const t of list || []) {
    const billId = String(t?.billId || t?.bill_id || t?.bill || "").trim();

    if (!billId) {
      const k = `__no_bill__|${t?.id || Math.random()}`;
      map.set(k, t);
      continue;
    }

    if (isCardTxn(t)) {
      const k = `__card_bill__|${t?.id || billId}`;
      map.set(k, t);
      continue;
    }

    const ym = billingYMForTxn(t) || String(t?.invoiceMonth || "");
    const key = `${billId}|${ym}|${resolvedDirection(t)}`;

    const prev = map.get(key);
    if (!prev) {
      map.set(key, t);
      continue;
    }

    const rPrev = statusRank(prev?.status);
    const rNow = statusRank(t?.status);

    if (rNow > rPrev) {
      removed.push(prev);
      map.set(key, t);
      continue;
    }

    if (rNow === rPrev) {
      const aPrev = Math.abs(Number(prev?.amount || 0));
      const aNow = Math.abs(Number(t?.amount || 0));
      if (aNow > aPrev) {
        removed.push(prev);
        map.set(key, t);
      } else {
        removed.push(t);
      }
      continue;
    }

    removed.push(t);
  }

  const out = Array.from(map.values());

  if (DEBUG) {
    dbgGroup(`[DASH DEBUG] BILL DEDUPE month=${month}`, () => {
      dbg("before =", (list || []).length, "after =", out.length, "removed =", removed.length);
      console.table(
        removed.slice(0, 120).map((t) => ({
          id: t?.id,
          desc: String(t?.description || t?.memo || t?.title || ""),
          amount: Math.abs(Number(t?.amount || 0)),
          status: normalizeStatus(t?.status),
          billId: String(t?.billId || t?.bill_id || ""),
          accountId: t?.accountId || "",
          billingYM: billingYMForTxn(t) || "",
        }))
      );
    });
  }

  return out;
}

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

function StackedDayTooltip({ active, label, payload, catMeta, theme, money }) {
  if (!active || !payload?.length) return null;

  const rows = (payload || [])
    .filter((p) => p && p.dataKey && p.dataKey !== "total")
    .map((p) => {
      const meta = catMeta?.get(String(p.dataKey));
      const name = meta?.name || String(p.dataKey);
      const color = meta?.color || pickFallbackColor(theme, p.dataKey);
      const value = Number(p.value || 0);
      return { key: String(p.dataKey), name, color, value };
    })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = rows.reduce((acc, r) => acc + r.value, 0);

  return (
    <Card sx={{ borderRadius: 2 }}>
      <CardContent sx={{ p: 1.1, minWidth: 220 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
          Dia {label}
        </Typography>
        <Typography sx={{ fontWeight: 950, mb: 0.8 }}>{money(total)}</Typography>

        <Stack spacing={0.55}>
          {rows.map((r) => (
            <Stack key={r.key} direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: r.color, flexShrink: 0 }} />
                <Typography variant="caption" noWrap sx={{ fontWeight: 900 }}>
                  {r.name}
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ fontWeight: 900 }}>
                {money(r.value)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

// -----------------------------
// Card window helpers (MESMA lógica do Invoices.jsx)
// -----------------------------
function pad2(n) {
  return String(n).padStart(2, "0");
}

function monthStartDate(ym) {
  const [y, m] = String(ym).slice(0, 7).split("-");
  return new Date(Number(y), Number(m) - 1, 1);
}

function addMonthsJS(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function clampDayJS(y, mIndex0, day) {
  const last = new Date(y, mIndex0 + 1, 0).getDate();
  return Math.max(1, Math.min(Number(day || 1), last));
}

// ISO "YYYY-MM-DD" sem risco de timezone
function toISODateLocal(dt) {
  const y = dt.getFullYear();
  const m = pad2(dt.getMonth() + 1);
  const d = pad2(dt.getDate());
  return `${y}-${m}-${d}`;
}

// replica exatamente a lógica do backend (janela por cutoff)
function computeInvoiceWindowISO(statementYM, cutoffDay) {
  const sm = monthStartDate(statementYM);
  const prev = addMonthsJS(sm, -1);

  const endDay = clampDayJS(sm.getFullYear(), sm.getMonth(), cutoffDay);
  const startDay = clampDayJS(prev.getFullYear(), prev.getMonth(), cutoffDay);

  const periodEnd = new Date(sm.getFullYear(), sm.getMonth(), endDay);
  const periodStart = new Date(prev.getFullYear(), prev.getMonth(), startDay + 1);

  return { startISO: toISODateLocal(periodStart), endISO: toISODateLocal(periodEnd) };
}

function centsFromTxn(t) {
  if (t?.amount_cents != null) return Math.abs(Number(t.amount_cents) || 0);
  if (t?.amountCents != null) return Math.abs(Number(t.amountCents) || 0);

  const raw = t?.amount ?? t?.value ?? 0;
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.abs(n) * 100);
}

function hasInvoiceLink(t) {
  return !!(t?.invoice || t?.invoiceId || t?.invoice_id);
}

function safeCardColor(theme, c) {
  const v = String(c || "").trim();
  if (v) return v;
  return theme.palette.primary.main;
}

// -----------------------------
// Dashboard
// -----------------------------
export default function Dashboard() {
  const theme = useTheme();
  const dispatch = useDispatch();

  const month = useSelector((s) => s.finance.month); // "YYYY-MM"
  const txns = useSelector(selectTransactionsUi);
  const accounts = useSelector((s) => s.accounts.accounts);
  const extraFilters = useSelector((s) => s.finance.filters);

  const hideValues = useSelector(selectHideValues);
  const categories = useSelector(selectCategories);

  const accountsStatus = useSelector((s) => s.accounts.status);
  const txStatus = useSelector((s) => s.transactions.status);

  useEffect(() => {
    const alreadyLoaded = accountsStatus === "succeeded" && txStatus === "succeeded";
    if (alreadyLoaded) return;
    dispatch(bootstrapThunk());
  }, [dispatch, accountsStatus, txStatus]);

  const maskMoney = (formatted) => (hideValues ? "••••" : formatted);
  const money = (n) => maskMoney(formatBRL(Number(n || 0)));

  const accountsById = useMemo(() => {
    const map = new Map();
    for (const a of accounts || []) map.set(a.id, a);
    return map;
  }, [accounts]);

  // DEBUG snapshot
  useEffect(() => {
    if (!DEBUG) return;
    dbgGroup(`[DASH DEBUG] RAW store snapshot (month=${month})`, () => {
      dbg("txns.length =", (txns || []).length);
      dbg("accounts.length =", (accounts || []).length);
      dbg("filters =", extraFilters);
      dbg("txns sample[0..3] =", (txns || []).slice(0, 4));
    });
  }, [txns, accounts, extraFilters, month]);

  const categoriesById = useMemo(() => {
    const m = new Map();
    (categories || []).forEach((c) => m.set(String(c.id), c));
    return m;
  }, [categories]);

  const categoriesBySlug = useMemo(() => {
    const m = new Map();
    (categories || []).forEach((c) => m.set(String(c.slug), c));
    return m;
  }, [categories]);

  const resolveCategoryFromTxn = useMemo(() => {
    return (t) => {
      const raw = t?.categoryId ?? t?.category_id ?? t?.category ?? "";
      const key = String(raw);
      return categoriesById.get(key) || categoriesBySlug.get(key) || null;
    };
  }, [categoriesById, categoriesBySlug]);

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

  const isCardTxn = useMemo(() => {
    return (t) => {
      const rid = resolveAccountIdFromTxn(t);
      if (!rid) return false;
      const acc = accountsById.get(rid);
      return acc?.type === "credit_card";
    };
  }, [resolveAccountIdFromTxn, accountsById]);

  const billingYMForTxn = useMemo(() => {
    const ymField = (v) => {
      const s = String(v || "").trim();
      return s ? s.slice(0, 7) : "";
    };

    return (t) => {
      // 1) se vier do backend/store, usa SEMPRE
      const invoiceYM = ymField(t?.invoiceMonth ?? t?.invoice_month);
      const billingYM = ymField(t?.billingYM ?? t?.billing_ym);

      const pd = normalizeISODate(t?.purchaseDate ?? t?.purchase_date);

      // cartão: invoiceMonth > billingYM > cutoff calc
      if (isCardTxn(t)) {
        if (invoiceYM) return invoiceYM;
        if (billingYM) return billingYM;

        if (!pd) return "";
        const rid = resolveAccountIdFromTxn(t);
        const acc = rid ? accountsById.get(rid) : null;
        const cutoff = getCutoffDayFromAccount(acc);
        if (!cutoff) return ymFromISODate(pd);

        return billingYMForCardPurchase(pd, cutoff);
      }

      // não-cartão: billingYM > purchase month
      if (billingYM) return billingYM;
      if (!pd) return "";
      return ymFromISODate(pd);
    };
  }, [isCardTxn, resolveAccountIdFromTxn, accountsById]);

  // filtros do header
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
      out = out.filter((t) => f.categoryIds.includes(String(t?.categoryId ?? t?.category_id ?? "")));
    }

    if (f.kinds?.length) {
      out = out.filter((t) => f.kinds.includes(String(t.kind)));
    }

    if (f.directions?.length) {
      out = out.filter((t) => f.directions.includes(resolvedDirection(t)));
    }

    return out;
  }, [txns, extraFilters, resolveAccountIdFromTxn]);

  useEffect(() => {
    if (!DEBUG) return;
    dbgGroup(`[DASH DEBUG] After header filters`, () => {
      dbg("filteredTxns.length =", (filteredTxns || []).length);
      dbg("invoicePayment-like count =", (filteredTxns || []).filter(isLikelyInvoicePayment).length);
    });
  }, [filteredTxns, month]);

  // -----------------------------
  // DEDUPE geral (evita duplicatas por refresh/storage)
  // -----------------------------
  const txnsDeduped = useMemo(() => {
    const normDesc = (t) =>
      String(t?.merchant || t?.description || t?.title || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .slice(0, 32);

    const centsKey = (n) => Math.round(Math.abs(Number(n || 0)) * 100);

    const keyFor = (t) => {
      const accId = resolveAccountIdFromTxn(t) || "";
      const pd = normalizeISODate(t?.purchaseDate ?? t?.purchase_date) || "";
      const amt = centsKey(signedAmountNormalized(t));
      const desc = normDesc(t);
      const cat = String(t?.categoryId ?? t?.category_id ?? t?.category ?? "");
      return `${accId}|${pd}|${amt}|${cat}|${desc}`;
    };

    const best = new Map();
    let collisions = 0;

    for (const t of filteredTxns || []) {
      if (isLikelyInvoicePayment(t)) continue;

      const k = keyFor(t);
      const prev = best.get(k);
      if (!prev) {
        best.set(k, t);
        continue;
      }

      collisions += 1;

      if (statusRank(t?.status) > statusRank(prev?.status)) {
        best.set(k, t);
        continue;
      }

      const prevHasId = !!(prev?.id || prev?.uuid);
      const curHasId = !!(t?.id || t?.uuid);
      if (!prevHasId && curHasId) best.set(k, t);
    }

    const out = Array.from(best.values());

    if (DEBUG) {
      dbgGroup("[DASH DEBUG] DEDUPE summary", () => {
        dbg("input (filteredTxns) =", (filteredTxns || []).length);
        dbg("deduped =", out.length);
        dbg("collisions =", collisions);
      });
    }

    return out;
  }, [filteredTxns, resolveAccountIdFromTxn]);

  useEffect(() => {
    if (!DEBUG) return;

    const inCount = (filteredTxns || []).length;
    const deCount = (txnsDeduped || []).length;

    const invoicedRaw = (filteredTxns || []).filter((t) => normalizeStatus(t?.status) === "invoiced").length;
    const invoicedDed = (txnsDeduped || []).filter((t) => normalizeStatus(t?.status) === "invoiced").length;

    console.groupCollapsed("[DASH DEBUG] filtered vs deduped");
    console.log("filteredTxns =", inCount, "txnsDeduped =", deCount, "diff =", inCount - deCount);
    console.log("invoiced filtered =", invoicedRaw, "invoiced deduped =", invoicedDed);
    console.groupEnd();
  }, [filteredTxns, txnsDeduped]);

  // -----------------------------
  // mês do dashboard (cutoff pra cartões; purchase month pros demais)
  // + dedupe bills (planned vs paid/confirmed)
  // -----------------------------
  const monthTxDashboard = useMemo(() => {
    if (!month) return txnsDeduped || [];

    const base = (txnsDeduped || [])
      .filter((t) => !isLikelyInvoicePayment(t))
      .filter((t) => billingYMForTxn(t) === month);

    return dedupeBillsForDashboard(base, { month, billingYMForTxn, isCardTxn, DEBUG });
  }, [txnsDeduped, month, billingYMForTxn, isCardTxn]);

  useEffect(() => {
    if (!DEBUG) return;
    dbgGroup(`[DASH DEBUG] After month billing filter (month=${month})`, () => {
      dbg("monthTxDashboard.length =", (monthTxDashboard || []).length);

      const byBill = new Map();
      for (const t of monthTxDashboard || []) {
        const billId = String(t?.billId || t?.bill_id || "").trim();
        if (!billId || isCardTxn(t)) continue;
        byBill.set(billId, (byBill.get(billId) || 0) + 1);
      }
      const duplicates = [...byBill.entries()].filter(([, c]) => c > 1);
      dbg("non-card billId duplicates (should be empty) =", duplicates);
    });
  }, [monthTxDashboard, month, isCardTxn]);

  // -----------------------------
  // KPIs (não mexe nos outros; CARTÕES vem da mesma lógica do Invoices.jsx)
  // -----------------------------
  const totalEntradaMes = useMemo(() => {
    return sum((monthTxDashboard || []).map((t) => Math.max(0, signedAmountNormalized(t))));
  }, [monthTxDashboard]);

  const totalSaidaMes = useMemo(() => {
    return Math.abs(sum((monthTxDashboard || []).map((t) => Math.min(0, signedAmountNormalized(t)))));
  }, [monthTxDashboard]);

  const totalDespesasMensais = useMemo(() => {
    return sum(
      (monthTxDashboard || [])
        .filter((t) => normalizeDirectionFromTxn(t) === "expense")
        .filter((t) => String(t?.kind || "").toLowerCase() === "recurring")
        .map((t) => Math.abs(signedAmountNormalized(t)))
    );
  }, [monthTxDashboard]);

  const totalParcelamento = useMemo(() => {
    return sum(
      (monthTxDashboard || [])
        .filter((t) => isInstallment(t))
        .filter((t) => normalizeDirectionFromTxn(t) === "expense")
        .map((t) => Math.abs(signedAmountNormalized(t)))
    );
  }, [monthTxDashboard]);

  const totalAvulso = useMemo(() => {
    return sum(
      (monthTxDashboard || [])
        .filter((t) => normalizeDirectionFromTxn(t) === "expense")
        .filter((t) => String(t?.kind || "").toLowerCase() === "one_off")
        .map((t) => Math.abs(signedAmountNormalized(t)))
    );
  }, [monthTxDashboard]);

  // -----------------------------
  // Chart (stack) — continua usando monthTxDashboard (ok)
  // -----------------------------
  const chartStack = useMemo(() => {
    if (!month) return { data: [], catKeys: [], catMeta: new Map() };

    const [y, m] = String(month).split("-").map(Number);
    if (!y || !m) return { data: [], catKeys: [], catMeta: new Map() };

    const daysInMonth = new Date(y, m, 0).getDate();

    const catMeta = new Map();
    const catKeysSet = new Set();

    const byLabel = new Map();
    byLabel.set("Prev", { label: "Prev", total: 0 });
    for (let d = 1; d <= daysInMonth; d++) byLabel.set(String(d), { label: String(d), total: 0 });

    for (const t of monthTxDashboard || []) {
      if (resolvedDirection(t) !== "expense") continue;

      const pd = normalizeISODate(t?.purchaseDate ?? t?.purchase_date);
      if (!pd) continue;

      const pdYM = ymFromISODate(pd);
      let label = String(dayFromISODate(pd) || "");

      if (isCardTxn(t) && pdYM !== month) label = "Prev";
      if (!byLabel.has(label)) continue;

      const cat = resolveCategoryFromTxn(t);
      const key = String(cat?.id ?? cat?.slug ?? "outros");
      const name = cat?.name || "Outros";
      const color = cat?.color || cat?.tint || null;

      catKeysSet.add(key);
      if (!catMeta.has(key)) catMeta.set(key, { name, color });

      const v = Math.abs(signedAmountNormalized(t));
      const row = byLabel.get(label);

      row[key] = (row[key] || 0) + v;
      row.total += v;
    }

    const totalsByCat = new Map();
    for (const row of byLabel.values()) {
      for (const k of catKeysSet) {
        const v = Number(row[k] || 0);
        if (!v) continue;
        totalsByCat.set(k, (totalsByCat.get(k) || 0) + v);
      }
    }

    const catKeys = Array.from(catKeysSet).sort(
      (a, b) => (totalsByCat.get(b) || 0) - (totalsByCat.get(a) || 0)
    );

    const data = Array.from(byLabel.values()).map((r) => {
      const out = { ...r };
      out.total = Number(Number(out.total || 0).toFixed(2));
      for (const k of catKeys) out[k] = Number(Number(out[k] || 0).toFixed(2));
      return out;
    });

    data.sort((a, b) => {
      if (a.label === "Prev") return -1;
      if (b.label === "Prev") return 1;
      return Number(a.label) - Number(b.label);
    });

    return { data, catKeys, catMeta };
  }, [month, monthTxDashboard, resolveCategoryFromTxn, isCardTxn]);

  const maxChartValue = useMemo(() => {
    return Math.max(0, ...(chartStack.data || []).map((d) => Number(d.total || 0)));
  }, [chartStack]);

  // -----------------------------
  // Categorias rank
  // -----------------------------
  const categoriesRank = useMemo(() => {
    const map = new Map();

    for (const t of monthTxDashboard || []) {
      if (resolvedDirection(t) !== "expense") continue;

      const cat = resolveCategoryFromTxn(t);
      const key = String(cat?.id ?? cat?.slug ?? "outros");
      map.set(key, (map.get(key) || 0) + Math.abs(signedAmountNormalized(t)));
    }

    const rows = Array.from(map.entries())
      .map(([key, total]) => {
        const cat = categoriesById.get(String(key)) || categoriesBySlug.get(String(key));
        return {
          key,
          name: cat?.name || "Outros",
          total: Number(Number(total || 0).toFixed(2)),
          color: cat?.color || cat?.tint || null,
        };
      })
      .sort((a, b) => b.total - a.total);

    const totalGastoMes = rows.reduce((acc, r) => acc + r.total, 0);

    return {
      rows: rows.slice(0, 10),
      totalGastoMes: Number(totalGastoMes.toFixed(2)),
    };
  }, [monthTxDashboard, resolveCategoryFromTxn, categoriesById, categoriesBySlug]);

  // -----------------------------
  // ✅ “Faturas por cartão” — MESMA regra do Invoices.jsx:
  // - janela por cutoff (prev cutoff+1 .. cutoff atual)
  // - se tiver INVOICED/PAID na janela => usa o MAIOR (evita “dobro”)
  // - senão => usa CONFIRMED sem vínculo de invoice (aberto)
  // -----------------------------
  const invoicesByCard = useMemo(() => {
    const creditCards = (accounts || []).filter((a) => a.active && a.type === "credit_card");

    const metaById = new Map();
    for (const c of creditCards) {
      const cutoff = Number(c?.statement?.cutoffDay ?? c?.cutoffDay ?? c?.cutoff_day ?? 1);
      const dueDay = Number(c?.statement?.dueDay ?? c?.dueDay ?? c?.due_day ?? 1);
      metaById.set(String(c.id), { cutoff, dueDay, card: c });
    }

    const sums = new Map();
    for (const c of creditCards) {
      sums.set(String(c.id), { confirmedOpen: 0, invoiced: 0, paid: 0 });
    }

    for (const t of txnsDeduped || []) {
      const accId = resolveAccountIdFromTxn(t);
      if (!accId || !sums.has(String(accId))) continue;
      if (resolvedDirection(t) !== "expense") continue;

      const st = normalizeStatus(t?.status);
      if (st !== "confirmed" && st !== "invoiced" && st !== "paid") continue;

      const purchase = normalizeISODate(t?.purchaseDate ?? t?.purchase_date);
      if (!purchase) continue;

      const cutoff = Number(metaById.get(String(accId))?.cutoff || 1);
      const { startISO, endISO } = computeInvoiceWindowISO(month, cutoff);

      if (purchase < startISO || purchase > endISO) continue;

      const cts = centsFromTxn(t);
      const cur = sums.get(String(accId));

      if (st === "confirmed") {
        if (hasInvoiceLink(t)) continue; // não contar confirmado já “virou invoice”
        cur.confirmedOpen += cts;
      } else if (st === "paid") {
        cur.paid += cts;
      } else if (st === "invoiced") {
        cur.invoiced += cts;
      }
    }

    const out = creditCards
      .map((c) => {
        const accId = String(c.id);
        const { cutoff, dueDay } = metaById.get(accId) || { cutoff: 1, dueDay: 1 };

        const dueYM = addMonthsYM(month, 1);
        const dueISO = dueDateISO(dueYM, dueDay);

        const s = sums.get(accId) || { confirmedOpen: 0, invoiced: 0, paid: 0 };
        const billed = Math.max(Number(s.invoiced || 0), Number(s.paid || 0));
        const displayCents = billed > 0 ? billed : Number(s.confirmedOpen || 0);

        return {
          id: c.id,
          name: c.name,
          color: safeCardColor(theme, c.color),
          dueISO,
          dueLabel: dueISO ? formatDateBR(dueISO) : "—",
          total: Number((displayCents / 100).toFixed(2)), // BRL
          _debug: {
            startEnd: computeInvoiceWindowISO(month, cutoff),
            cutoff,
            confirmedOpen: s.confirmedOpen,
            invoiced: s.invoiced,
            paid: s.paid,
            displayCents,
          },
        };
      })
      .sort((a, b) => b.total - a.total);

    if (DEBUG) {
      dbgGroup(`[DASH DEBUG] invoicesByCard (window/cutoff) month=${month}`, () => {
        dbg("cards =", out.length);
        console.table(
          out.map((x) => ({
            name: x.name,
            total: x.total,
            cutoff: x._debug?.cutoff,
            start: x._debug?.startEnd?.startISO,
            end: x._debug?.startEnd?.endISO,
            confirmedOpen: (x._debug?.confirmedOpen || 0) / 100,
            invoiced: (x._debug?.invoiced || 0) / 100,
            paid: (x._debug?.paid || 0) / 100,
          }))
        );
      });
    }

    return out;
  }, [accounts, month, txnsDeduped, resolveAccountIdFromTxn, theme]);

  const totalInvoicesMonth = useMemo(() => {
    return (invoicesByCard || []).reduce((acc, c) => acc + Number(c.total || 0), 0);
  }, [invoicesByCard]);

  // ✅ KPI de cartões = MESMA soma do card “Faturas (cartões)”
  const totalCartoesMes = totalInvoicesMonth;

  useEffect(() => {
    if (!DEBUG) return;
    dbgGroup(`[DASH DEBUG] Cards totals`, () => {
      dbg("totalInvoicesMonth =", totalInvoicesMonth);
      dbg("invoicesByCard =", invoicesByCard);
    });
  }, [totalInvoicesMonth, invoicesByCard]);

  // -----------------------------
  // Loading
  // -----------------------------
  const bootLoading = accountsStatus === "loading" || txStatus === "loading";
  if (bootLoading) return <Spinner status={bootLoading} />;

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <Stack spacing={2.25} sx={{ width: "100%" }}>
      {/* KPIs */}
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
        <KpiCard title="Total de saídas" value={money(totalSaidaMes)} icon={TrendingDownRoundedIcon} tone="bad" />
        <KpiCard title="Total em cartões" value={money(totalCartoesMes)} icon={CreditCardRoundedIcon} tone="info" />
        <KpiCard title="Despesas mensais" value={money(totalDespesasMensais)} icon={CalendarMonthRoundedIcon} tone="bad" />
        <KpiCard title="Total avulso" value={money(totalAvulso)} icon={BoltRoundedIcon} tone="neutral" />
        <KpiCard title="Total parcelamento" value={money(totalParcelamento)} icon={ViewWeekRoundedIcon} tone="info" />
      </Box>

      {/* Chart */}
      <Box sx={{ width: "100%", display: "grid", gap: 2, alignItems: "stretch", gridTemplateColumns: { xs: "1fr" } }}>
        <Card sx={(t) => cardBg(t, "primary")}>
          <CardContent sx={{ p: 2.25 }}>
            <Stack spacing={1.2}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography sx={{ fontWeight: 950, letterSpacing: -0.4 }}>Despesas por dia</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  mês de cobrança (cartões) • {formatMonthBR(month)}
                </Typography>
              </Stack>

              <Box sx={{ width: "100%", height: 360, minHeight: 360 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartStack.data} margin={{ top: 26, right: 18, left: 0, bottom: 0 }}>
                    <CartesianGrid
                      vertical={false}
                      stroke={alpha(theme.palette.divider, 0.55)}
                      strokeDasharray="3 6"
                      opacity={0.18}
                    />

                    <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />

                    <YAxis
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                      domain={[0, Math.max(10, maxChartValue * 1.15)]}
                      tickFormatter={(v) => (hideValues ? "••••" : formatBRL(v))}
                    />

                    <Tooltip
                      content={(props) => (
                        <StackedDayTooltip {...props} catMeta={chartStack.catMeta} theme={theme} money={money} />
                      )}
                    />

                    {chartStack.catKeys.map((k) => {
                      const meta = chartStack.catMeta.get(String(k));
                      const fill = meta?.color || pickFallbackColor(theme, k);

                      return (
                        <Bar
                          key={k}
                          dataKey={k}
                          stackId="day"
                          fill={fill}
                          radius={[0, 0, 0, 0]}
                          barSize={24}
                          isAnimationActive
                          animationDuration={500}
                        />
                      );
                    })}

                    <Bar dataKey="total" fill="transparent" stackId="__total_label__">
                      <LabelList
                        dataKey="total"
                        position="top"
                        content={({ x, y, width, value }) => {
                          if (!value || Number(value) <= 0) return null;
                          return (
                            <text
                              x={x + width / 2}
                              y={y - 6}
                              textAnchor="middle"
                              fontSize={9}
                              fontWeight={700}
                              fill={theme.palette.text.secondary}
                            >
                              {money(value)}
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
                Debug ativo: veja o console para DEDUPE, BILL DEDUPE e window/cutoff de cartões.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Categorias + Faturas */}
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
        {/* Categorias */}
        <Card sx={(t) => cardBg(t, "info")}>
          <CardContent sx={{ p: 2.25, height: "100%" }}>
            <Stack spacing={1} sx={{ height: "100%" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Stack spacing={0.2}>
                  <Typography sx={{ fontWeight: 950, letterSpacing: -0.4 }}>Categorias</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    mês de cobrança (cartões) • {formatMonthBR(month)}
                  </Typography>
                </Stack>

                <Stack spacing={0} alignItems="flex-end">
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                    Total
                  </Typography>
                  <Typography sx={{ fontWeight: 950 }}>{money(categoriesRank.totalGastoMes || 0)}</Typography>
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
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 999,
                                  background: base,
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
                Top 10
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* Faturas */}
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
                    janela real por cutoff • {formatMonthBR(month)}
                  </Typography>

                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                    {(invoicesByCard || []).length} cartões
                  </Typography>
                </Stack>
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
                                <Typography sx={{ fontWeight: 950, fontSize: 13 }} noWrap>
                                  {c.name}
                                </Typography>

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
                                  Vence em {c.dueLabel}
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
                Debug: console mostra janela (start/end), cutoff e somas por status (confirmed/invoiced/paid).
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
