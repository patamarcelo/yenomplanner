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


// -----------------------------
// Helpers
// -----------------------------
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

// -----------------------------
// Page
// -----------------------------
export default function Invoices() {
  const theme = useTheme();
  const dispatch = useDispatch();

  const accounts = useSelector(selectAccounts);
  const txns = useSelector(selectTransactionsUi);
  const invoices = useSelector(selectInvoices);

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
  const openSpendByCard = useMemo(() => {
    const out = new Map();

    const cardById = new Map();
    for (const c of creditCards || []) {
      const id = String(c.id);
      out.set(id, 0);
      cardById.set(id, c);
    }

    for (const t of txns || []) {
      const accId = resolveAccountIdFromTxn(t);
      if (!accId) continue;
      if (!out.has(accId)) continue;

      if (resolveDirection(t) !== "expense") continue;

      const st = resolveStatus(t);
      if (st !== "confirmed") continue;

      const card = cardById.get(accId);
      const cutoff = Number(card?.statement?.cutoffDay ?? card?.cutoffDay ?? card?.cutoff_day ?? 1);

      const { startISO, endISO } = computeInvoiceWindowISO(ym, cutoff);

      const purchase = String(t?.purchaseDate || t?.purchase_date || "").slice(0, 10);
      if (!purchase || purchase < startISO || purchase > endISO) continue;

      out.set(accId, (out.get(accId) || 0) + Math.abs(centsFromTxn(t)));
    }

    return out; // accountId -> cents
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
        const closedTotalCents = inv ? Number(inv.total_cents || 0) : 0;
        const openCents = openSpendByCard.get(String(c.id)) || 0;

        const displayCents = inv ? closedTotalCents : openCents;

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

          openCents,
          closedTotalCents,
          displayCents,
          dbg: debugByCard.get(String(c.id)) || null,
        };
      })
      .sort((a, b) => (b.displayCents || 0) - (a.displayCents || 0));
  }, [creditCards, monthInvoices, openSpendByCard, theme, debugByCard, ym]);

  const monthTotalCents = useMemo(
    () => rows.reduce((acc, r) => acc + (r.displayCents || 0), 0),
    [rows]
  );

  // -----------------------------
  // Card 3: Anual por cartão (cada cartão uma "coluna" por mês)
  // -----------------------------
  const annualByCardChart = useMemo(() => {
    const y = Number(year);
    if (!y) return { data: [], keys: [], meta: new Map() };

    const keys = creditCards.map((c) => String(c.id));
    const meta = new Map();
    for (const c of creditCards) {
      meta.set(String(c.id), { name: c.name, color: safeCardColor(theme, c.color), cutoff: Number(c.cutoff_day || c.cutoffDay || c?.statement?.cutoffDay || 1) });
    }

    // base meses
    const base = [];
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${y}-${pad2(m)}`;
      const row = { monthKey, label: monthKey };
      for (const k of keys) row[k] = 0;
      base.push(row);
    }

    // ✅ 1) Soma invoices existentes (fechadas/pagas/abertas)
    for (const inv of invoices || []) {
      const invYM = getInvoiceStatementMonthISO(inv).slice(0, 7);
      if (!invYM.startsWith(String(y))) continue;

      const accId = getInvoiceAccountId(inv);
      const idx = base.findIndex((r) => r.monthKey === invYM);
      if (idx < 0) continue;

      // invoice é o "valor fechado" daquele mês/cartão
      base[idx][accId] += Number(inv.total_cents || 0);
    }

    // ✅ 2) Soma transações CONFIRMED que ainda não viraram invoice (abertas)
    // agrupamento simples pra não varrer tudo 12x por cartão
    const txByAcc = new Map();
    for (const t of txns || []) {
      const accId = resolveAccountIdFromTxn(t);
      if (!accId) continue;
      if (!txByAcc.has(accId)) txByAcc.set(accId, []);
      txByAcc.get(accId).push(t);
    }

    const hasInvoiceFor = (accId, monthKey) => {
      // se já tem invoice pro cartão naquele mês, a gente NÃO mistura “aberto” (senão duplica)
      return (invoices || []).some((inv) =>
        getInvoiceAccountId(inv) === String(accId) &&
        getInvoiceStatementMonthISO(inv).slice(0, 7) === monthKey
      );

    };

    for (let m = 1; m <= 12; m++) {
      const monthKey = `${y}-${pad2(m)}`;
      const rowIdx = base.findIndex((r) => r.monthKey === monthKey);
      if (rowIdx < 0) continue;

      for (const accId of keys) {
        // se existe invoice nesse mês/cartão, não soma as tx abertas (senão duplica)
        if (hasInvoiceFor(accId, monthKey)) continue;

        const cardMeta = meta.get(String(accId));
        const cutoff = Number(cardMeta?.cutoff || 1);

        // janela real do cartão para esse statement month
        const { startISO, endISO } = computeInvoiceWindowISO(monthKey, cutoff);

        const list = txByAcc.get(String(accId)) || [];
        let sum = 0;

        for (const t of list) {
          if (resolveDirection(t) !== "expense") continue;

          const st = resolveStatus(t);
          if (st !== "confirmed") continue;

          // opcional: evitar pegar transações já vinculadas (se seu adapter expuser isso)
          const hasInvoiceLink = !!(t?.invoice || t?.invoiceId || t?.invoice_id);
          if (hasInvoiceLink) continue;

          const purchase = String(t?.purchaseDate || t?.purchase_date || "").slice(0, 10);
          if (!purchase || purchase < startISO || purchase > endISO) continue;

          sum += Math.abs(centsFromTxn(t));
        }

        base[rowIdx][accId] += sum; // aqui entra o “aberto” daquele mês/cartão
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
    setPayAmountBRL(
      row?.invoice
        ? String((Number(row.invoice.total_cents || 0) / 100).toFixed(2)).replace(".", ",")
        : ""
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

              <Button
                variant="contained"
                startIcon={<LockRoundedIcon />}
                onClick={handleCloseAllForMonth}
                sx={{ borderRadius: 2 }}
                disabled={!creditCards.length}
              >
                Fechar faturas do mês
              </Button>
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
                  const top = rows[0]?.displayCents || 1;

                  return rows.map((r, idx) => {
                    const pct = clamp((Number(r.displayCents || 0) / Number(top || 1)) * 100, 0, 100);
                    const isClosed = r.invoice?.status === "closed";
                    const isPaid = r.invoice?.status === "paid";

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
                            borderRadius: 1.5,
                            px: 0.75,
                            transition: "background 140ms ease",
                            "&:hover": { background: alpha(t.palette.action.hover, 0.7) },
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
                                  {moneyBRLFromCents(r.displayCents)}
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
                              {!r.invoice ? (
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
                                  Confirmado no período: {moneyBRLFromCents(r.openCents)}
                                </Typography>
                              ) : (
                                <>
                                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
                                    Fechado: {moneyBRLFromCents(r.closedTotalCents)}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    •
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
                                    Confirmado no período: {moneyBRLFromCents(r.openCents)}
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
              <Box sx={{ height: 320, width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={annualByCardChart.data} margin={{ top: 18, right: 18, left: 0, bottom: 0 }}>
                    <CartesianGrid
                      vertical={false}
                      stroke={alpha(theme.palette.divider, 0.55)}
                      strokeDasharray="3 6"
                      opacity={0.18}
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
                      tick={{ fontSize: 12 }}
                      width={70}
                      tickFormatter={(v) => formatBRL((Number(v || 0) / 100) || 0)}
                    />
                    <RechartsTooltip
                      formatter={(value, name) => {
                        const meta = annualByCardChart.meta.get(String(name));
                        const label = meta?.name || name;
                        return [moneyBRLFromCents(value), label];
                      }}
                      labelFormatter={(label) => formatMonthBR(label)}
                    />
                    <Legend
                      formatter={(value) => {
                        const meta = annualByCardChart.meta.get(String(value));
                        return meta?.name || value;
                      }}
                    />

                    {annualByCardChart.keys.map((k) => {
                      const meta = annualByCardChart.meta.get(String(k));
                      return (
                        <Bar
                          key={k}
                          dataKey={k}
                          fillOpacity={1}
                          name={k}
                          stackId="cards"                 // ✅ empilha
                          fill={meta?.color || theme.palette.primary.main}
                          radius={[6, 6, 0, 0]}           // (só o topo fica arredondado, ok em stack)
                          maxBarSize={26}                 // ✅ barra mais “cheia”
                          isAnimationActive={false}
                        />
                      );
                    })}
                    <Bar dataKey="total" fill="transparent" isAnimationActive={false}>
                      <LabelList
                        dataKey="total"
                        position="top"
                        formatter={(v) =>
                          v > 0 ? formatBRL((Number(v) / 100) || 0) : ""
                        }
                        style={{
                          fontWeight: 900,
                          fontSize: 12,
                          fill: theme.palette.text.primary,
                        }}
                      />
                    </Bar>


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
              {payTarget?.invoice ? moneyBRLFromCents(payTarget.invoice.total_cents) : "—"}
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
              {paymentAccounts.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.name} ({a.type})
                </MenuItem>
              ))}
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

    </Stack>
  );
}
