// src/components/NewTransactionModal.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  MenuItem,
  Typography,
  Divider,
  Chip,
  Box,
  Alert,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Autocomplete,
} from "@mui/material";

import { useDispatch, useSelector } from "react-redux";

import { splitInstallments } from "../utils/splitInstallments";
import { formatBRL } from "../utils/money";
import { computeInvoiceMonthFromPurchase, ymFromDate } from "../utils/BillingDates.js";
import { formatMonthBR } from "../utils/dateBR";

import { createTransactionThunk } from "../store/transactionsSlice";
import { selectCategories } from "../store/categoriesSlice";

import buildTxnHistoryIndex from "./transactions/buildTxnHistoryIndex";

import { selectTransactionsUi } from "../store/transactionsSlice";


const MIN_MERCHANT_CHARS = 2; // use 1 se preferir
const MIN_DESC_CHARS = 0;


// ---------- helpers ----------
function addMonthsToISO(iso, idx) {
  const s = String(iso || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "";

  const base = new Date(y, m - 1, 1);
  base.setMonth(base.getMonth() + Number(idx || 0));

  const yy = base.getFullYear();
  const mm0 = base.getMonth(); // 0-11
  const safeDay = clampDayToMonth(yy, mm0, d);

  const mm = String(mm0 + 1).padStart(2, "0");
  const dd = String(safeDay).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatDateBRShort(iso) {
  const s = String(iso || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function ymFromISODate(iso) {
  const s = String(iso || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return s.slice(0, 7);
}

function clampDayToMonth(year, monthIndex0, day) {
  // monthIndex0: 0-11
  const d = Math.max(1, Math.min(31, Number(day || 1)));
  const last = new Date(year, monthIndex0 + 1, 0).getDate(); // último dia do mês
  return Math.min(d, last);
}

function addMonthsYM(ym, add) {
  const [y0, m0] = String(ym || "").split("-");
  const y = Number(y0);
  const m = Number(m0);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return "";
  const base = new Date(y, m - 1, 1);
  base.setMonth(base.getMonth() + Number(add || 0));
  const yy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function ymCompare(a, b) {
  // retorna -1,0,1 comparando YYYY-MM
  if (!a || !b) return 0;
  return a < b ? -1 : a > b ? 1 : 0;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clampDay(d) {
  const n = Number(d);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(28, n));
}

function makeChargeDateFromYM(ym, dueDay) {
  const s = String(ym || "");
  if (!/^\d{4}-\d{2}$/.test(s)) return "";
  const dd = String(clampDay(dueDay)).padStart(2, "0");
  return `${s}-${dd}`;
}

function genClientId() {
  const rand = Math.random().toString(16).slice(2);
  return `manual:${Date.now()}:${rand}`;
}

// BRL input helpers (igual ao grid/dialog)
function sanitizeBrlInput(raw) {
  return String(raw ?? "")
    .replace(/\s+/g, "")
    .replace(/[^0-9,\.\-]/g, "");
}

function parseBrlToNumber(raw) {
  const s0 = sanitizeBrlInput(raw);
  if (!s0) return NaN;

  if (s0.includes(",")) {
    const s = s0.replace(/\./g, "").replace(/,/g, ".");
    return Number(s);
  }
  return Number(s0);
}

function formatNumberToBrlInput(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return v.toFixed(2).replace(".", ",");
}

function safeAccountActive(a) {
  return a?.active !== false;
}

// -----------------------------------------------
// ✅ Modal
// -----------------------------------------------
export default function NewTransactionModal({ open, onClose, rows }) {
  const dispatch = useDispatch();

  const accounts = useSelector((s) => s.accounts?.accounts || []);
  const apiError = useSelector((s) => s.transactions?.error || "");

  const rowsFromStore = useSelector(selectTransactionsUi);
  const historyRows = useMemo(() => (Array.isArray(rowsFromStore) ? rowsFromStore : []), [rowsFromStore]);

  // ✅ categorias reais do store (para ficar consistente com grid)
  const categories = useSelector(selectCategories) || [];


  const historyIndex = useMemo(() => buildTxnHistoryIndex(historyRows), [historyRows]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // defaults
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [chargeDate, setChargeDate] = useState(todayISO());
  const [chargeTouched, setChargeTouched] = useState(false);

  const [accountId, setAccountId] = useState("");

  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");

  // ✅ usar slug (consistente com grid)
  const [categoryId, setCategoryId] = useState("outros");

  // ✅ guardar como string BRL (sempre positivo)
  const [amount, setAmount] = useState("0");

  // ✅ status (mantive seus valores em inglês para não quebrar back/store)
  const [status, setStatus] = useState("planned"); // planned | confirmed | paid | overdue

  // ✅ trava auto-status quando usuário mexer manualmente
  const statusTouchedRef = useRef(false);

  const [kind, setKind] = useState("one_off"); // one_off | recurring | installment
  const [nParts, setNParts] = useState(2);

  // expense | income
  const [direction, setDirection] = useState("expense");

  // ✅ recorrência mensal: até (YYYY-MM)
  const [recurringUntilYm, setRecurringUntilYm] = useState(() => {
    const t = new Date();
    const y = t.getFullYear();
    return `${y}-12`; // padrão: dezembro do ano atual
  });


  const selectedAccount = useMemo(() => {
    if (!accountId) return null;
    return accounts.find((a) => a.id === accountId) || null;
  }, [accounts, accountId]);

  // invoiceMonth (YYYY-MM)
  const invoiceMonth = useMemo(() => {
    if (selectedAccount?.type === "credit_card") {
      const cutoffDay = selectedAccount?.statement?.cutoffDay;
      return computeInvoiceMonthFromPurchase(purchaseDate, cutoffDay);
    }
    return ymFromDate(chargeDate);
  }, [purchaseDate, chargeDate, selectedAccount]);

  // ✅ status automático ao selecionar conta
  function applyAutoStatusByAccount(nextAccountId) {
    if (statusTouchedRef.current) return;

    const acc = nextAccountId ? accounts.find((a) => a.id === nextAccountId) : null;
    if (!acc) return;

    if (acc.type === "credit_card") setStatus("confirmed");
    else setStatus("paid");
  }

  // ✅ auto categoria pela loja (mais frequente)
  const suggestedCategoryForMerchant = useMemo(() => {
    return historyIndex?.getBestCategoryForMerchant?.(merchant) || "";
  }, [historyIndex, merchant]);

  useEffect(() => {
    if (!open) return;
    if (!merchant) return;
    if (!suggestedCategoryForMerchant) return;

    // autopreenche se está vazio ou no default "outros"
    if (!categoryId || categoryId === "outros") {
      setCategoryId(suggestedCategoryForMerchant);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, merchant, suggestedCategoryForMerchant]);

  // auto-ajuste chargeDate quando trocar conta / purchaseDate (se usuário não editou manualmente)
  useEffect(() => {
    if (!open) return;

    if (!chargeTouched) {
      const today = todayISO();

      if (!selectedAccount) {
        setChargeDate(today);
        return;
      }

      if (selectedAccount.type === "checking") {
        setChargeDate(purchaseDate || today);
        return;
      }

      const dueDay = selectedAccount?.statement?.dueDay ?? 10;
      const ym = computeInvoiceMonthFromPurchase(purchaseDate || today, selectedAccount?.statement?.cutoffDay);
      const d = makeChargeDateFromYM(ym, dueDay);
      setChargeDate(d || today);
    }
  }, [open, selectedAccount, purchaseDate, chargeTouched]);

  const previewParts = useMemo(() => {
    const n = Math.max(1, Number(nParts || 1));
    const v = parseBrlToNumber(amount);
    if (kind !== "installment" || !Number.isFinite(v) || v <= 0 || n <= 1) return [];
    return splitInstallments(v, n);
  }, [amount, kind, nParts]);

  const previewInstallments = useMemo(() => {
    const n = Math.max(1, Number(nParts || 1));
    const v = parseBrlToNumber(amount);
    if (kind !== "installment" || !Number.isFinite(v) || v <= 0 || n <= 1) return [];

    const parts = splitInstallments(v, n);

    // usa a chargeDate como base das datas previstas
    const baseCharge = chargeDate || todayISO();

    return parts.map((val, idx) => {
      const iso = addMonthsToISO(baseCharge, idx) || baseCharge;
      return {
        idx,
        label: `${idx + 1}/${parts.length}`,
        dateISO: iso,
        dateLabel: formatDateBRShort(iso),
        value: val,
        valueLabel: formatBRL(val),
      };
    });
  }, [amount, kind, nParts, chargeDate]);


  function reset() {
    const t = todayISO();
    setPurchaseDate(t);
    setChargeDate(t);
    setChargeTouched(false);

    setAccountId("");
    setMerchant("");
    setDescription("");
    setCategoryId("outros");

    setAmount("0");

    setStatus("planned");
    statusTouchedRef.current = false;

    setKind("one_off");
    setNParts(2);
    setDirection("expense");

    setErr("");
    setSaving(false);

    const y = new Date().getFullYear();
    setRecurringUntilYm(`${y}-12`);

  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  function validate() {
    const v = parseBrlToNumber(amount);
    const loja = (merchant || "").trim();
    const desc = (description || "").trim();

    if (!purchaseDate) return "Selecione a data da compra.";
    if (!chargeDate) return "Selecione a data de cobrança.";
    if (!loja) return "Preencha a Loja.";
    if (!desc) return "Preencha a Descrição.";
    if (!Number.isFinite(v) || v <= 0) return "Informe um valor válido.";

    if ((status === "confirmed" || status === "paid") && !accountId) {
      return "Para Confirmado/Pago, selecione uma Conta/Cartão (ou use Previsto).";
    }

    if (kind === "installment") {
      const n = Number(nParts);
      if (!Number.isFinite(n) || n < 2) return "Parcelado precisa ter no mínimo 2 parcelas.";
    }

    return "";
  }

  function buildBaseTxn() {
    const loja = (merchant || "").trim();
    const desc = (description || "").trim();

    const vNum = parseBrlToNumber(amount);
    const amountStr = formatNumberToBrlInput(Math.abs(vNum)); // sempre positivo

    return {
      client_id: genClientId(),
      purchaseDate,
      chargeDate,
      invoiceMonth, // thunk converte pra invoice_month = YYYY-MM-01
      accountId: accountId || null,
      merchant: loja,
      description: desc,
      categoryId,
      amount: amountStr, // string BRL
      status,
      direction,
      kind,
      currency: "BRL",
      notes: "",
    };
  }

  async function handleSave() {
    setErr("");
    const e = validate();
    if (e) {
      setErr(e);
      return;
    }

    setSaving(true);
    try {
      const base = buildBaseTxn();

      // AVULSO
      if (kind === "one_off") {
        await dispatch(
          createTransactionThunk({
            ...base,
            kind: "one_off",
            installmentGroupId: null,
            installmentCurrent: null,
            installmentTotal: null,
            recurringRule: null,
          })
        ).unwrap();

        handleClose();
        return;
      }

      // ✅ PARCELADO (garantido, com return)
      if (kind === "installment") {
        const n = Math.max(2, Number(nParts));
        const vNum = parseBrlToNumber(base.amount);
        const parts = splitInstallments(vNum, n);

        const groupId = `inst_${Math.random().toString(16).slice(2, 9)}`;

        const acc = selectedAccount; // pode ser null
        const cutoffDay = acc?.statement?.cutoffDay;
        const dueDay = acc?.statement?.dueDay ?? 10;

        // dia desejado (mantém o dia original, mas clampa pro mês)
        const basePurchaseDay = Number(String(base.purchaseDate || "").slice(8, 10)) || 1;
        const baseChargeDay = Number(String(base.chargeDate || "").slice(8, 10)) || 1;

        function addMonthsToISO(iso, idx, wantedDay) {
          const s = String(iso || "");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
          const y = Number(s.slice(0, 4));
          const m = Number(s.slice(5, 7));
          if (!Number.isFinite(y) || !Number.isFinite(m)) return "";

          const d0 = new Date(y, m - 1, 1);
          d0.setMonth(d0.getMonth() + idx);

          const yy = d0.getFullYear();
          const mm = d0.getMonth(); // 0-11
          const safeDay = clampDayToMonth(yy, mm, wantedDay);
          const m2 = String(mm + 1).padStart(2, "0");
          const d2 = String(safeDay).padStart(2, "0");
          return `${yy}-${m2}-${d2}`;
        }

        const creates = parts.map((partValue, idx) => {
          // para cada parcela: gera uma "compra" mensal (purchaseDate)
          const purchaseDateStr = addMonthsToISO(base.purchaseDate, idx, basePurchaseDay) || base.purchaseDate;

          let chargeDateStr = "";
          let invoiceYm = "";

          if (acc?.type === "credit_card") {
            // cartão: invoiceMonth vem do purchaseDate + cutoff
            invoiceYm = computeInvoiceMonthFromPurchase(purchaseDateStr, cutoffDay);
            // cartão: chargeDate segue vencimento do mês de fatura
            chargeDateStr = makeChargeDateFromYM(invoiceYm, dueDay) || base.chargeDate;
          } else {
            // conta corrente: chargeDate acompanha mês a mês (mesmo “dia da cobrança”)
            chargeDateStr = addMonthsToISO(base.chargeDate, idx, baseChargeDay) || base.chargeDate;
            invoiceYm = ymFromISODate(chargeDateStr);
          }

          return dispatch(
            createTransactionThunk({
              ...base,
              client_id: genClientId(),

              kind: "installment",
              installmentGroupId: groupId,
              installmentCurrent: idx + 1,
              installmentTotal: n,

              purchaseDate: purchaseDateStr,
              chargeDate: chargeDateStr,
              invoiceMonth: invoiceYm,

              amount: formatNumberToBrlInput(partValue),

              // 1ª parcela mantém status escolhido, futuras planned
              status: idx === 0 ? base.status : "planned",
            })
          ).unwrap();
        });

        await Promise.all(creates);
        handleClose();
        return;
      }


      // MENSAL
      // MENSAL (materializa 1 por mês, igual Bills)
      if (kind === "recurring") {
        const startYm = ymFromISODate(base.chargeDate);
        const endYm = String(recurringUntilYm || "").trim();

        if (!startYm) {
          setErr("Data de cobrança inválida para recorrência.");
          setSaving(false);
          return;
        }
        if (!/^\d{4}-\d{2}$/.test(endYm)) {
          setErr("Selecione um mês final válido (YYYY-MM).");
          setSaving(false);
          return;
        }
        if (ymCompare(endYm, startYm) < 0) {
          setErr("O mês final não pode ser anterior ao mês da cobrança.");
          setSaving(false);
          return;
        }

        const acc = selectedAccount; // pode ser null
        const dayWanted = Number(String(base.chargeDate).slice(8, 10)) || 1;

        // conta quantos meses vamos gerar (inclusive)
        let months = 0;
        {
          const [sy, sm] = startYm.split("-").map(Number);
          const [ey, em] = endYm.split("-").map(Number);
          months = (ey * 12 + (em - 1)) - (sy * 12 + (sm - 1)) + 1;
          months = Math.max(1, Math.min(240, months)); // trava hard (20 anos)
        }

        const creates = Array.from({ length: months }).map((_, idx) => {
          const ym = addMonthsYM(startYm, idx);
          const [yy, mm] = ym.split("-").map(Number);
          const safeDay = clampDayToMonth(yy, mm - 1, dayWanted);
          const chargeDateStr = `${yy}-${String(mm).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;

          // ✅ regra do invoiceMonth por tipo de conta:
          // - cartão: usa purchaseDate + cutoff (igual seu memo)
          // - outros: usa o mês da cobrança
          let nextInvoiceMonth = ym;
          if (acc?.type === "credit_card") {
            const cutoffDay = acc?.statement?.cutoffDay;
            // compra mensal geralmente acompanha a cobrança (você pode mudar depois)
            const purchaseLike = chargeDateStr;
            nextInvoiceMonth = computeInvoiceMonthFromPurchase(purchaseLike, cutoffDay);
          }

          return dispatch(
            createTransactionThunk({
              ...base,
              client_id: genClientId(),
              kind: "recurring",
              recurringRule: "monthly",
              chargeDate: chargeDateStr,
              // para “salário”, normalmente compra = cobrança
              purchaseDate: acc?.type === "credit_card" ? base.purchaseDate : chargeDateStr,
              invoiceMonth: nextInvoiceMonth,
              // status: primeiro mantém, futuros ficam planned
              status: idx === 0 ? base.status : "planned",
            })
          ).unwrap();
        });

        await Promise.all(creates);
        handleClose();
        return;
      }


      // PARCELADO
      const n = Math.max(2, Number(nParts));
      const vNum = parseBrlToNumber(base.amount);
      const parts = splitInstallments(vNum, n);

      const groupId = `inst_${Math.random().toString(16).slice(2, 9)}`;

      const baseDate = new Date(base.chargeDate);
      baseDate.setDate(1);

      const creates = parts.map((partValue, idx) => {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + idx);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const ym = `${y}-${m}`;
        const dStr = `${y}-${m}-01`;

        return dispatch(
          createTransactionThunk({
            ...base,
            client_id: genClientId(),
            chargeDate: dStr,
            invoiceMonth: ym,
            kind: "installment",
            installmentGroupId: groupId,
            installmentCurrent: idx + 1,
            installmentTotal: n,
            amount: formatNumberToBrlInput(partValue),
            status: idx === 0 ? base.status : "planned",
          })
        ).unwrap();
      });

      await Promise.all(creates);
      handleClose();
    } catch (ex) {
      const msg =
        ex?.detail ||
        (typeof ex === "string" ? ex : "") ||
        apiError ||
        "Erro ao salvar. Verifique os campos e tente novamente.";
      setErr(msg);
      setSaving(false);
    }
  }

  // ✅ sugestões
  const merchantOptions = useMemo(() => {
    const q = String(merchant || "").trim();
    if (q.length < MIN_MERCHANT_CHARS) return [];
    const list = historyIndex?.getMerchantSuggestions?.(q, 12) || [];
    return list.map((x) => x.label);
  }, [historyIndex, merchant]);


  const descriptionOptions = useMemo(() => {
    const m = String(merchant || "").trim();
    const q = String(description || "").trim();
    if (!m) return [];
    if (q.length < MIN_DESC_CHARS) return [];
    const list = historyIndex?.getDescriptionSuggestions?.(m, q, 12) || [];
    return list.map((x) => x.label);
  }, [historyIndex, merchant, description]);

  // ======= (seu styling original mantido) =======
  const isExpense = direction === "expense";

  const borderColor = isExpense ? "rgba(211,47,47,0.45)" : "rgba(46,125,50,0.45)";
  // const tintBg = isExpense
  //   ? "rgba(211,47,47,0.45)"
  //   : "rgba(46,125,50,0.45)";

  // const gradientAccent = isExpense
  //   ? "rgba(211,47,47,0.55)"
  //   : "rgba(46,125,50,0.55)";



  const headerToggleSx = {
    borderRadius: 999,
    overflow: "hidden",
    border: `1px solid ${borderColor}`,
    bgcolor: "rgba(255,255,255,0.55)",
    "& .MuiToggleButton-root": {
      px: 1.5,
      py: 0.6,
      fontWeight: 900,
      border: "none",
      textTransform: "none",
    },
    "& .MuiToggleButton-root.Mui-selected": {
      bgcolor: direction === "expense" ? "rgba(211,47,47,0.14)" : "rgba(46,125,50,0.14)",
    },
  };

  const inputSx = {
    "& .MuiInputLabel-root": {
      color: "rgba(15,23,42,0.78)", // slate-900 suave
      fontWeight: 800,
    },
    "& .MuiInputLabel-root.Mui-focused": {
      color: isExpense ? "rgba(211,47,47,0.95)" : "rgba(46,125,50,0.95)",
    },
    "& .MuiInputBase-input": { color: "#0f172a" },

    "& .MuiOutlinedInput-root": {
      backgroundColor: "#fff",        // sólido (sem transparência)
      borderRadius: 10,
    },

    "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(2,6,23,0.18)" },
    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: isExpense ? "rgba(211,47,47,0.55)" : "rgba(46,125,50,0.55)",
    },
    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: isExpense ? "rgba(211,47,47,0.85)" : "rgba(46,125,50,0.85)",
      borderWidth: 1,
    },

    "& .MuiFormHelperText-root": { color: "rgba(15,23,42,0.62)" },
  };


  const inputBg = isExpense
    ? "rgba(211,47,47,0.10)"
    : "rgba(46,125,50,0.10)";

  const inputBgHover = isExpense
    ? "rgba(211,47,47,0.18)"
    : "rgba(46,125,50,0.18)";

  const inputBgFocus = isExpense
    ? "rgba(211,47,47,0.25)"
    : "rgba(46,125,50,0.25)";


  const inputBorder = "rgba(0,0,0,0.14)";
  const inputBorderHover = isExpense ? "rgba(211,47,47,0.35)" : "rgba(46,125,50,0.35)";
  const inputBorderFocus = isExpense ? "rgba(211,47,47,0.55)" : "rgba(46,125,50,0.55)";

  const inputRing = isExpense ? "rgba(211,47,47,0.16)" : "rgba(46,125,50,0.16)";


  const gradientAccent = isExpense ? "#f04444" : "#22c55e"; // topo
  const tintBg = isExpense ? "#ffd5d5" : "#d7ffe7";         // faixa suave

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: "rgba(2,6,23,0.72)", // escurece fundo
            backdropFilter: "blur(10px)",          // blur premium
          },
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: 2,
          border: `1.5px solid ${borderColor}`,
          background: `
            linear-gradient(
              -180deg,
              ${gradientAccent} 0%,
              ${tintBg} 60px,
              rgba(255,255,255,1) 85%
            )
          `,
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          transition: "all 0.2s ease",
          "&:hover": {
            boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
            borderColor: isExpense ? "rgba(211,47,47,0.95)" : "rgba(46,125,50,0.95)",
          },
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 950, py: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
          <Typography sx={{ fontWeight: 950, color: "whitesmoke" }}>Novo lançamento</Typography>

          <ToggleButtonGroup
            exclusive
            value={direction}
            onChange={(_, v) => {
              if (!v) return;
              setDirection(v);
            }}
            size="small"
            sx={headerToggleSx}
          >
            <ToggleButton value="expense">Despesa</ToggleButton>
            <ToggleButton value="income">Receita</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </DialogTitle>

      <DialogContent
        sx={{
          pt: 1.5,
          "& .MuiTextField-root .MuiOutlinedInput-root": {
            borderRadius: 10,
            backgroundColor: "#fff",
            transition: "box-shadow .15s ease, border-color .15s ease",

            "&.Mui-focused": {
              boxShadow: `0 0 0 4px ${isExpense ? "rgba(211,47,47,0.18)" : "rgba(46,125,50,0.18)"}`,
            },
          },
          "& .MuiInputBase-input::placeholder": { opacity: 0.85 },
          "& .MuiFormHelperText-root": { marginLeft: 0, marginRight: 0, opacity: 0.85 },
          "& .MuiSelect-select": { paddingTop: "12.5px", paddingBottom: "12.5px" },
        }}
      >
        <Stack spacing={1.4}>
          {err ? <Alert severity="error">{err}</Alert> : null}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ paddingTop: "10px" }}>
            <TextField
              label="Data compra"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              sx={inputSx}
            />

            <TextField
              label="Data cobrança"
              type="date"
              value={chargeDate}
              onChange={(e) => {
                setChargeDate(e.target.value);
                setChargeTouched(true);
              }}
              InputLabelProps={{ shrink: true }}
              fullWidth
              sx={inputSx}
              helperText={
                selectedAccount?.type === "credit_card"
                  ? "Auto pelo vencimento do cartão (você pode editar)."
                  : "Para conta corrente, padrão = data da compra."
              }
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
            <TextField
              sx={inputSx}
              label="Conta / Cartão"
              select
              value={accountId}
              onChange={(e) => {
                const next = e.target.value;
                setAccountId(next);

                // ao trocar a conta, volta a auto-calcular
                setChargeTouched(false);

                // ✅ status automático (💳 => confirmed, 🏦 => paid)
                statusTouchedRef.current = false;
                applyAutoStatusByAccount(next);
              }}
              fullWidth
            >
              <MenuItem value="">(Sem conta) — Provisionar</MenuItem>
              <Divider />
              {accounts
                .filter(safeAccountActive)
                .map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.type === "credit_card" ? `💳 ${a.name}` : `🏦 ${a.name}`}
                  </MenuItem>
                ))}
            </TextField>

            <TextField
              sx={inputSx}
              label="Status"
              select
              value={status}
              onChange={(e) => {
                statusTouchedRef.current = true;
                setStatus(e.target.value);
              }}
              fullWidth
            >
              <MenuItem value="planned">Previsto</MenuItem>
              <MenuItem value="confirmed">Confirmado</MenuItem>
              <MenuItem value="paid">Pago</MenuItem>
              <MenuItem value="overdue">Atrasado</MenuItem>
            </TextField>
          </Stack>

          {/* ✅ Loja com sugestões (histórico) */}
          <Autocomplete
            freeSolo
            options={merchantOptions}
            openOnFocus={false}
            filterOptions={(x) => x} // evita filtro duplicado (já filtramos no index)
            value={merchant}
            onChange={(e, val) => setMerchant(val || "")}
            inputValue={merchant}
            onInputChange={(e, val) => setMerchant(val || "")}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Loja *"
                fullWidth
                helperText={
                  String(merchant || "").trim().length < MIN_MERCHANT_CHARS
                    ? `Digite pelo menos ${MIN_MERCHANT_CHARS} caracteres`
                    : "Sugestões do histórico"
                }
              />
            )}
          />


          {/* ✅ Descrição com sugestões por loja */}
          <Autocomplete
            freeSolo
            options={descriptionOptions}
            value={description}
            onChange={(e, val) => setDescription(val || "")}
            inputValue={description}
            onInputChange={(e, val) => setDescription(val || "")}
            renderInput={(params) => (
              <TextField
                {...params}
                sx={inputSx}
                label="Descrição *"
                placeholder="Ex: Mercado semana, assinatura..."
                fullWidth
                helperText={merchant ? "Sugestões baseadas nessa loja" : "Selecione uma loja para sugestões"}
              />
            )}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
            <TextField
              sx={inputSx}
              label="Categoria"
              select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              fullWidth
              helperText={suggestedCategoryForMerchant ? `Sugestão da loja: ${suggestedCategoryForMerchant}` : "—"}
            >
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.slug}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              sx={inputSx}
              label="Valor (R$)"
              value={amount}
              onChange={(e) => setAmount(sanitizeBrlInput(e.target.value))}
              onBlur={() => {
                const v = parseBrlToNumber(amount);
                if (Number.isFinite(v)) setAmount(formatNumberToBrlInput(Math.abs(v)));
              }}
              inputMode="decimal"
              fullWidth
            />
          </Stack>

          <Divider />

          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label="Avulso"
              color={kind === "one_off" ? "primary" : "default"}
              variant={kind === "one_off" ? "filled" : "outlined"}
              onClick={() => setKind("one_off")}
              sx={{ fontWeight: 900 }}
            />
            <Chip
              label="Mensal"
              color={kind === "recurring" ? "primary" : "default"}
              variant={kind === "recurring" ? "filled" : "outlined"}
              onClick={() => setKind("recurring")}
              sx={{ fontWeight: 900 }}
            />
            <Chip
              label="Parcelado"
              color={kind === "installment" ? "primary" : "default"}
              variant={kind === "installment" ? "filled" : "outlined"}
              onClick={() => setKind("installment")}
              sx={{ fontWeight: 900 }}
            />
          </Stack>
          {kind === "recurring" ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ mt: 0.5 }}>
              <TextField
                sx={inputSx}
                label="Repetir até"
                type="month"
                value={recurringUntilYm}
                onChange={(e) => setRecurringUntilYm(e.target.value)}
                fullWidth
                helperText="Será criado 1 lançamento por mês, do mês da cobrança até esse mês (inclusive)."
              />
            </Stack>
          ) : null}

          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Mês de fatura: <b>{formatMonthBR(invoiceMonth) || "—"}</b>{" "}
            {selectedAccount?.type === "credit_card" ? (
              <span style={{ opacity: 0.8 }}>
                (cutoff dia {selectedAccount?.statement?.cutoffDay || "—"} • venc. dia{" "}
                {selectedAccount?.statement?.dueDay || "—"})
              </span>
            ) : null}
          </Typography>

          {kind === "installment" ? (
            <Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems={{ sm: "center" }}>
                <TextField
                  label="Nº parcelas"
                  type="number"
                  value={nParts}
                  onChange={(e) => setNParts(e.target.value)}
                  inputProps={{ min: 2, max: 36 }}
                  sx={{ width: { xs: "100%", sm: 180 } }}
                />
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Centavos distribuídos nas primeiras parcelas.
                </Typography>
              </Stack>

              {previewInstallments.length ? (
                <Stack spacing={0.8} sx={{ mt: 1.2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>
                    Preview das parcelas
                  </Typography>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",        // mobile: 1 coluna
                        sm: "1fr 1fr",    // >= sm: 2 colunas
                      },
                      gap: 0.8,
                    }}
                  >
                    {previewInstallments.map((p) => (
                      <Box
                        key={p.idx}
                        sx={{
                          border: "1px solid rgba(2,6,23,0.12)",
                          borderRadius: 1.5,
                          px: 1.2,
                          py: 0.9,
                          background: "rgba(255,255,255,0.9)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        {/* ESQUERDA: data */}
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary", fontWeight: 600 }}
                        >
                          {p.dateLabel}
                        </Typography>

                        {/* CENTRO: parcela */}
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 900,
                            px: 0.8,
                            py: 0.2,
                            borderRadius: 1,
                            backgroundColor: "rgba(2,6,23,0.06)",
                          }}
                        >
                          {p.label}
                        </Typography>

                        {/* DIREITA: valor */}
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 950 }}
                        >
                          {p.valueLabel}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Stack>
              ) : null}


            </Box>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ pb: 2, pr: 2, gap: 1, marginTop: "-20px" }}>
        <Button onClick={handleClose} variant="outlined" disabled={saving}>
          Cancelar
        </Button>

        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          sx={{ fontWeight: 950, borderRadius: 2, minWidth: 140 }}
        >
          {saving ? <CircularProgress size={18} /> : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
