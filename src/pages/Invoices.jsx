// src/pages/Invoices.jsx
import React, { useMemo, useState, useEffect } from "react";
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
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
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
  previewCloseInvoiceThunk,
  reopenInvoiceThunk,
  clearInvoicePreview,
  selectInvoicePreview,
  selectInvoicePreviewStatus,
  selectInvoicePreviewError,
} from "../store/invoicesSlice";

import { LabelList } from "recharts";

import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";




// -----------------------------
// Helpers
// -----------------------------
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
  return AccountBalanceRoundedIcon; // checking/default
}

function paymentTypeOrder(type) {
  const t = String(type || "").toLowerCase();
  // Conta primeiro, depois Poupança, depois Cartão
  if (t === "checking") return 0;
  if (t === "savings") return 1;
  if (t === "credit_card") return 2;
  return 9;
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

function centsFromTxn(t) {
  if (t?.amount_cents != null) return Number(t.amount_cents) || 0;
  if (t?.amountCents != null) return Number(t.amountCents) || 0;

  const raw = t?.amount ?? t?.value ?? 0;
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function resolveDirection(t) {
  const d = String(t?.direction || "").toLowerCase();
  if (d === "income" || d === "entrada" || d === "receita") return "income";
  return "expense";
}

function resolveStatus(t) {
  const s = String(t?.status || "").toLowerCase().trim();

  // PT-BR -> EN (padrão interno do app)
  if (s === "confirmado") return "confirmed";
  if (s === "previsto") return "planned";
  if (s === "pago") return "paid";

  // já vem em EN às vezes
  if (s === "confirmed" || s === "planned" || s === "paid" || s === "invoiced") return s;

  return s; // fallback
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

function pad2(n) {
  return String(n).padStart(2, "0");
}

function safeCardColor(theme, c) {
  const v = String(c || "").trim();
  if (v) return v; // se veio HEX do cartão, usa “cheio”
  // fallback: cor cheia do tema (sem alpha)
  return theme.palette.primary.main;
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
  const sm = monthStartDate(statementYM); // YYYY-MM-01 (Date local)
  const prev = addMonthsJS(sm, -1);

  const endDay = clampDayJS(sm.getFullYear(), sm.getMonth(), cutoffDay);
  const startDay = clampDayJS(prev.getFullYear(), prev.getMonth(), cutoffDay);

  // (prev cutoff + 1) .. (current cutoff)
  const periodEnd = new Date(sm.getFullYear(), sm.getMonth(), endDay);
  const periodStart = new Date(prev.getFullYear(), prev.getMonth(), startDay + 1);

  return { startISO: toISODateLocal(periodStart), endISO: toISODateLocal(periodEnd) };
}

function parseBRLToCents(v) {
  const raw = String(v || "").trim();
  if (!raw) return null;
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function centsToBRLInput(cents) {
  const n = Number(cents || 0) / 100;
  return String(n.toFixed(2)).replace(".", ",");
}

function getInvoiceAccountId(inv) {
  return String(
    inv?.account_id ??
    inv?.accountId ??
    inv?.account?.id ??
    inv?.account // fallback (se já for id)
    ?? ""
  );
}

function getInvoiceStatementMonthISO(inv) {
  // garante "YYYY-MM-01"
  const raw = String(inv?.statement_month ?? inv?.statementMonth ?? "").slice(0, 10);
  if (!raw) return "";
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  return raw;
}
function isInvoicePaymentTxn(t) {
  const text = `${t?.description || ""} ${t?.merchant || ""} ${t?.title || ""}`.toLowerCase();

  // heurísticas comuns
  if (text.includes("pagamento") && text.includes("fatura")) return true;
  if (text.includes("pagar") && text.includes("fatura")) return true;
  if (text.includes("invoice") && text.includes("payment")) return true;

  // flags/fields que costumam existir em backends
  if (t?.is_invoice_payment) return true;
  if (t?.invoice_payment) return true;
  if (t?.invoicePayment) return true;
  if (t?.invoice_payment_id || t?.invoicePaymentId) return true;

  // alguns modelos marcam como transferência/ajuste interno
  if (String(t?.kind || t?.type || "").toLowerCase().includes("invoice_payment")) return true;
  if (String(t?.kind || t?.type || "").toLowerCase().includes("bill_payment")) return true;

  return false;
}



function getPreviewPeriod(preview) {
  const s =
    preview?.period_start ||
    preview?.start_date ||
    preview?.startISO ||
    preview?.start ||
    "";
  const e =
    preview?.period_end ||
    preview?.end_date ||
    preview?.endISO ||
    preview?.end ||
    "";
  return { start: String(s).slice(0, 10), end: String(e).slice(0, 10) };
}

function getPreviewTxns(preview) {
  const arr = preview?.transactions || preview?.txns || preview?.items || [];
  return Array.isArray(arr) ? arr : [];
}

function getPreviewTotalCents(preview) {
  const v = preview?.total_cents ?? preview?.totalCents ?? preview?.sum_cents ?? preview?.sumCents ?? 0;
  return Number(v || 0);
}

function getPreviewDueDate(preview) {
  const d = preview?.due_date ?? preview?.dueDate ?? "";
  return String(d).slice(0, 10);
}


// --- Tooltip premium (nome real + total) ---
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
        background:
          t.palette.mode === "dark"
            ? alpha("#0b1220", 0.72)
            : alpha("#ffffff", 0.92),
        boxShadow:
          t.palette.mode === "dark"
            ? "0 18px 50px rgba(0,0,0,0.55)"
            : "0 18px 40px rgba(0,0,0,0.18)",
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
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: x.color,
                  flexShrink: 0,
                }}
              />
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


// -----------------------------
// Page
// -----------------------------
export default function Invoices() {
  const theme = useTheme();
  const dispatch = useDispatch();

  const accounts = useSelector(selectAccounts);
  const txns = useSelector(selectTransactionsUi);
  const invoices = useSelector(selectInvoices);

  const txnsUnique = useMemo(() => {
    const seen = new Set();

    return (txns || []).filter((t) => {
      const accId = resolveAccountIdFromTxn(t);
      const id =
        String(t?.id || t?.client_id || t?.clientId || t?.uuid || "").trim() ||
        // fallback: chave composta (evita duplicar mesmo sem id)
        `${accId}|${String(t?.purchaseDate || t?.purchase_date || "").slice(0, 10)}|${centsFromTxn(t)}|${String(t?.merchant || t?.description || "")}`;

      if (!id) return true;

      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [txns]);


  // carrega invoices na entrada
  useEffect(() => {
    dispatch(fetchInvoicesThunk());
  }, [dispatch]);

  // ano/mês separados (padrão do sistema)
  const initial = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, []);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month); // 1..12
  const ym = useMemo(() => `${year}-${pad2(month)}`, [year, month]);

  // dialogs: pagar
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [payDate, setPayDate] = useState(() => dayISO(new Date().toISOString()));
  const [payAccountId, setPayAccountId] = useState("");
  const [payAmountBRL, setPayAmountBRL] = useState("");

  // dialogs: fechar (preview + confirmação)
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState(null);
  const [closePreview, setClosePreview] = useState(null);
  const [closeDueDate, setCloseDueDate] = useState("");
  const [closeTotalBRL, setCloseTotalBRL] = useState("");
  const [closeBusy, setCloseBusy] = useState(false);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const preview = useSelector(selectInvoicePreview);
  const previewStatus = useSelector(selectInvoicePreviewStatus);
  const previewError = useSelector(selectInvoicePreviewError);



  const openCloseDialog = async (row) => {
    setError("");
    setNotice("");
    setCloseTarget(row);
    setCloseOpen(true);

    // ✅ chama preview no backend
    try {
      const data = await dispatch(
        previewCloseInvoiceThunk({
          account_id: row.id,
          statement_month: monthStartISO(ym), // "YYYY-MM-01"
        })
      ).unwrap();

      // defaults do modal
      setCloseDueDate(String(data?.due_date_suggested || "").slice(0, 10));
      const cents = Number(data?.total_cents_calculated || 0);
      setCloseTotalBRL(String((cents / 100).toFixed(2)).replace(".", ","));
    } catch (e) {
      // erro já vai cair no previewError, mas aqui pode setar algo também
    }
  };


  const creditCards = useMemo(() => (accounts || []).filter(isCardAccount), [accounts]);

  // invoices do mês selecionado (map accountId -> invoice)
  const monthInvoices = useMemo(() => {
    const sm = monthStartISO(ym);
    const m = new Map();

    for (const inv of invoices || []) {
      const stm = getInvoiceStatementMonthISO(inv);
      if (stm !== sm) continue;

      const accId = getInvoiceAccountId(inv);
      if (!accId) continue;

      m.set(accId, inv);
    }
    return m;
  }, [invoices, ym]);

  // “Em aberto” por lançamentos (janela real cutoff): CONFIRMED + purchase_date dentro janela
  // 1) SOMA DA JANELA (fallback / período completo): confirmed + invoiced + paid
  const windowSpendByCard = useMemo(() => {
    // accId -> { invoicedCents, paidCents }
    const out = new Map();

    const cardById = new Map();
    for (const c of creditCards || []) {
      const id = String(c.id);
      out.set(id, { invoicedCents: 0, paidCents: 0 });
      cardById.set(id, c);
    }

    for (const t of txnsUnique || []) {
      const accId = resolveAccountIdFromTxn(t);
      if (!accId || !out.has(accId)) continue;
      if (resolveDirection(t) !== "expense") continue;


      const st = resolveStatus(t);
      if (st !== "invoiced" && st !== "paid") continue;
      if (isInvoicePaymentTxn(t)) continue;

      const card = cardById.get(accId);
      const cutoff = Number(card?.statement?.cutoffDay ?? card?.cutoffDay ?? card?.cutoff_day ?? 1);
      const { startISO, endISO } = computeInvoiceWindowISO(ym, cutoff);

      const purchase = String(t?.purchaseDate || t?.purchase_date || "").slice(0, 10);
      if (!purchase || purchase < startISO || purchase > endISO) continue;

      const cents = Math.abs(centsFromTxn(t));
      const cur = out.get(accId);

      if (st === "paid") cur.paidCents += cents;
      else cur.invoicedCents += cents;
    }

    return out;
  }, [creditCards, ym, txnsUnique]);


  // 2) CONFIRMADO “PURO” (para o texto): só confirmed e sem vínculo com invoice
  const monthValueByCard = useMemo(() => {
    // monthKey = "YYYY-MM"
    const monthKey = ym;

    // index invoice por (accId|monthKey)
    const invoiceByKey = new Map();
    for (const inv of invoices || []) {
      const invYM = getInvoiceStatementMonthISO(inv).slice(0, 7);
      const accId = getInvoiceAccountId(inv);
      if (!accId || !invYM) continue;
      invoiceByKey.set(`${String(accId)}|${invYM}`, inv);
    }

    // meta cutoff por cartão
    const meta = new Map();
    for (const c of creditCards || []) {
      meta.set(String(c.id), {
        cutoff: Number(c.cutoff_day || c.cutoffDay || c?.statement?.cutoffDay || 1),
      });
    }

    // tx por conta (1x)
    const txByAcc = new Map();
    for (const t of txns || []) {
      const accId = resolveAccountIdFromTxn(t);
      if (!accId) continue;
      if (!txByAcc.has(accId)) txByAcc.set(accId, []);
      txByAcc.get(accId).push(t);
    }

    const sumTxnsForWindow = (accId, monthKey, mode) => {
      const cutoff = Number(meta.get(String(accId))?.cutoff || 1);
      const { startISO, endISO } = computeInvoiceWindowISO(monthKey, cutoff);
      const list = txByAcc.get(String(accId)) || [];
      let sum = 0;

      for (const t of list) {
        if (resolveDirection(t) !== "expense") continue;

        const st = resolveStatus(t);
        const hasInvoiceLink = !!(t?.invoice || t?.invoiceId || t?.invoice_id);

        if (mode === "open") {
          if (st !== "confirmed") continue;
          if (hasInvoiceLink) continue;
        } else {
          if (st !== "invoiced" && st !== "paid") continue;

          const invMonth = String(t?.invoiceMonth || t?.invoice_month || "").slice(0, 7);
          if (invMonth && invMonth !== monthKey) continue;
        }

        const purchase = String(t?.purchaseDate || t?.purchase_date || "").slice(0, 10);
        if (!purchase || purchase < startISO || purchase > endISO) continue;

        sum += Math.abs(centsFromTxn(t));
      }

      return sum;
    };

    const out = new Map();

    for (const c of creditCards || []) {
      const accId = String(c.id);
      const key = `${accId}|${monthKey}`;
      const inv = invoiceByKey.get(key);

      let valueCents = 0;

      if (inv) {
        const invCents = getInvoiceTotalCents(inv);
        valueCents = invCents > 0 ? invCents : sumTxnsForWindow(accId, monthKey, "invoiced");
      } else {
        valueCents = sumTxnsForWindow(accId, monthKey, "open");
      }

      out.set(accId, valueCents);
    }

    return out; // Map(accId -> cents)
  }, [ym, invoices, txns, creditCards]);


  const confirmedSpendByCard = useMemo(() => {
    const out = new Map();

    const cardById = new Map();
    for (const c of creditCards || []) {
      const id = String(c.id);
      out.set(id, 0);
      cardById.set(id, c);
    }

    for (const t of txns || []) {
      const accId = resolveAccountIdFromTxn(t);
      if (!accId || !out.has(accId)) continue;
      if (resolveDirection(t) !== "expense") continue;

      const st = resolveStatus(t);
      if (st !== "confirmed") continue;

      // importante: não contar confirmado já vinculado a invoice
      const hasInvoiceLink = !!(t?.invoice || t?.invoiceId || t?.invoice_id);
      if (hasInvoiceLink) continue;

      const card = cardById.get(accId);
      const cutoff = Number(card?.statement?.cutoffDay ?? card?.cutoffDay ?? card?.cutoff_day ?? 1);
      const { startISO, endISO } = computeInvoiceWindowISO(ym, cutoff);

      const purchase = String(t?.purchaseDate || t?.purchase_date || "").slice(0, 10);
      if (!purchase || purchase < startISO || purchase > endISO) continue;

      out.set(accId, (out.get(accId) || 0) + Math.abs(centsFromTxn(t)));
    }

    return out;
  }, [txns, creditCards, ym]);


  // DEBUG counters
  const debugByCard = useMemo(() => {
    const sm = monthStartISO(ym);
    const out = new Map();

    for (const c of creditCards) {
      out.set(String(c.id), {
        totalTx: 0,
        confirmed: 0,
        planned: 0,
        paid: 0,
        invoiced: 0,
        confirmedInMonth: 0,
        withInvoice: 0,
      });
    }

    for (const t of txns || []) {
      const accId = resolveAccountIdFromTxn(t);
      if (!accId) continue;
      if (!out.has(accId)) continue;

      const dbg = out.get(accId);
      dbg.totalTx += 1;

      const st = resolveStatus(t);
      if (st === "confirmed") dbg.confirmed += 1;
      if (st === "planned") dbg.planned += 1;
      if (st === "paid") dbg.paid += 1;
      if (st === "invoiced") dbg.invoiced += 1;

      if (t?.invoice || t?.invoice_id || t?.invoiceId) dbg.withInvoice += 1;

      const invMonth = String(t?.invoiceMonth || t?.invoice_month || "").slice(0, 10);
      if (st === "confirmed" && invMonth === sm) dbg.confirmedInMonth += 1;
    }

    return out;
  }, [txns, creditCards, ym]);

  // painel por cartão
  const rows = useMemo(() => {
    return creditCards
      .map((c) => {
        const inv = monthInvoices.get(String(c.id)) || null;
        const w = windowSpendByCard.get(String(c.id)) || { invoicedCents: 0, paidCents: 0 };
        const windowBilledCents = Math.max(Number(w.invoicedCents || 0), Number(w.paidCents || 0));



        // ✅ se existem os dois, pega o MAIOR (evita “dobro”)


        const displayCents = Number(monthValueByCard.get(String(c.id)) || 0);
        const confirmedCents = confirmedSpendByCard.get(String(c.id)) || 0; // só p/ texto “confirmado no período”
        const closedTotalCents = inv ? getInvoiceTotalCents(inv) : 0;




        const cutoff = Number(c?.statement?.cutoffDay ?? c?.cutoffDay ?? c?.cutoff_day ?? 1);
        const { startISO, endISO } = computeInvoiceWindowISO(ym, cutoff);

        return {
          id: c.id,
          name: c.name,
          color: safeCardColor(theme, c.color),

          cutoffDay: cutoff,
          dueDay: Number(c?.statement?.dueDay ?? c?.dueDay ?? c?.due_day ?? 1),
          periodStartISO: startISO,
          periodEndISO: endISO,

          invoice: inv,
          status: inv?.status || "—",
          dueDate: inv?.due_date || "",
          dueLabel: inv?.due_date ? formatDateBR(inv.due_date) : "—",

          confirmedCents,

          windowBilledCents,
          closedTotalCents,
          displayCents,




          dbg: debugByCard.get(String(c.id)) || null,
        };
      })
      .sort((a, b) => (b.displayCents || 0) - (a.displayCents || 0));
  }, [creditCards, monthInvoices, windowSpendByCard, confirmedSpendByCard, theme, debugByCard, ym]);

  const monthTotalCents = useMemo(
    () => rows.reduce((acc, r) => acc + (r.displayCents || 0), 0),
    [rows]
  );

  // -----------------------------
  // Card 3: Anual por cartão (cada cartão uma "coluna" por mês)
  // -----------------------------
  // ✅ 2) Soma transações CONFIRMED que ainda não viraram invoice (abertas)
  // agrupamento simples pra não varrer tudo 12x por cartão
  const txByAcc = new Map();
  for (const t of txns || []) {
    const accId = resolveAccountIdFromTxn(t);
    if (!accId) continue;
    if (!txByAcc.has(accId)) txByAcc.set(accId, []);
    txByAcc.get(accId).push(t);
  }


  const annualByCardChart = useMemo(() => {
    const y = Number(year);
    if (!y) return { data: [], keys: [], meta: new Map() };

    const keys = (creditCards || []).map((c) => String(c.id));

    // meta: nome/cor/cutoff por cartão
    const meta = new Map();
    for (const c of creditCards || []) {
      meta.set(String(c.id), {
        name: c.name,
        color: safeCardColor(theme, c.color),
        cutoff: Number(c.cutoff_day || c.cutoffDay || c?.statement?.cutoffDay || 1),
      });
    }

    // base meses
    const base = [];
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${y}-${pad2(m)}`; // "YYYY-MM"
      const row = { monthKey, label: monthKey };
      for (const k of keys) row[k] = 0;
      base.push(row);
    }

    // agrupa txns por conta (1x)
    const txByAcc = new Map();
    for (const t of txns || []) {
      const accId = resolveAccountIdFromTxn(t);
      if (!accId) continue;
      if (!txByAcc.has(accId)) txByAcc.set(accId, []);
      txByAcc.get(accId).push(t);
    }

    // index rápido de invoices por (accId|monthKey)
    // monthKey aqui é "YYYY-MM"
    const invoiceByKey = new Map();
    for (const inv of invoices || []) {
      const invYM = getInvoiceStatementMonthISO(inv).slice(0, 7); // "YYYY-MM"
      if (!invYM.startsWith(String(y))) continue;

      const accId = getInvoiceAccountId(inv);
      if (!accId) continue;

      invoiceByKey.set(`${String(accId)}|${invYM}`, inv);
    }

    const hasInvoiceFor = (accId, monthKey) => invoiceByKey.has(`${String(accId)}|${monthKey}`);

    // soma transações na janela do cutoff para um mês/cartão
    // modo "open" => SOMENTE confirmed (e sem invoice link)
    // modo "invoiced" => SOMENTE invoiced/paid (idealmente com invoice link)
    const sumTxnsForWindow = (accId, monthKey, mode) => {
      const cardMeta = meta.get(String(accId));
      const cutoff = Number(cardMeta?.cutoff || 1);

      const { startISO, endISO } = computeInvoiceWindowISO(monthKey, cutoff);
      const list = txByAcc.get(String(accId)) || [];

      let sum = 0;
      for (const t of list) {
        if (resolveDirection(t) !== "expense") continue;

        const st = resolveStatus(t);
        const hasInvoiceLink = !!(t?.invoice || t?.invoiceId || t?.invoice_id);

        if (mode === "open") {
          // aberto: só CONFIRMED e NÃO vinculada a invoice
          if (st !== "confirmed") continue;
          if (hasInvoiceLink) continue;
        } else {
          // faturado: aceita INVOICED/PAID
          if (st !== "invoiced" && st !== "paid") continue;

          // se o txn tem invoice_month, usa como “âncora” pra evitar pegar coisa errada
          const invMonth = String(t?.invoiceMonth || t?.invoice_month || "").slice(0, 7);
          if (invMonth && invMonth !== monthKey) continue;

          // NÃO exige invoice_id porque no seu payload pode não vir
        }

        const purchase = String(t?.purchaseDate || t?.purchase_date || "").slice(0, 10);
        if (!purchase || purchase < startISO || purchase > endISO) continue;

        sum += Math.abs(centsFromTxn(t));
      }

      return sum;
    };

    // monta valores por mês/cartão (NUNCA usar += em dois lugares)
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${y}-${pad2(m)}`; // "YYYY-MM"
      const rowIdx = base.findIndex((r) => r.monthKey === monthKey);
      if (rowIdx < 0) continue;

      for (const accId of keys) {
        let valueCents = 0;

        if (hasInvoiceFor(accId, monthKey)) {
          const inv = invoiceByKey.get(`${String(accId)}|${monthKey}`);
          const invCents = Number(
            inv?.total_cents ??
            inv?.totalCents ??
            inv?.total_amount_cents ??
            inv?.amount_cents ??
            0
          );

          // ✅ se invoice existir, usamos SOMENTE invoice.
          // fallback só se vier 0 (ex: backend não gravou total corretamente)
          valueCents = invCents > 0 ? invCents : sumTxnsForWindow(accId, monthKey, "invoiced");
        } else {
          // ✅ sem invoice: SOMENTE aberto (confirmed)
          valueCents = sumTxnsForWindow(accId, monthKey, "open");
        }

        base[rowIdx][accId] = valueCents; // <- SET, não +=
      }
    }

    const data = base.map((r) => {
      const total = keys.reduce((acc, k) => acc + Number(r[k] || 0), 0);
      return { ...r, total };
    });

    return { data, keys, meta };
  }, [year, invoices, txns, creditCards, theme]);

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

  const handleCloseAllForMonth = async () => {
    setError("");
    setNotice("");

    const statement_month = monthStartISO(ym);

    try {
      for (const c of creditCards) {
        const hasInv = monthInvoices.get(String(c.id));
        if (hasInv) continue;

        await dispatch(
          closeInvoiceThunk({
            account_id: c.id,
            statement_month,
          })
        ).unwrap();
      }

      setNotice("Fechamento concluído para os cartões sem fatura.");
    } catch (e) {
      setError(e?.message || "Erro ao fechar faturas.");
    }
  };

  // -----------------------------
  // Close (preview + confirmar)
  // -----------------------------


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

    try {
      setCloseBusy(true);

      await dispatch(
        closeInvoiceThunk({
          account_id: closeTarget.id,
          statement_month: monthStartISO(ym),
          // overrides (seu backend já está preparado)
          due_date: due,
          total_cents: totalCents,
        })
      ).unwrap();

      setNotice(`Fatura fechada: ${closeTarget.name}`);
      setCloseOpen(false);
    } catch (e) {
      setError(e?.detail || e?.message || "Erro ao fechar fatura.");
    } finally {
      setCloseBusy(false);
    }
  };

  // -----------------------------
  // Pay
  // -----------------------------
  const openPayDialog = (row) => {
    setError("");
    setNotice("");
    setPayTarget(row);
    setPayOpen(true);

    setPayDate(dayISO(new Date().toISOString()));
    setPayAccountId("");

    const cents = Number(row?.displayCents || 0);
    setPayAmountBRL(
      cents > 0 ? String((cents / 100).toFixed(2)).replace(".", ",") : ""
    );
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

  // contas disponíveis para pagar (todas ativas, incluindo checking)
  const paymentAccounts = useMemo(() => (accounts || []).filter((a) => a.active), [accounts]);


  const DEBUG = false;

  // log básico do mês + resumo dos invoices
  useEffect(() => {
    if (!DEBUG) return;
    const sm = monthStartISO(ym);

    console.log("=== [Invoices DEBUG] ym =", ym, "sm =", sm);
    console.log("[invoices] count =", (invoices || []).length);

    // Mostra os invoices que caem nesse mês (pra ver statement_month e account_id)
    const inMonth = (invoices || [])
      .map((inv) => ({
        id: inv?.id,
        accountId: getInvoiceAccountId(inv),
        statement_month: getInvoiceStatementMonthISO(inv),
        status: inv?.status,
        total_cents: inv?.total_cents,
      }))
      .filter((x) => x.statement_month === sm);

    console.table(inMonth);
  }, [DEBUG, ym, invoices]);

  useEffect(() => {
    if (!DEBUG) return;

    const sm = monthStartISO(ym);

    for (const c of creditCards || []) {
      const accId = String(c.id);

      const inv = monthInvoices.get(accId) || null;

      const cutoff = Number(c?.statement?.cutoffDay ?? c?.cutoffDay ?? c?.cutoff_day ?? 1);
      const { startISO, endISO } = computeInvoiceWindowISO(ym, cutoff);

      // filtra txns do cartão na janela
      const list = (txnsUnique || []).filter((t) => {
        const a = resolveAccountIdFromTxn(t);
        if (String(a) !== accId) return false;
        if (resolveDirection(t) !== "expense") return false;

        const purchase = String(t?.purchaseDate || t?.purchase_date || "").slice(0, 10);
        if (!purchase || purchase < startISO || purchase > endISO) return false;

        return true;
      });

      const sums = { confirmed: 0, invoiced: 0, paid: 0, planned: 0, other: 0, total: 0 };
      for (const t of list) {
        const st = resolveStatus(t);
        const cents = Math.abs(centsFromTxn(t));
        sums.total += cents;

        if (st === "confirmed") sums.confirmed += cents;
        else if (st === "invoiced") sums.invoiced += cents;
        else if (st === "paid") sums.paid += cents;
        else if (st === "planned") sums.planned += cents;
        else sums.other += cents;
      }

      console.log(`[CARD] ${c.name} (${accId}) sm=${sm}`);
      console.log("  invoice:", inv ? {
        id: inv?.id,
        statement_month: getInvoiceStatementMonthISO(inv),
        status: inv?.status,
        total_cents: inv?.total_cents
      } : null);
      console.log("  window:", { startISO, endISO, cutoff });
      console.log("  txnsInWindow:", list.length, "sums(cents):", sums);
    }
  }, [DEBUG, ym, creditCards, monthInvoices, txns, txnsUnique]);


  useEffect(() => {
    console.log("[Invoices] txns:", (txns || []).length, "txnsUnique:", (txnsUnique || []).length);
  }, [txns, txnsUnique]);


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
                  Acompanha gasto por cartão (CONFIRMED) e fecha/paga as faturas.
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

              {/* <Button
                variant="contained"
                startIcon={<LockRoundedIcon />}
                onClick={handleCloseAllForMonth}
                sx={{ borderRadius: 2 }}
                disabled={!creditCards.length}
              >
                Fechar faturas do mês
              </Button> */}
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
              <Typography sx={{ fontWeight: 950, letterSpacing: -0.4 }}>
                Por cartão
              </Typography>
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
                {(() => {

                  return rows.map((r, idx) => {
                    const invoice = r.invoice || null;

                    // ✅ fallback robusto (porque após pagar, alguns campos mudam/não vêm mais)
                    const safeOpenCents = Number(r.confirmedCents ?? 0) || 0;

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

                    // Se você tiver algum campo "paid_total_cents" no retorno, aproveita:
                    const safePaidCents =
                      Number(
                        invoice?.paid_total_cents ??
                        invoice?.paidTotalCents ??
                        invoice?.paid_cents ??
                        invoice?.paidCents
                      ) || safeInvoiceTotalCents;

                    const isClosed = invoice?.status === "closed";
                    const isPaid = invoice?.status === "paid";

                    // ✅ valor principal mostrado à direita
                    const safeDisplayCents =
                      Number(r.displayCents) ||
                      (invoice ? (isPaid ? safePaidCents : safeInvoiceTotalCents) : safeOpenCents);

                    // ✅ para "Fechado:" lá embaixo (mesma ideia)
                    const safeClosedTotalCents = invoice ? safeInvoiceTotalCents : 0;

                    // ✅ top/pct não pode quebrar quando tudo vira 0
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

                    const dbg = r.dbg || {};

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
                              boxShadow: t.palette.mode === "dark"
                                ? "0 10px 28px rgba(0,0,0,0.35)"
                                : "0 10px 26px rgba(0,0,0,0.10)",
                              transform: "translateY(-1px)",
                            },
                          })}
                        >
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: 999,
                              background: r.color,
                              flexShrink: 0,
                            }}
                          />

                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                              <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 950, fontSize: 13 }} noWrap>
                                  {r.name}
                                </Typography>

                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                                  Período: {formatDateBR(r.periodStartISO)} — {formatDateBR(r.periodEndISO)} • Corte dia{" "}
                                  {r.cutoffDay}
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
                                  Confirmado no período: {moneyBRLFromCents(r.confirmedCents)}
                                </Typography>
                              ) : (
                                <>
                                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
                                    Fechado: {moneyBRLFromCents(r.closedTotalCents)}
                                  </Typography>

                                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
                                    Confirmado no período: {moneyBRLFromCents(r.confirmedCents)}
                                  </Typography>
                                </>
                              )}

                              <Tooltip
                                title={
                                  <Box sx={{ p: 0.5 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 900 }}>
                                      Debug
                                    </Typography>
                                    <Typography variant="caption" display="block">
                                      totalTx: {dbg.totalTx || 0}
                                    </Typography>
                                    <Typography variant="caption" display="block">
                                      confirmed: {dbg.confirmed || 0} • planned: {dbg.planned || 0} • paid: {dbg.paid || 0}
                                    </Typography>
                                    <Typography variant="caption" display="block">
                                      invoiced: {dbg.invoiced || 0} • withInvoice: {dbg.withInvoice || 0}
                                    </Typography>
                                  </Box>
                                }
                              >
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
                  });
                })()}
              </Stack>
            )}

            {rows.length > 0 && (invoices || []).length === 0 ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                Ainda não existe nenhuma fatura (Invoice) criada. As transações não viram Invoice automaticamente —
                você precisa clicar em <b>Fechar</b> (por cartão) ou <b>Fechar faturas do mês</b>.
              </Alert>
            ) : null}
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
                  <BarChart
                    data={annualByCardChart.data}
                    margin={{ top: 28, right: 18, left: 6, bottom: 0 }}
                    barCategoryGap="28%"
                    barGap={6}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke={alpha(theme.palette.divider, 0.5)}
                      strokeDasharray="3 6"
                      opacity={0.35}
                    />

                    <XAxis
                      dataKey="label"
                      tickFormatter={(v) => formatMonthBR(v)}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12 }}
                    />

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={72}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => formatBRL((Number(v || 0) / 100) || 0)}
                    />

                    <RechartsTooltip
                      cursor={{
                        fill: alpha(theme.palette.action.hover, theme.palette.mode === "dark" ? 0.18 : 0.3),
                      }}
                      content={(props) => (
                        <ChartTooltip {...props} meta={annualByCardChart.meta} />
                      )}
                    />

                    {/* 🔵 TOTAL DO MÊS (barra azul forte) */}
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
                        style={{
                          fontWeight: 950,
                          fontSize: 12,
                          fill: theme.palette.text.primary,
                        }}
                      />
                    </Bar>

                    {/* 🟢 CARTÕES (agrupados na frente) */}
                    {annualByCardChart.keys.map((k) => {
                      const meta = annualByCardChart.meta.get(String(k));

                      return (
                        <Bar
                          key={k}
                          dataKey={k}
                          name={meta?.name || k}
                          fill={meta?.color || theme.palette.secondary.main}
                          fillOpacity={0.95}
                          stroke={alpha(meta?.color || theme.palette.secondary.main, 1)}
                          strokeWidth={1}
                          radius={[6, 6, 0, 0]}
                          maxBarSize={18}
                          isAnimationActive={false}
                          activeBar={{
                            stroke: alpha(meta?.color || theme.palette.secondary.main, 1),
                            strokeWidth: 2,
                          }}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}

            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Esse gráfico só usa <b>Invoices</b> existentes. O card “Por cartão” acompanha por{" "}
              <b>transactions CONFIRMED</b> dentro da janela do <b>cutoff</b>.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Close dialog (preview + confirmar) */}
      <Dialog open={closeOpen} onClose={() => (closeBusy ? null : setCloseOpen(false))} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 950 }}>
          Fechar fatura
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <Alert severity="info">
              {closeTarget?.name || "Cartão"} • {formatMonthBR(ym)}
            </Alert>

            {closeBusy && !closePreview ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Gerando preview…
              </Typography>
            ) : null}

            {closePreview ? (
              <>
                {(() => {
                  const { start, end } = getPreviewPeriod(closePreview);
                  const totalCents = getPreviewTotalCents(closePreview);
                  const txs = getPreviewTxns(closePreview);

                  return (
                    <>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
                          Período
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 950 }}>
                          {start ? formatDateBR(start) : "—"} — {end ? formatDateBR(end) : "—"}
                        </Typography>
                      </Stack>

                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
                          Total sugerido
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 950 }}>
                          {moneyBRLFromCents(totalCents)}
                        </Typography>
                      </Stack>

                      <TextField
                        label="Vencimento"
                        type="date"
                        value={closeDueDate}
                        onChange={(e) => setCloseDueDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                      />

                      <TextField
                        label="Total (ajustável)"
                        value={closeTotalBRL}
                        onChange={(e) => setCloseTotalBRL(e.target.value)}
                        placeholder="ex: 1234,56"
                        helperText="Ajuste por câmbio/lançamentos faltantes, se necessário."
                        fullWidth
                      />

                      <Divider />

                      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
                        Transações no fechamento ({txs.length})
                      </Typography>

                      <Stack spacing={0.75} sx={{ maxHeight: 260, overflow: "auto", pr: 0.5 }}>
                        {txs.length === 0 ? (
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            Nenhuma transação encontrada para esse período.
                          </Typography>
                        ) : (
                          txs.map((t) => {
                            const id = t.id || t.client_id || t.clientId || `${t.merchant}-${t.purchase_date}`;
                            const desc = t.description || t.merchant || "—";
                            const date = String(t.purchase_date || t.purchaseDate || "").slice(0, 10);
                            const cents =
                              Number(t.amount_cents ?? t.amountCents ?? null) ??
                              Math.abs(centsFromTxn(t));

                            return (
                              <Box
                                key={id}
                                sx={(tt) => ({
                                  p: 1,
                                  borderRadius: 1.5,
                                  border: `1px solid ${alpha(tt.palette.divider, 0.6)}`,
                                })}
                              >
                                <Stack direction="row" justifyContent="space-between" spacing={1}>
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ fontWeight: 900, fontSize: 13 }} noWrap>
                                      {desc}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                      {date ? formatDateBR(date) : "—"}
                                    </Typography>
                                  </Box>

                                  <Typography sx={{ fontWeight: 950, fontSize: 13, whiteSpace: "nowrap" }}>
                                    {moneyBRLFromCents(cents)}
                                  </Typography>
                                </Stack>
                              </Box>
                            );
                          })
                        )}
                      </Stack>
                    </>
                  );
                })()}
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseOpen(false)} disabled={closeBusy}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={<LockRoundedIcon />}
            onClick={handleConfirmClose}
            disabled={!closePreview || closeBusy}
          >
            Confirmar fechamento
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
      <Dialog
        open={closeOpen}
        onClose={() => {
          setCloseOpen(false);
          dispatch(clearInvoicePreview());
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 950 }}>
          Fechar fatura • {closeTarget?.name} • {formatMonthBR(ym)}
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={1.2}>
            {previewStatus === "loading" ? <LinearProgress /> : null}

            {previewError ? <Alert severity="error">{previewError}</Alert> : null}

            {preview ? (
              <>
                <Alert severity="info">
                  Período: <b>{formatDateBR(preview.period_start)}</b> até{" "}
                  <b>{formatDateBR(preview.period_end)}</b>
                </Alert>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <TextField
                    label="Vencimento"
                    type="date"
                    value={closeDueDate}
                    onChange={(e) => setCloseDueDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 170 }}
                  />

                  <TextField
                    label="Total (ajuste)"
                    value={closeTotalBRL}
                    onChange={(e) => setCloseTotalBRL(e.target.value)}
                    placeholder="ex: 1234,56"
                    sx={{ minWidth: 170 }}
                    helperText="Opcional: câmbio/ajustes."
                  />
                </Stack>

                <Divider />

                <Typography sx={{ fontWeight: 900 }}>
                  Transações elegíveis ({(preview.tx || []).length})
                </Typography>

                {(preview.tx || []).length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Nenhuma transação CONFIRMED sem invoice no período.
                  </Typography>
                ) : (
                  <Stack spacing={0.75}>
                    {(preview.tx || []).map((t) => (
                      <Box
                        key={t.id}
                        sx={(theme) => ({
                          p: 1,
                          borderRadius: 1.5,
                          border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 1,
                        })}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 900 }} noWrap>
                            {t.merchant || "—"}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {formatDateBR(t.purchase_date)} • {t.description || ""}
                          </Typography>
                        </Box>

                        <Typography sx={{ fontWeight: 950, whiteSpace: "nowrap" }}>
                          {moneyBRLFromCents(Number(t.amount_cents || 0))}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </>
            ) : null}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => {
              setCloseOpen(false);
              dispatch(clearInvoicePreview());
            }}
          >
            Cancelar
          </Button>

          <Button
            variant="contained"
            startIcon={<LockRoundedIcon />}
            disabled={!closeTarget || previewStatus !== "succeeded"}
            onClick={async () => {
              setError(""); setNotice("");
              try {
                // total override (opcional)
                let total_cents;
                const raw = String(closeTotalBRL || "").trim();
                if (raw) {
                  const n = Number(raw.replace(".", "").replace(",", "."));
                  if (!Number.isFinite(n) || n < 0) throw new Error("Total inválido.");
                  total_cents = Math.round(n * 100);
                }

                await dispatch(
                  closeInvoiceThunk({
                    account_id: closeTarget.id,
                    statement_month: monthStartISO(ym),
                    // ✅ overrides opcionais (se backend aceitar)
                    ...(closeDueDate ? { due_date: closeDueDate } : {}),
                    ...(total_cents != null ? { total_cents } : {}),
                    // se você quiser travar exatamente as tx do preview:
                    ...(preview?.tx?.length ? { tx_ids: preview.tx.map((x) => x.id) } : {}),
                  })
                ).unwrap();

                setNotice(`Fatura fechada: ${closeTarget.name}`);
                setCloseOpen(false);
                dispatch(clearInvoicePreview());
              } catch (e) {
                setError(e?.message || "Erro ao fechar fatura.");
              }
            }}
          >
            Confirmar fechamento
          </Button>
        </DialogActions>
      </Dialog>

    </Stack >
  );
}
