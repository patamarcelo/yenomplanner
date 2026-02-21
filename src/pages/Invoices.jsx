// src/pages/Invoices.jsx
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
  Button,
  TextField,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  IconButton,
  Tooltip,
  LinearProgress,
  Switch,
  FormControlLabel,
  InputAdornment,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import ClearAllRoundedIcon from "@mui/icons-material/ClearAllRounded";
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import RemoveCircleOutlineRoundedIcon from "@mui/icons-material/RemoveCircleOutlineRounded";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  LabelList,
} from "recharts";

import { formatBRL } from "../utils/money";
import { formatMonthBR, formatDateBR } from "../utils/dateBR";

import { selectAccounts } from "../store/accountsSlice";
import { selectTransactionsUi } from "../store/transactionsSlice";
import {
  selectInvoices,
  fetchInvoicesThunk,
  closeInvoiceThunk,
  payInvoiceThunk,
  clearInvoicePreview,
} from "../store/invoicesSlice";

import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";

// -----------------------------
// Helpers
// -----------------------------

function formatInvYMShort(invYM) {
  // invYM: "YYYY-MM"
  const s = String(invYM || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(s)) return s || "—";
  const yy = s.slice(2, 4);
  const mm = s.slice(5, 7);
  return `${mm}/${yy}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function monthStartISO(ym) {
  if (!ym) return "";
  return `${String(ym).slice(0, 7)}-01`;
}

function dayISO(d) {
  if (!d) return "";
  const s = String(d);
  if (s.includes("T")) return s.slice(0, 10);
  return s.slice(0, 10);
}

function resolveTxnInvoiceYM(t) {
  const v =
    t?.invoiceMonth ??
    t?.invoice_month ??
    t?.statement_month ??
    t?.statementMonth ??
    t?.invoice_ym ??
    t?.invoiceYM ??
    "";
  return String(v).slice(0, 7);
}

function resolveDirection(t) {
  const d = String(t?.direction || "").toLowerCase();
  if (d === "income" || d === "entrada" || d === "receita") return "income";
  return "expense";
}

function resolveStatus(t) {
  const s = String(t?.status || "").toLowerCase().trim();
  if (s === "confirmado") return "confirmed";
  if (s === "previsto") return "planned";
  if (s === "pago") return "paid";
  if (s === "confirmed" || s === "planned" || s === "paid" || s === "invoiced") return s;
  return s;
}

function resolveAccountIdFromTxn(t) {
  return String(t?.accountId || t?.account_id || t?.account || "");
}

function isCardAccount(a) {
  return a?.active && a?.type === "credit_card";
}

function cardBg(theme, color = "primary") {
  const base = theme.palette[color]?.main || theme.palette.primary.main;
  return {
    borderRadius: 2,
    border: `1px solid ${alpha(base, 0.22)}`,
    background: `linear-gradient(180deg,
      ${alpha(base, 0.07)} 0%,
      ${theme.palette.background.paper} 45%
    )`,
    boxShadow: "0 12px 40px rgba(0,0,0,0.07)",
    overflow: "hidden",
    minWidth: 0,
  };
}

function moneyBRLFromCents(cents) {
  return formatBRL((Number(cents || 0) / 100) || 0);
}

function safeCardColor(theme, c) {
  const v = String(c || "").trim();
  if (v) return v;
  return theme.palette.primary.main;
}

function parseBRLToCents(v) {
  const raw = String(v || "").trim();
  if (!raw) return null;
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function getInvoiceAccountId(inv) {
  return String(inv?.account_id ?? inv?.accountId ?? inv?.account?.id ?? inv?.account ?? "");
}

function getInvoiceStatementMonthISO(inv) {
  const raw = String(inv?.statement_month ?? inv?.statementMonth ?? "").slice(0, 10);
  if (!raw) return "";
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  return raw;
}

function getInvoiceTotalCents(inv) {
  if (!inv) return 0;
  const v =
    inv?.total_cents ??
    inv?.totalCents ??
    inv?.total_amount_cents ??
    inv?.totalAmountCents ??
    inv?.amount_cents ??
    inv?.amountCents ??
    inv?.total ??
    0;
  return Number(v || 0);
}

function isInvoicePaymentTxn(t) {
  const text = `${t?.description || ""} ${t?.merchant || ""} ${t?.title || ""}`.toLowerCase();
  if (text.includes("pagamento") && text.includes("fatura")) return true;
  if (text.includes("pagar") && text.includes("fatura")) return true;
  if (text.includes("invoice") && text.includes("payment")) return true;

  if (t?.is_invoice_payment) return true;
  if (t?.invoice_payment) return true;
  if (t?.invoicePayment) return true;
  if (t?.invoice_payment_id || t?.invoicePaymentId) return true;

  if (String(t?.kind || t?.type || "").toLowerCase().includes("invoice_payment")) return true;
  if (String(t?.kind || t?.type || "").toLowerCase().includes("bill_payment")) return true;

  return false;
}

// ----------- CRÍTICO: valor correto por mês de fatura -----------
// Se existir "valor da parcela" no payload, usa ele.
// Caso contrário, cai no amount_cents padrão.
function centsFromTxnRaw(t) {
  if (t?.amount_cents != null) return Number(t.amount_cents) || 0;
  if (t?.amountCents != null) return Number(t.amountCents) || 0;

  const raw = t?.amount ?? t?.value ?? 0;
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function centsForStatement(t) {
  const v =
    t?.installment_amount_cents ??
    t?.installmentAmountCents ??
    t?.parcel_amount_cents ??
    t?.parcelAmountCents ??
    t?.per_installment_cents ??
    t?.perInstallmentCents ??
    t?.amount_installment_cents ??
    t?.amountInstallmentCents ??
    null;

  if (v != null && Number.isFinite(Number(v))) return Number(v);

  const total =
    t?.total_amount_cents ??
    t?.totalAmountCents ??
    t?.amount_total_cents ??
    t?.amountTotalCents ??
    null;
  const parts =
    t?.installments ??
    t?.installments_total ??
    t?.installmentsTotal ??
    t?.parcelas ??
    null;

  if (total != null && parts != null) {
    const tt = Number(total);
    const pp = Number(parts);
    if (Number.isFinite(tt) && Number.isFinite(pp) && pp > 0) {
      return Math.round(tt / pp);
    }
  }

  return centsFromTxnRaw(t);
}

function paymentTypeLabel(type) {
  const t = String(type || "").toLowerCase();
  if (t === "credit_card") return "Cartão";
  if (t === "checking") return "Conta";
  if (t === "savings") return "Poupança";
  return "Conta";
}
function paymentTypeIcon(type) {
  const t = String(type || "").toLowerCase();
  if (t === "credit_card") return CreditCardRoundedIcon;
  if (t === "savings") return SavingsRoundedIcon;
  return AccountBalanceRoundedIcon;
}
function paymentTypeOrder(type) {
  const t = String(type || "").toLowerCase();
  if (t === "checking") return 0;
  if (t === "savings") return 1;
  if (t === "credit_card") return 2;
  return 9;
}

function ChartTooltip({ active, payload, label, meta }) {
  if (!active || !payload?.length) return null;

  const lines = payload
    .filter((p) => p && Number(p.value) > 0 && p.dataKey !== "total")
    .map((p) => {
      const m = meta.get(String(p.dataKey));
      return {
        key: p.dataKey,
        name: m?.name || p.name || String(p.dataKey),
        color: m?.color || p.fill || p.stroke,
        value: Number(p.value) || 0,
      };
    })
    .sort((a, b) => b.value - a.value);

  const total = lines.reduce((acc, x) => acc + x.value, 0);

  return (
    <Box
      sx={(t) => ({
        px: 1.25,
        py: 1,
        borderRadius: 2,
        border: `1px solid ${alpha(t.palette.divider, 0.65)}`,
        background: t.palette.mode === "dark" ? alpha("#0b1220", 0.72) : alpha("#ffffff", 0.92),
        boxShadow: t.palette.mode === "dark" ? "0 18px 50px rgba(0,0,0,0.55)" : "0 18px 40px rgba(0,0,0,0.18)",
        backdropFilter: "blur(12px)",
        minWidth: 240,
      })}
    >
      <Typography sx={{ fontWeight: 950, fontSize: 12, mb: 0.75 }}>
        {formatMonthBR(label)}
      </Typography>

      <Stack spacing={0.6}>
        {lines.map((x) => (
          <Stack key={x.key} direction="row" justifyContent="space-between" spacing={2}>
            <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: 999, background: x.color, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ fontWeight: 900 }} noWrap>
                {x.name}
              </Typography>
            </Stack>

            <Typography variant="caption" sx={{ fontWeight: 950 }}>
              {formatBRL((x.value / 100) || 0)}
            </Typography>
          </Stack>
        ))}

        <Divider sx={{ opacity: 0.4, my: 0.4 }} />

        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Typography variant="caption" sx={{ fontWeight: 950, opacity: 0.85 }}>
            Total
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 950 }}>
            {formatBRL((total / 100) || 0)}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

function txnKey(t) {
  return String(t?.id || t?.client_id || t?.clientId || t?.uuid || "").trim();
}

function txnDateISO(t) {
  return String(t?.purchase_date || t?.purchaseDate || "").slice(0, 10);
}

function txnLabel(t) {
  return String(t?.merchant || t?.description || t?.title || "—");
}

function computeDueDateISO(statementYM, dueDay) {
  const [y, m] = String(statementYM).slice(0, 7).split("-");
  const yy = Number(y);
  const mm = Number(m) - 1;
  const last = new Date(yy, mm + 1, 0).getDate();
  const dd = Math.max(1, Math.min(Number(dueDay || 1), last));
  const d = new Date(yy, mm, dd);
  const y2 = d.getFullYear();
  const m2 = pad2(d.getMonth() + 1);
  const d2 = pad2(d.getDate());
  return `${y2}-${m2}-${d2}`;
}

// -----------------------------
// Page
// -----------------------------
export default function Invoices() {
  const theme = useTheme();
  const dispatch = useDispatch();

  const accounts = useSelector(selectAccounts);
  const txns = useSelector(selectTransactionsUi);
  const invoices = useSelector(selectInvoices);

  // dedupe mínimo por id/fallback
  const txnsUnique = useMemo(() => {
    const seen = new Set();
    return (txns || []).filter((t) => {
      const accId = resolveAccountIdFromTxn(t);
      const id =
        txnKey(t) ||
        `${accId}|${txnDateISO(t)}|${centsFromTxnRaw(t)}|${txnLabel(t)}`;

      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [txns]);

  useEffect(() => {
    dispatch(fetchInvoicesThunk());
  }, [dispatch]);

  const initial = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, []);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const ym = useMemo(() => `${year}-${pad2(month)}`, [year, month]);

  // dialogs pay
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [payDate, setPayDate] = useState(() => dayISO(new Date().toISOString()));
  const [payAccountId, setPayAccountId] = useState("");
  const [payAmountBRL, setPayAmountBRL] = useState("");

  // dialog close
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState(null);
  const [closeDueDate, setCloseDueDate] = useState("");
  const [closeTotalBRL, setCloseTotalBRL] = useState("");
  const [closeBusy, setCloseBusy] = useState(false);

  // close modal state (novo)
  const [closeCandidates, setCloseCandidates] = useState([]); // [{t, key, isPrimary, invYM}]
  const [closeSelected, setCloseSelected] = useState(() => new Set());
  const [closeQ, setCloseQ] = useState("");
  const [closeOnlySelected, setCloseOnlySelected] = useState(false);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const creditCards = useMemo(() => (accounts || []).filter(isCardAccount), [accounts]);

  // invoices do mês selecionado (accId -> invoice)
  const monthInvoices = useMemo(() => {
    const sm = monthStartISO(ym);
    const m = new Map();
    for (const inv of invoices || []) {
      const stm = getInvoiceStatementMonthISO(inv);
      if (stm !== sm) continue;
      const accId = getInvoiceAccountId(inv);
      if (!accId) continue;
      m.set(String(accId), inv);
    }
    return m;
  }, [invoices, ym]);

  // txns por conta
  const txByAcc = useMemo(() => {
    const m = new Map();
    for (const t of txnsUnique || []) {
      const accId = resolveAccountIdFromTxn(t);
      if (!accId) continue;
      if (!m.has(accId)) m.set(accId, []);
      m.get(accId).push(t);
    }
    return m;
  }, [txnsUnique]);

  // ============================
  // ✅ subtotal do card (ÂNCORA invoiceMonth)
  // ============================
  const sumCardByInvoiceMonth = useMemo(() => {
    const out = new Map();
    for (const c of creditCards || []) {
      out.set(String(c.id), { confirmedCents: 0, invoicedCents: 0, paidCents: 0 });
    }

    for (const c of creditCards || []) {
      const accId = String(c.id);
      const list = txByAcc.get(accId) || [];
      const bucket = out.get(accId);

      for (const t of list) {
        if (!t) continue;
        if (resolveDirection(t) !== "expense") continue;
        if (isInvoicePaymentTxn(t)) continue;

        const invYM = resolveTxnInvoiceYM(t);
        if (!invYM || invYM !== ym) continue;

        const st = resolveStatus(t);
        const cents = Math.abs(centsForStatement(t));

        if (st === "confirmed") {
          const hasInvoiceLink = !!(t?.invoice || t?.invoiceId || t?.invoice_id);
          if (hasInvoiceLink) continue;
          bucket.confirmedCents += cents;
        } else if (st === "invoiced") {
          bucket.invoicedCents += cents;
        } else if (st === "paid") {
          bucket.paidCents += cents;
        }
      }
    }

    return out;
  }, [creditCards, txByAcc, ym]);

  const displayByCard = useMemo(() => {
    const out = new Map();

    for (const c of creditCards || []) {
      const accId = String(c.id);
      const inv = monthInvoices.get(accId) || null;

      if (inv) {
        const invCents = getInvoiceTotalCents(inv);
        const buckets = sumCardByInvoiceMonth.get(accId) || { invoicedCents: 0, paidCents: 0 };
        out.set(accId, invCents > 0 ? invCents : Math.max(buckets.invoicedCents, buckets.paidCents));
      } else {
        const buckets = sumCardByInvoiceMonth.get(accId) || { confirmedCents: 0 };
        out.set(accId, buckets.confirmedCents || 0);
      }
    }

    return out;
  }, [creditCards, monthInvoices, sumCardByInvoiceMonth]);

  // rows
  const rows = useMemo(() => {
    return (creditCards || [])
      .map((c) => {
        const accId = String(c.id);
        const inv = monthInvoices.get(accId) || null;
        const buckets = sumCardByInvoiceMonth.get(accId) || { confirmedCents: 0, invoicedCents: 0, paidCents: 0 };

        const displayCents = Number(displayByCard.get(accId) || 0);
        const closedTotalCents = inv ? getInvoiceTotalCents(inv) : 0;

        return {
          id: c.id,
          name: c.name,
          color: safeCardColor(theme, c.color),
          cutoffDay: Number(c?.statement?.cutoffDay ?? c?.cutoffDay ?? c?.cutoff_day ?? 1),
          dueDay: Number(c?.statement?.dueDay ?? c?.dueDay ?? c?.due_day ?? 1),

          invoice: inv,
          status: inv?.status || "—",
          dueDate: inv?.due_date || "",
          dueLabel: inv?.due_date ? formatDateBR(inv.due_date) : "—",

          confirmedCents: Number(buckets.confirmedCents || 0),
          windowBilledCents: Math.max(Number(buckets.invoicedCents || 0), Number(buckets.paidCents || 0)),
          closedTotalCents,
          displayCents,
        };
      })
      .sort((a, b) => (b.displayCents || 0) - (a.displayCents || 0));
  }, [creditCards, monthInvoices, sumCardByInvoiceMonth, displayByCard, theme]);

  const monthTotalCents = useMemo(() => rows.reduce((acc, r) => acc + (r.displayCents || 0), 0), [rows]);

  // -----------------------------
  // OPEN CLOSE MODAL (novo, alinhado ao card)
  // -----------------------------
  const buildCloseCandidates = useCallback(
    (accId) => {
      const list = txByAcc.get(String(accId)) || [];

      const primary = [];
      const extras = [];

      for (const t of list) {
        if (!t) continue;
        if (resolveDirection(t) !== "expense") continue;

        const st = resolveStatus(t);
        if (st !== "confirmed") continue; // ✅ só confirmed (nem paid nem invoiced)

        if (isInvoicePaymentTxn(t)) continue;

        const hasInvoiceLink = !!(t?.invoice || t?.invoiceId || t?.invoice_id);
        if (hasInvoiceLink) continue;

        const invYM = resolveTxnInvoiceYM(t); // aqui pode ser "" em alguns casos, mas você disse que tem
        const key = txnKey(t) || `${String(accId)}|${txnDateISO(t)}|${centsFromTxnRaw(t)}|${txnLabel(t)}`;

        const item = { t, key, invYM, isPrimary: invYM === ym };

        if (item.isPrimary) primary.push(item);
        else extras.push(item);
      }

      // ordenação: primárias primeiro, depois extras; dentro: invoiceMonth, date, label
      const sortFn = (a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        const ia = String(a.invYM || "");
        const ib = String(b.invYM || "");
        if (ia !== ib) return ia.localeCompare(ib);
        const da = String(txnDateISO(a.t) || "");
        const db = String(txnDateISO(b.t) || "");
        if (da !== db) return da.localeCompare(db);
        return txnLabel(a.t).localeCompare(txnLabel(b.t), "pt-BR");
      };

      const all = [...primary, ...extras].sort(sortFn);

      const defaultSelected = new Set(primary.map((x) => x.key)); // ✅ exatamente o subtotal do card

      return { all, defaultSelected, counts: { primary: primary.length, extras: extras.length } };
    },
    [txByAcc, ym]
  );

  const openCloseDialog = async (row) => {
    setError("");
    setNotice("");

    const accId = String(row?.id || "");
    if (!accId) return;

    setCloseTarget(row);
    setCloseOpen(true);

    // monta lista local (à prova de “backend preview divergente”)
    const { all, defaultSelected } = buildCloseCandidates(accId);
    setCloseCandidates(all);
    setCloseSelected(defaultSelected);
    setCloseQ("");
    setCloseOnlySelected(false);

    // vencimento sugerido
    const due = computeDueDateISO(ym, Number(row?.dueDay || 1));
    setCloseDueDate(due);

    // total sugerido = soma das selecionadas (primárias)
    const totalCents = all.reduce((acc, x) => {
      if (!defaultSelected.has(x.key)) return acc;
      return acc + Math.abs(centsForStatement(x.t));
    }, 0);
    setCloseTotalBRL(String((totalCents / 100).toFixed(2)).replace(".", ","));

    // zera preview antigo do redux (se existir)
    dispatch(clearInvoicePreview());
  };

  const closeTotals = useMemo(() => {
    const selectedCount = closeSelected?.size || 0;

    let selectedCents = 0;
    let selectedPrimary = 0;
    let selectedExtras = 0;

    for (const x of closeCandidates || []) {
      if (!closeSelected.has(x.key)) continue;
      const cents = Math.abs(centsForStatement(x.t));
      selectedCents += cents;
      if (x.isPrimary) selectedPrimary += 1;
      else selectedExtras += 1;
    }

    return { selectedCount, selectedCents, selectedPrimary, selectedExtras };
  }, [closeCandidates, closeSelected]);

  // manter total do input sincronizado quando marca/desmarca (mas respeita se usuário editar manualmente)
  const [closeTotalTouched, setCloseTotalTouched] = useState(false);
  useEffect(() => {
    if (!closeOpen) return;
    if (closeTotalTouched) return;
    setCloseTotalBRL(String((closeTotals.selectedCents / 100).toFixed(2)).replace(".", ","));
  }, [closeTotals.selectedCents, closeOpen, closeTotalTouched]);

  useEffect(() => {
    if (!closeOpen) setCloseTotalTouched(false);
  }, [closeOpen]);

  const toggleTxn = (key) => {
    setCloseSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const selectAllPrimary = () => {
    const n = new Set();
    for (const x of closeCandidates || []) {
      if (x.isPrimary) n.add(x.key);
    }
    setCloseSelected(n);
  };

  useEffect(() => {
    selectAllPrimary()
  }, []);

  const includeAllExtras = () => {
    setCloseSelected((prev) => {
      const n = new Set(prev);
      for (const x of closeCandidates || []) {
        if (!x.isPrimary) n.add(x.key);
      }
      return n;
    });
  };

  const clearSelection = () => setCloseSelected(new Set());

  const filteredCandidates = useMemo(() => {
    const q = String(closeQ || "").trim().toLowerCase();

    return (closeCandidates || []).filter((x) => {
      if (closeOnlySelected && !closeSelected.has(x.key)) return false;
      if (!q) return true;

      const label = txnLabel(x.t).toLowerCase();
      const desc = String(x.t?.description || "").toLowerCase();
      const invYM = String(x.invYM || "").toLowerCase();
      const date = String(txnDateISO(x.t) || "").toLowerCase();

      return (
        label.includes(q) ||
        desc.includes(q) ||
        invYM.includes(q) ||
        date.includes(q)
      );
    });
  }, [closeCandidates, closeQ, closeOnlySelected, closeSelected]);

  // -----------------------------
  // ANUAL (mantido do seu arquivo: invoiceMonth puro)
  // -----------------------------
  const annualByCardChart = useMemo(() => {
    const y = Number(year);
    if (!y) return { data: [], keys: [], meta: new Map() };

    const keys = (creditCards || []).map((c) => String(c.id));

    const meta = new Map();
    for (const c of creditCards || []) {
      meta.set(String(c.id), { name: c.name, color: safeCardColor(theme, c.color) });
    }

    const invoiceByKey = new Map();
    for (const inv of invoices || []) {
      const invYM = getInvoiceStatementMonthISO(inv).slice(0, 7);
      if (!invYM.startsWith(String(y))) continue;
      const accId = getInvoiceAccountId(inv);
      if (!accId) continue;
      invoiceByKey.set(`${String(accId)}|${invYM}`, inv);
    }

    const base = [];
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${y}-${pad2(m)}`;
      const row = { monthKey, label: monthKey };
      for (const k of keys) row[k] = 0;
      base.push(row);
    }

    const sumByInvoiceMonth = (accId, monthKey, mode) => {
      const mk = String(monthKey).slice(0, 7);
      const list = txByAcc.get(String(accId)) || [];

      let sum = 0;
      for (const t of list) {
        if (!t) continue;
        if (resolveDirection(t) !== "expense") continue;
        if (isInvoicePaymentTxn(t)) continue;

        const invYM = resolveTxnInvoiceYM(t);
        if (!invYM || invYM !== mk) continue;

        const st = resolveStatus(t);
        if (mode === "open") {
          if (st !== "confirmed") continue;
          const hasInvoiceLink = !!(t?.invoice || t?.invoiceId || t?.invoice_id);
          if (hasInvoiceLink) continue;
        } else {
          if (st !== "invoiced" && st !== "paid") continue;
        }

        sum += Math.abs(centsForStatement(t));
      }
      return sum;
    };

    for (let m = 1; m <= 12; m++) {
      const monthKey = `${y}-${pad2(m)}`;
      const row = base[m - 1];

      for (const accId of keys) {
        const inv = invoiceByKey.get(`${String(accId)}|${monthKey}`) || null;

        let valueCents = 0;
        if (inv) {
          const invCents = getInvoiceTotalCents(inv);
          valueCents = invCents > 0 ? invCents : sumByInvoiceMonth(accId, monthKey, "invoiced");
        } else {
          valueCents = sumByInvoiceMonth(accId, monthKey, "open");
        }
        row[accId] = valueCents;
      }
    }

    const data = base.map((r) => {
      const total = keys.reduce((acc, k) => acc + Number(r[k] || 0), 0);
      return { ...r, total };
    });

    return { data, keys, meta };
  }, [year, invoices, creditCards, theme, txByAcc]);

  const handleRefresh = async () => {
    setError("");
    setNotice("");
    try {
      await dispatch(fetchInvoicesThunk()).unwrap();
      setNotice("Faturas atualizadas.");
    } catch (e) {
      setError(e?.message || "Erro ao atualizar faturas.");
    }
  };

  const handleConfirmClose = async () => {
    setError("");
    setNotice("");

    if (!closeTarget?.id) return;

    const due = String(closeDueDate || "").slice(0, 10);
    if (!due) {
      setError("Informe a data de vencimento.");
      return;
    }

    const totalCents = parseBRLToCents(closeTotalBRL);
    if (totalCents == null || totalCents < 0) {
      setError("Total inválido.");
      return;
    }

    const tx_ids = Array.from(closeSelected || []);
    if (!tx_ids.length) {
      setError("Selecione ao menos 1 transação para fechar a fatura.");
      return;
    }

    try {
      setCloseBusy(true);

      await dispatch(
        closeInvoiceThunk({
          account_id: closeTarget.id,
          statement_month: monthStartISO(ym),
          due_date: due,
          total_cents: totalCents,
          tx_ids, // ✅ manda exatamente o que o usuário marcou
        })
      ).unwrap();

      setNotice(`Fatura fechada: ${closeTarget.name}`);
      setCloseOpen(false);
      dispatch(clearInvoicePreview());
    } catch (e) {
      setError(e?.detail || e?.message || "Erro ao fechar fatura.");
    } finally {
      setCloseBusy(false);
    }
  };

  const openPayDialog = (row) => {
    setError("");
    setNotice("");
    setPayTarget(row);
    setPayOpen(true);

    setPayDate(dayISO(new Date().toISOString()));
    setPayAccountId("");

    const cents = Number(row?.displayCents || 0);
    setPayAmountBRL(cents > 0 ? String((cents / 100).toFixed(2)).replace(".", ",") : "");
  };

  const handlePay = async () => {
    setError("");
    setNotice("");

    if (!payTarget?.invoice?.id) {
      setError("Não existe fatura fechada para pagar.");
      return;
    }
    if (!payAccountId) {
      setError("Selecione a conta de pagamento.");
      return;
    }
    if (!payDate) {
      setError("Informe a data de pagamento.");
      return;
    }

    let amount_cents;
    const raw = String(payAmountBRL || "").trim();
    if (raw) {
      const n = Number(raw.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        setError("Valor inválido.");
        return;
      }
      amount_cents = Math.round(n * 100);
    }

    try {
      await dispatch(
        payInvoiceThunk({
          id: payTarget.invoice.id,
          payload: {
            paid_date: payDate,
            payment_account_id: payAccountId,
            ...(amount_cents ? { amount_cents } : {}),
          },
        })
      ).unwrap();

      setNotice("Fatura paga com sucesso.");
      setPayOpen(false);
    } catch (e) {
      setError(e?.message || "Erro ao pagar fatura.");
    }
  };

  const paymentAccounts = useMemo(() => (accounts || []).filter((a) => a.active), [accounts]);

  return (
    <Stack spacing={2.25} sx={{ width: "100%" }}>
      {/* Header */}
      <Card sx={(t) => cardBg(t, "primary")}>
        <CardContent sx={{ p: 2.25 }}>
          <Stack spacing={1.2}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
              <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 950, letterSpacing: -0.4 }} noWrap>
                  Faturas
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Cartões: fatura por <b>invoiceMonth</b>. Fechamento: seleciona transações <b>confirmed</b> (sem invoice).
                </Typography>
              </Stack>

              <Stack spacing={0.15} alignItems="flex-end">
                <Typography sx={{ fontWeight: 950, letterSpacing: -0.4 }}>
                  {moneyBRLFromCents(monthTotalCents)}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                  {rows.length} cartões
                </Typography>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <TextField
                  size="small"
                  select
                  label="Ano"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  sx={{ minWidth: 120 }}
                >
                  {(() => {
                    const y = new Date().getFullYear();
                    const years = [y - 2, y - 1, y, y + 1, y + 2];
                    return years.map((yy) => (
                      <MenuItem key={yy} value={yy}>
                        {yy}
                      </MenuItem>
                    ));
                  })()}
                </TextField>

                <TextField
                  size="small"
                  select
                  label="Mês"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  sx={{ minWidth: 140 }}
                >
                  {Array.from({ length: 12 }).map((_, i) => {
                    const m = i + 1;
                    const key = `${year}-${pad2(m)}`;
                    return (
                      <MenuItem key={key} value={m}>
                        {formatMonthBR(key)}
                      </MenuItem>
                    );
                  })}
                </TextField>

                <Tooltip title="Atualizar faturas">
                  <IconButton onClick={handleRefresh}>
                    <RefreshRoundedIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            {notice ? <Alert severity="success">{notice}</Alert> : null}
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        </CardContent>
      </Card>

      {/* Lista por cartão */}
      <Card sx={(t) => cardBg(t, "info")}>
        <CardContent sx={{ p: 2.25 }}>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline">
              <Typography sx={{ fontWeight: 950, letterSpacing: -0.4 }}>Por cartão</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
                {formatMonthBR(ym)}
              </Typography>
            </Stack>

            <Divider />

            {rows.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Nenhum cartão de crédito ativo.
              </Typography>
            ) : (
              <Stack spacing={0}>
                {rows.map((r, idx) => {
                  const invoice = r.invoice || null;

                  const isClosed = invoice?.status === "closed";
                  const isPaid = invoice?.status === "paid";

                  const safeInvoiceTotalCents =
                    Number(
                      invoice?.total_cents ??
                      invoice?.totalCents ??
                      invoice?.amount_cents ??
                      invoice?.amountCents ??
                      invoice?.total_amount_cents ??
                      invoice?.totalAmountCents ??
                      r.closedTotalCents
                    ) || 0;

                  const safePaidCents =
                    Number(invoice?.paid_total_cents ?? invoice?.paidTotalCents ?? invoice?.paid_cents ?? invoice?.paidCents) ||
                    safeInvoiceTotalCents;

                  const safeDisplayCents =
                    Number(r.displayCents) ||
                    (invoice ? (isPaid ? safePaidCents : safeInvoiceTotalCents) : Number(r.confirmedCents || 0));

                  const top = Number(rows?.[0]?.displayCents) || safeDisplayCents || 1;
                  const pct = clamp((safeDisplayCents / (Number(top) || 1)) * 100, 0, 100);

                  const statusChip = isPaid ? (
                    <Chip size="small" label="Paga" color="success" />
                  ) : isClosed ? (
                    <Chip size="small" label="Fechada" color="info" />
                  ) : r.invoice ? (
                    <Chip size="small" label="Aberta" color="warning" />
                  ) : (
                    <Chip size="small" label="Sem fatura" variant="outlined" />
                  );

                  return (
                    <React.Fragment key={r.id}>
                      <Box
                        sx={(t) => ({
                          py: 1.15,
                          display: "flex",
                          alignItems: "center",
                          gap: 1.25,
                          borderRadius: 1.6,
                          px: 0.9,
                          transition: "background 160ms ease, transform 160ms ease, box-shadow 160ms ease",
                          background: "transparent",
                          "&:hover": {
                            background: alpha(t.palette.background.paper, t.palette.mode === "dark" ? 0.12 : 0.7),
                            boxShadow: t.palette.mode === "dark" ? "0 10px 28px rgba(0,0,0,0.35)" : "0 10px 26px rgba(0,0,0,0.10)",
                            transform: "translateY(-1px)",
                          },
                        })}
                      >
                        <Box sx={{ width: 10, height: 10, borderRadius: 999, background: r.color, flexShrink: 0 }} />

                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 950, fontSize: 13 }} noWrap>
                                {r.name}
                              </Typography>

                              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                                Vencimento: {r.dueLabel}
                              </Typography>
                            </Stack>

                            <Stack direction="row" spacing={1} alignItems="center">
                              {statusChip}
                              <Typography sx={{ fontWeight: 950, fontSize: 13, whiteSpace: "nowrap" }}>
                                {moneyBRLFromCents(safeDisplayCents)}
                              </Typography>
                            </Stack>
                          </Stack>

                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.75 }}>
                            <Box sx={{ flex: 1, mr: 1.25 }}>
                              <LinearProgress
                                variant="determinate"
                                value={pct}
                                sx={(t) => ({
                                  height: 4,
                                  borderRadius: 999,
                                  background: alpha(r.color || t.palette.primary.main, 0.14),
                                  "& .MuiLinearProgress-bar": {
                                    borderRadius: 999,
                                    backgroundColor: alpha(r.color || t.palette.primary.main, 0.92),
                                  },
                                })}
                              />
                            </Box>
                          </Stack>

                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.6, flexWrap: "wrap" }}>
                            {!invoice ? (
                              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
                                Confirmado no mês da fatura: {moneyBRLFromCents(r.confirmedCents)}
                              </Typography>
                            ) : (
                              <>
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
                                  Fechado: {moneyBRLFromCents(safeInvoiceTotalCents)}
                                </Typography>

                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
                                  Confirmado no mês da fatura: {moneyBRLFromCents(r.confirmedCents)}
                                </Typography>
                              </>
                            )}

                            <Tooltip title="Info">
                              <InfoRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                            </Tooltip>
                          </Stack>
                        </Box>

                        <Stack direction="row" spacing={1} alignItems="center">
                          {!r.invoice ? (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => openCloseDialog(r)}
                              sx={{ borderRadius: 2 }}
                              disabled={closeBusy}
                            >
                              Fechar
                            </Button>
                          ) : null}

                          {r.invoice && r.invoice.status === "closed" ? (
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<PaymentsRoundedIcon />}
                              onClick={() => openPayDialog(r)}
                              sx={{ borderRadius: 2 }}
                            >
                              Pagar
                            </Button>
                          ) : null}
                        </Stack>
                      </Box>

                      {idx < rows.length - 1 ? <Divider sx={{ opacity: 0.5 }} /> : null}
                    </React.Fragment>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Anual por cartão */}
      <Card sx={(t) => cardBg(t, "success")}>
        <CardContent sx={{ p: 2.25 }}>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline">
              <Typography sx={{ fontWeight: 950, letterSpacing: -0.4 }}>
                Anual (cada cartão uma coluna)
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
                {year}
              </Typography>
            </Stack>

            <Divider />

            {annualByCardChart.data.length === 0 || annualByCardChart.keys.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Sem dados anuais (ainda não existem invoices para {year}).
              </Typography>
            ) : (
              <Box sx={{ height: 360, width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={annualByCardChart.data} margin={{ top: 28, right: 18, left: 6, bottom: 0 }} barCategoryGap="28%" barGap={6}>
                    <CartesianGrid vertical={false} stroke={alpha(theme.palette.divider, 0.5)} strokeDasharray="3 6" opacity={0.35} />
                    <XAxis dataKey="label" tickFormatter={(v) => formatMonthBR(v)} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={72}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => formatBRL((Number(v || 0) / 100) || 0)}
                    />
                    <RechartsTooltip
                      cursor={{ fill: alpha(theme.palette.action.hover, theme.palette.mode === "dark" ? 0.18 : 0.3) }}
                      content={(props) => <ChartTooltip {...props} meta={annualByCardChart.meta} />}
                    />

                    <Bar
                      dataKey="total"
                      name="Total"
                      fill={theme.palette.primary.main}
                      fillOpacity={0.9}
                      stroke={alpha(theme.palette.primary.dark, 0.9)}
                      strokeWidth={1.5}
                      radius={[10, 10, 0, 0]}
                      maxBarSize={32}
                      isAnimationActive={false}
                    >
                      <LabelList
                        dataKey="total"
                        position="top"
                        formatter={(v) => (v > 0 ? formatBRL((Number(v) / 100) || 0) : "")}
                        style={{ fontWeight: 950, fontSize: 12, fill: theme.palette.text.primary }}
                      />
                    </Bar>

                    {annualByCardChart.keys.map((k) => {
                      const mm = annualByCardChart.meta.get(String(k));
                      return (
                        <Bar
                          key={k}
                          dataKey={k}
                          name={mm?.name || k}
                          fill={mm?.color || theme.palette.secondary.main}
                          fillOpacity={0.95}
                          stroke={alpha(mm?.color || theme.palette.secondary.main, 1)}
                          strokeWidth={1}
                          radius={[6, 6, 0, 0]}
                          maxBarSize={18}
                          isAnimationActive={false}
                          activeBar={{ stroke: alpha(mm?.color || theme.palette.secondary.main, 1), strokeWidth: 2 }}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}

            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Aqui é <b>invoiceMonth puro</b>. Se existir invoice, usa o total da invoice. Se não existir, soma confirmed por <b>invoiceMonth</b>.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Close dialog (novo) */}
      <Dialog
        open={closeOpen}
        onClose={() => {
          if (closeBusy) return;
          setCloseOpen(false);
          dispatch(clearInvoicePreview());
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 950 }}>
          Fechar fatura • {closeTarget?.name} • {formatMonthBR(ym)}
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          <Box sx={{ p: 2.0 }}>
            <Stack spacing={1.1}>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Seleção padrão = <b>exatamente</b> o que compõe o subtotal do card (confirmed + invoiceMonth={ym}).
                Extras = confirmed de outros meses (você pode incluir manualmente).
              </Alert>

              <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                <TextField
                  label="Buscar"
                  value={closeQ}
                  onChange={(e) => setCloseQ(e.target.value)}
                  size="small"
                  sx={{ minWidth: 260, flex: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={closeOnlySelected}
                      onChange={(e) => setCloseOnlySelected(e.target.checked)}
                    />
                  }
                  label={<Typography variant="caption" sx={{ fontWeight: 900 }}>Só selecionadas</Typography>}
                />

                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DoneAllRoundedIcon />}
                  onClick={selectAllPrimary}
                  sx={{ borderRadius: 2 }}
                >
                  Selecionar padrão
                </Button>

                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddCircleOutlineRoundedIcon />}
                  onClick={includeAllExtras}
                  sx={{ borderRadius: 2 }}
                >
                  Incluir extras
                </Button>

                <Button
                  size="small"
                  color="inherit"
                  variant="outlined"
                  startIcon={<ClearAllRoundedIcon />}
                  onClick={clearSelection}
                  sx={{ borderRadius: 2 }}
                >
                  Limpar
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  size="small"
                  color="info"
                  label={`Selecionadas: ${closeTotals.selectedCount} (${moneyBRLFromCents(closeTotals.selectedCents)})`}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Padrão: ${closeTotals.selectedPrimary}`}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Extras: ${closeTotals.selectedExtras}`}
                />
              </Stack>

              <Divider sx={{ opacity: 0.6 }} />

              <Box sx={{ maxHeight: 420, overflow: "auto", pr: 0.5 }}>
                {filteredCandidates.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>
                    Nenhuma transação encontrada.
                  </Typography>
                ) : (
                  <Stack spacing={0.75}>
                    {filteredCandidates.map((x) => {
                      const t = x.t;
                      const key = x.key;
                      const selected = closeSelected.has(key);

                      const cents = Math.abs(centsForStatement(t));
                      const invYM = x.invYM || "—";
                      const date = txnDateISO(t);
                      const label = txnLabel(t);
                      const desc = String(t?.description || "").trim();

                      return (
                        <Box
                          key={key}
                          sx={(tt) => ({
                            px: 1.25,
                            py: 0.95,
                            borderRadius: 2,
                            border: `1px solid ${alpha(tt.palette.divider, 0.7)}`,
                            background: selected
                              ? alpha(tt.palette.primary.main, tt.palette.mode === "dark" ? 0.16 : 0.08)
                              : alpha(tt.palette.background.paper, tt.palette.mode === "dark" ? 0.06 : 0.55),
                            transition: "background 140ms ease, transform 140ms ease, box-shadow 140ms ease",
                            "&:hover": {
                              transform: "translateY(-1px)",
                              boxShadow:
                                tt.palette.mode === "dark"
                                  ? "0 14px 34px rgba(0,0,0,0.38)"
                                  : "0 14px 32px rgba(0,0,0,0.10)",
                            },
                          })}
                        >
                          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.25}>
                            {/* LEFT */}
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
                              <Chip
                                size="small"
                                label={`${x.isPrimary ? "Padrão" : "Extra"} • ${formatInvYMShort(invYM)}`}
                                variant={x.isPrimary ? "filled" : "outlined"}
                                color={x.isPrimary ? "info" : "default"}
                                sx={{
                                  height: 22,
                                  fontWeight: 900,
                                  flexShrink: 0,
                                  "& .MuiChip-label": { px: 0.9 },
                                }}
                              />

                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                {/* linha principal */}
                                <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
                                  <Typography sx={{ fontWeight: 950, fontSize: 13, minWidth: 0 }} noWrap title={label}>
                                    {label}
                                  </Typography>

                                  {/* subinfo curto na mesma linha (opcional) */}
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: "text.secondary",
                                      fontWeight: 850,
                                      minWidth: 0,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                    title={`${date ? formatDateBR(date) : "—"}${desc ? ` • ${desc}` : ""}`}
                                  >
                                    {date ? formatDateBR(date) : "—"}
                                    {desc ? ` • ${desc}` : ""}
                                  </Typography>
                                </Stack>
                              </Box>
                            </Stack>

                            {/* RIGHT */}
                            <Stack direction="row" alignItems="center" spacing={1} flexShrink={0}>
                              <Typography sx={{ fontWeight: 950, fontSize: 13, whiteSpace: "nowrap" }}>
                                {moneyBRLFromCents(cents)}
                              </Typography>

                              <Button
                                size="small"
                                variant={selected ? "contained" : "outlined"}
                                color={selected ? "primary" : "inherit"}
                                startIcon={selected ? <RemoveCircleOutlineRoundedIcon /> : <AddCircleOutlineRoundedIcon />}
                                onClick={() => toggleTxn(key)}
                                sx={{
                                  borderRadius: 999,
                                  textTransform: "none",
                                  fontWeight: 900,
                                  px: 1.2,
                                  minWidth: 112,
                                  boxShadow: selected ? "0 10px 26px rgba(0,0,0,0.12)" : "none",
                                }}
                              >
                                {selected ? "Remover" : "Incluir"}
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Box>
            </Stack>
          </Box>

          {/* sticky footer */}
          <Box
            sx={(t) => ({
              position: "sticky",
              bottom: 0,
              p: 2,
              borderTop: `1px solid ${alpha(t.palette.divider, 0.7)}`,
              background: t.palette.mode === "dark"
                ? alpha(t.palette.background.paper, 0.92)
                : alpha("#ffffff", 0.92),
              backdropFilter: "blur(10px)",
            })}
          >
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <TextField
                  label="Vencimento"
                  type="date"
                  size="small"
                  value={closeDueDate}
                  onChange={(e) => setCloseDueDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 170 }}
                  helperText={"Vencimento da Fatura"}
                />

                <TextField
                  label="Total (ajuste)"
                  size="small"
                  value={closeTotalBRL}
                  onChange={(e) => {
                    setCloseTotalTouched(true);
                    setCloseTotalBRL(e.target.value);
                  }}
                  placeholder="ex: 1234,56"
                  sx={{ minWidth: 200 }}
                  helperText={closeTotalTouched ? "Editado manualmente." : "Automático pela seleção."}
                />
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontWeight: 950 }}>
                  {moneyBRLFromCents(closeTotals.selectedCents)}
                </Typography>

                <Button
                  variant="contained"
                  startIcon={<LockRoundedIcon />}
                  onClick={handleConfirmClose}
                  disabled={closeBusy || !closeSelected.size}
                  sx={{ borderRadius: 2 }}
                >
                  Confirmar fechamento
                </Button>
              </Stack>
            </Stack>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.25 }}>
          <Button
            onClick={() => {
              if (closeBusy) return;
              setCloseOpen(false);
              dispatch(clearInvoicePreview());
            }}
            disabled={closeBusy}
          >
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pay dialog */}
      <Dialog open={payOpen} onClose={() => setPayOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 950 }}>Pagar fatura</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <Alert severity="info">
              {payTarget?.name} • {formatMonthBR(ym)} • Total{" "}
              {payTarget ? moneyBRLFromCents(payTarget.displayCents) : "—"}
            </Alert>

            <TextField
              label="Data de pagamento"
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              select
              label="Conta de pagamento"
              value={payAccountId}
              onChange={(e) => setPayAccountId(e.target.value)}
              fullWidth
            >
              {[...(paymentAccounts || [])]
                .sort((a, b) => {
                  const da = paymentTypeOrder(a.type);
                  const db = paymentTypeOrder(b.type);
                  if (da !== db) return da - db;
                  return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
                })
                .map((a) => {
                  const Icon = paymentTypeIcon(a.type);
                  const label = paymentTypeLabel(a.type);

                  return (
                    <MenuItem key={a.id} value={a.id}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                        <Icon sx={{ fontSize: 18, color: "text.secondary" }} />
                        <Typography variant="body2" sx={{ fontWeight: 900 }}>
                          {label}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          —
                        </Typography>
                        <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                          {a.name}
                        </Typography>
                      </Stack>
                    </MenuItem>
                  );
                })}
            </TextField>

            <TextField
              label="Valor (opcional)"
              value={payAmountBRL}
              onChange={(e) => setPayAmountBRL(e.target.value)}
              placeholder="ex: 1234,56"
              fullWidth
              helperText="Se vazio, usa o total da fatura."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handlePay} startIcon={<PaymentsRoundedIcon />}>
            Confirmar pagamento
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}