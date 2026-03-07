// src/components/NewTransactionModal.jsx
import React, { useMemo, useState, useEffect, useRef, useDeferredValue } from "react";
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
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { useDispatch, useSelector } from "react-redux";

import { splitInstallments } from "../utils/splitInstallments";
import { formatBRL } from "../utils/money";
import { computeInvoiceMonthFromPurchase, ymFromDate } from "../utils/BillingDates.js";
import { formatMonthBR } from "../utils/dateBR";

import { createTransactionThunk, selectTransactionsUi } from "../store/transactionsSlice";
import { selectCategories } from "../store/categoriesSlice";

import buildTxnHistoryIndex from "./transactions/buildTxnHistoryIndex";
import CategoryOption from "./categories/CategoryOption.jsx";

import toast from "react-hot-toast";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";

// ---------- helpers ----------
function clampDayToMonth(year, monthIndex0, day) {
  const d = Math.max(1, Math.min(31, Number(day || 1)));
  const last = new Date(year, monthIndex0 + 1, 0).getDate();
  return Math.min(d, last);
}

function addMonthsToISO(iso, idx, wantedDay) {
  const s = String(iso || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return "";

  const d0 = new Date(y, m - 1, 1);
  d0.setMonth(d0.getMonth() + Number(idx || 0));

  const yy = d0.getFullYear();
  const mm0 = d0.getMonth(); // 0-11
  const safeDay = clampDayToMonth(yy, mm0, wantedDay);

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
// ✅ Modal (Mobile Optimized)
// -----------------------------------------------
export default function NewTransactionModal({ open, onClose }) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down("sm"));

  // ✅ min chars menor no mobile, pra reduzir digitação
  const MIN_MERCHANT_CHARS = isSmDown ? 1 : 2;
  const MIN_DESC_CHARS = 0;

  const accounts = useSelector((s) => s.accounts?.accounts || []);
  const apiError = useSelector((s) => s.transactions?.error || "");
  const rowsFromStore = useSelector(selectTransactionsUi);
  const categories = useSelector(selectCategories) || [];

  // ✅ history rows só como array estável
  const historyRows = useMemo(
    () => (Array.isArray(rowsFromStore) ? rowsFromStore : []),
    [rowsFromStore]
  );

  // ✅ Só monta index quando usuário realmente precisa (focus)
  const [historyEnabled, setHistoryEnabled] = useState(false);

  const historyIndex = useMemo(() => {
    if (!open) return null;
    if (!historyEnabled) return null;
    // se não tem nada, nem monta
    if (!historyRows?.length) return null;
    return buildTxnHistoryIndex(historyRows);
  }, [open, historyEnabled, historyRows]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const contentRef = useRef(null);

  function scrollToTopOfModal() {
    const el = contentRef.current;
    if (!el) return;
    try {
      el.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      el.scrollTop = 0;
    }
  }

  function failWithFeedback(message) {
    const msg = String(message || "Verifique os campos e tente novamente.");
    setErr(msg);
    scrollToTopOfModal();
    toast.error(msg);
    return msg;
  }

  const savingLabel = useMemo(() => {
    if (kind === "installment") return `Criando parcelamento (${Math.max(2, Number(nParts || 2))}x)...`;
    if (kind === "recurring") return "Criando recorrência...";
    return "Salvando...";
  }, [kind, nParts]);

  // defaults
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [chargeDate, setChargeDate] = useState(todayISO());
  const [chargeTouched, setChargeTouched] = useState(false);

  const [accountId, setAccountId] = useState("");

  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");

  // ✅ usar slug (consistente com grid)
  const [categoryId, setCategoryId] = useState("outros");

  // ✅ string BRL
  const [amount, setAmount] = useState("0");

  const [status, setStatus] = useState("planned"); // planned | confirmed | paid | overdue
  const statusTouchedRef = useRef(false);

  const [kind, setKind] = useState("one_off"); // one_off | recurring | installment
  const [nParts, setNParts] = useState(2);

  const [direction, setDirection] = useState("expense");

  const [recurringUntilYm, setRecurringUntilYm] = useState(() => {
    const t = new Date();
    const y = t.getFullYear();
    return `${y}-12`;
  });

  // ✅ preview parcels colapsado (mobile-friendly)
  const [showInstallmentsPreview, setShowInstallmentsPreview] = useState(false);

  // ✅ deferred values (reduz “engasgo” do autocomplete)
  const merchantDeferred = useDeferredValue(merchant);
  const descriptionDeferred = useDeferredValue(description);

  const selectedAccount = useMemo(() => {
    if (!accountId) return null;
    return accounts.find((a) => a.id === accountId) || null;
  }, [accounts, accountId]);

  const invoiceMonth = useMemo(() => {
    if (selectedAccount?.type === "credit_card") {
      const cutoffDay = selectedAccount?.statement?.cutoffDay;
      return computeInvoiceMonthFromPurchase(purchaseDate, cutoffDay);
    }
    return ymFromDate(chargeDate);
  }, [purchaseDate, chargeDate, selectedAccount]);

  function applyAutoStatusByAccount(nextAccountId) {
    if (statusTouchedRef.current) return;

    const acc = nextAccountId ? accounts.find((a) => a.id === nextAccountId) : null;
    if (!acc) return;

    if (acc.type === "credit_card") setStatus("confirmed");
    else setStatus("paid");
  }

  // ✅ sugestão categoria por merchant (somente se index habilitado)
  const suggestedCategoryForMerchant = useMemo(() => {
    if (!historyIndex) return "";
    return historyIndex?.getBestCategoryForMerchant?.(merchantDeferred) || "";
  }, [historyIndex, merchantDeferred]);

  useEffect(() => {
    if (!open) return;
    if (!merchantDeferred) return;
    if (!suggestedCategoryForMerchant) return;
    if (!categoryId || categoryId === "outros") setCategoryId(suggestedCategoryForMerchant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, merchantDeferred, suggestedCategoryForMerchant]);

  // auto-ajuste chargeDate quando trocar conta / purchaseDate (se usuário não editou)
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

  const categoriesBySlug = useMemo(() => {
    const map = new Map();
    (categories || []).forEach((c) => {
      const key = String(c?.slug ?? c?.id ?? "");
      if (key) map.set(key, c);
    });
    return map;
  }, [categories]);

  const selectedCategory = useMemo(() => {
    return categoriesBySlug.get(String(categoryId || "")) || null;
  }, [categoriesBySlug, categoryId]);

  // ✅ sugestões: só calcula se historyIndex estiver habilitado
  const merchantOptions = useMemo(() => {
    if (!historyIndex) return [];
    const q = String(merchantDeferred || "").trim();
    if (q.length < MIN_MERCHANT_CHARS) return [];
    const list = historyIndex?.getMerchantSuggestions?.(q, isSmDown ? 8 : 12) || [];
    return list.map((x) => x.label);
  }, [historyIndex, merchantDeferred, MIN_MERCHANT_CHARS, isSmDown]);

  const descriptionOptions = useMemo(() => {
    if (!historyIndex) return [];
    const m = String(merchantDeferred || "").trim();
    const q = String(descriptionDeferred || "").trim();
    if (!m) return [];
    if (q.length < MIN_DESC_CHARS) return [];
    const list = historyIndex?.getDescriptionSuggestions?.(m, q, isSmDown ? 8 : 12) || [];
    return list.map((x) => x.label);
  }, [historyIndex, merchantDeferred, descriptionDeferred, MIN_DESC_CHARS, isSmDown]);

  // ✅ preview das parcelas: só calcula quando showInstallmentsPreview estiver true
  const previewInstallments = useMemo(() => {
    if (kind !== "installment") return [];
    if (!showInstallmentsPreview) return [];
    const n = Math.max(1, Number(nParts || 1));
    const v = parseBrlToNumber(amount);
    if (!Number.isFinite(v) || v <= 0 || n <= 1) return [];

    const parts = splitInstallments(v, n);
    const baseCharge = chargeDate || todayISO();
    const baseChargeDay = Number(String(baseCharge || "").slice(8, 10)) || 1;

    return parts.map((val, idx) => {
      const iso = addMonthsToISO(baseCharge, idx, baseChargeDay) || baseCharge;
      return {
        idx,
        label: `${idx + 1}/${parts.length}`,
        dateISO: iso,
        dateLabel: formatDateBRShort(iso),
        value: val,
        valueLabel: formatBRL(val),
      };
    });
  }, [amount, kind, nParts, chargeDate, showInstallmentsPreview]);

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

    // ✅ mobile perf
    setHistoryEnabled(false);
    setShowInstallmentsPreview(false);
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
    const amountStr = formatNumberToBrlInput(Math.abs(vNum));

    return {
      client_id: genClientId(),
      purchaseDate,
      chargeDate,
      invoiceMonth,
      accountId: accountId || null,
      merchant: loja,
      description: desc,
      categoryId,
      amount: amountStr,
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
      failWithFeedback(e);
      return;
    }

    setSaving(true);

    try {
      const base = buildBaseTxn();

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

        toast.success("Lançamento criado com sucesso!");
        handleClose();
        return;
      }

      if (kind === "installment") {
        const n = Math.max(2, Number(nParts));
        const vNum = parseBrlToNumber(base.amount);
        const parts = splitInstallments(vNum, n);

        const groupId = `inst_${Math.random().toString(16).slice(2, 9)}`;

        const acc = selectedAccount;
        const dueDay = acc?.statement?.dueDay ?? 10;

        const purchaseDateFixed = base.purchaseDate;
        const baseCharge = base.chargeDate || todayISO();

        const baseChargeDay = Number(String(baseCharge || "").slice(8, 10)) || 1;
        const wantedChargeDay = acc?.type === "credit_card" ? dueDay : baseChargeDay;

        const creates = parts.map((partValue, idx) => {
          const purchaseDateStr = purchaseDateFixed;
          const chargeDateStr = addMonthsToISO(baseCharge, idx, wantedChargeDay) || baseCharge;
          const invoiceYm = ymFromISODate(chargeDateStr);

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
              status: idx === 0 ? base.status : "planned",
            })
          ).unwrap();
        });

        await Promise.all(creates);

        toast.success(`Parcelamento criado (${n}x) com sucesso!`);
        handleClose();
        return;
      }

      if (kind === "recurring") {
        const startYm = ymFromISODate(base.chargeDate);
        const endYm = String(recurringUntilYm || "").trim();

        if (!startYm) {
          setSaving(false);
          failWithFeedback("Data de cobrança inválida para recorrência.");
          return;
        }

        if (!/^\d{4}-\d{2}$/.test(endYm)) {
          setSaving(false);
          failWithFeedback("Selecione um mês final válido (YYYY-MM).");
          return;
        }

        if (ymCompare(endYm, startYm) < 0) {
          setSaving(false);
          failWithFeedback("O mês final não pode ser anterior ao mês da cobrança.");
          return;
        }

        const acc = selectedAccount;
        const dayWanted = Number(String(base.chargeDate).slice(8, 10)) || 1;

        let months = 0;
        {
          const [sy, sm] = startYm.split("-").map(Number);
          const [ey, em] = endYm.split("-").map(Number);
          months = ey * 12 + (em - 1) - (sy * 12 + (sm - 1)) + 1;
          months = Math.max(1, Math.min(240, months));
        }

        const creates = Array.from({ length: months }).map((_, idx) => {
          const ym = addMonthsYM(startYm, idx);
          const [yy, mm] = ym.split("-").map(Number);
          const safeDay = clampDayToMonth(yy, mm - 1, dayWanted);
          const chargeDateStr = `${yy}-${String(mm).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;

          return dispatch(
            createTransactionThunk({
              ...base,
              client_id: genClientId(),
              kind: "recurring",
              recurringRule: "monthly",
              chargeDate: chargeDateStr,
              purchaseDate: acc?.type === "credit_card" ? base.purchaseDate : chargeDateStr,
              invoiceMonth: ym,
              status: idx === 0 ? base.status : "planned",
            })
          ).unwrap();
        });

        await Promise.all(creates);

        toast.success(`Recorrência criada (${months} mês${months > 1 ? "es" : ""})!`);
        handleClose();
        return;
      }

      toast.success("Salvo!");
      handleClose();
    } catch (ex) {
      const msg =
        ex?.detail ||
        (typeof ex === "string" ? ex : "") ||
        apiError ||
        "Erro ao salvar. Verifique os campos e tente novamente.";

      setSaving(false);
      failWithFeedback(msg);
    }
  }

  // ======= estilo / cores (seu padrão) =======
  const isExpense = direction === "expense";
  const borderColor = isExpense ? "rgba(211,47,47,0.45)" : "rgba(46,125,50,0.45)";
  const gradientAccent = isExpense ? "#f04444" : "#22c55e";
  const tintBg = isExpense ? "#ffd5d5" : "#d7ffe7";

  const headerToggleSx = {
    borderRadius: 999,
    overflow: "hidden",
    border: `1px solid ${borderColor}`,
    bgcolor: "rgba(255,255,255,0.55)",
    "& .MuiToggleButton-root": {
      px: 1.25,
      py: 0.55,
      fontWeight: 900,
      border: "none",
      textTransform: "none",
    },
    "& .MuiToggleButton-root.Mui-selected": {
      bgcolor: direction === "expense" ? "rgba(211,47,47,0.14)" : "rgba(46,125,50,0.14)",
    },
  };

  const inputSx = {
    "& .MuiInputLabel-root": { color: "rgba(15,23,42,0.78)", fontWeight: 800 },
    "& .MuiInputLabel-root.Mui-focused": {
      color: isExpense ? "rgba(211,47,47,0.95)" : "rgba(46,125,50,0.95)",
    },

    "& .MuiInputBase-input": {
      color: "#0f172a",
      fontSize: isSmDown ? 16 : 15, // ✅ evita zoom no iPhone
      WebkitTextSizeAdjust: "100%",
    },

    "& .MuiOutlinedInput-root": {
      backgroundColor: "#fff",
      borderRadius: 10,
    },

    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(2,6,23,0.18)",
    },

    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: isExpense ? "rgba(211,47,47,0.55)" : "rgba(46,125,50,0.55)",
    },

    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: isExpense ? "rgba(211,47,47,0.85)" : "rgba(46,125,50,0.85)",
      borderWidth: 1,
    },

    "& .MuiFormHelperText-root": {
      color: "rgba(15,23,42,0.62)",
    },
  };
  // ✅ em mobile: deixa actions “grudado” com mais área útil
  const actionsSx = isSmDown
    ? {
      position: "sticky",
      bottom: 0,
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(10px)",
      borderTop: `1px solid ${alpha(theme.palette.divider, 0.75)}`,
      px: 2,
      py: 1.2,

      // ✅ espaço extra para iPhone / home indicator
      pb: "calc(16px + env(safe-area-inset-bottom))",

      zIndex: 10,
    }
    : { pb: 2, pr: 2, gap: 1, marginTop: "-20px" };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      fullScreen={isSmDown}
      scroll="body"
      disableScrollLock={false}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: "rgba(20,20,20,0.40)",
            backdropFilter: "blur(2px)",
          },
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: isSmDown ? 0 : 2,
          border: isSmDown ? "none" : `1.5px solid ${borderColor}`,
          height: isSmDown ? "100dvh" : "auto",
          background: `
        linear-gradient(
          -180deg,
          ${gradientAccent} 0%,
          ${tintBg} 60px,
          rgba(255,255,255,1) 85%
        )
      `,
          boxShadow: isSmDown ? "none" : "0 2px 10px rgba(0,0,0,0.3)",
          overflow: "hidden",
          maxHeight: isSmDown ? "100dvh" : undefined,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 950, py: isSmDown ? 1.2 : 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.2}>
          <Typography sx={{ fontWeight: 950, color: "whitesmoke" }}>Novo lançamento</Typography>

          <ToggleButtonGroup
            exclusive
            value={direction}
            onChange={(_, v) => v && !saving && setDirection(v)}
            size="small"
            disabled={saving}
            sx={headerToggleSx}
          >
            <ToggleButton value="expense">Despesa</ToggleButton>
            <ToggleButton value="income">Receita</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </DialogTitle>

      <DialogContent
        ref={contentRef}
        sx={{
          pt: 1.4,
          pb: 1.6,
          overflow: "visible",
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
        <Stack spacing={3.25}>
          {err ? <Alert severity="error">{err}</Alert> : null}

          <Stack
            direction="row"
            spacing={1.1}
            sx={{
              pt: 2.5,
              flexWrap: "nowrap",
              "& > *": { minWidth: 0 }, // evita overflow por width mínima do input
            }}
          >
            <TextField
              label="Data compra"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ ...inputSx, flex: 1 }}
              disabled={saving}
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
              sx={{ ...inputSx, flex: 1 }}
              disabled={saving}
            // helperText={
            //   selectedAccount?.type === "credit_card"
            //     ? "Auto pelo vencimento do cartão (você pode editar)."
            //     : "Para conta corrente, padrão = data da compra."
            // }
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={3.1}>
            <TextField
              sx={inputSx}
              label="Conta / Cartão"
              select
              value={accountId}
              onChange={(e) => {
                const next = e.target.value;
                setAccountId(next);
                setChargeTouched(false);
                statusTouchedRef.current = false;
                applyAutoStatusByAccount(next);
              }}
              fullWidth
              disabled={saving}
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
              disabled={saving}
            >
              <MenuItem value="planned">Previsto</MenuItem>
              <MenuItem value="confirmed">Confirmado</MenuItem>
              <MenuItem value="paid">Pago</MenuItem>
              <MenuItem value="overdue">Atrasado</MenuItem>
            </TextField>
          </Stack>

          {/* ✅ Loja (habilita histórico no focus) */}
          <Autocomplete
            freeSolo
            options={merchantOptions}
            openOnFocus={false}
            filterOptions={(x) => x}
            value={merchant}
            onFocus={() => setHistoryEnabled(true)}
            onChange={(e, val) => setMerchant(val || "")}
            inputValue={merchant}
            onInputChange={(e, val) => setMerchant(val || "")}
            disabled={saving}
            renderInput={(params) => (
              <TextField
                {...params}
                sx={inputSx}
                label="Loja *"
                fullWidth
                helperText={
                  !historyEnabled
                    ? "Toque para habilitar sugestões do histórico"
                    : String(merchant || "").trim().length < MIN_MERCHANT_CHARS
                      ? `Digite pelo menos ${MIN_MERCHANT_CHARS} caractere(s)`
                      : "Sugestões do histórico"
                }
              />
            )}
          />

          {/* ✅ Descrição */}
          <Autocomplete
            freeSolo
            options={descriptionOptions}
            openOnFocus={false}
            filterOptions={(x) => x}
            value={description}
            onFocus={() => setHistoryEnabled(true)}
            onChange={(e, val) => setDescription(val || "")}
            inputValue={description}
            onInputChange={(e, val) => setDescription(val || "")}
            disabled={saving}
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

          <Stack direction={{ xs: "column", sm: "row" }} spacing={5.1}>
            <Autocomplete
              disablePortal
              fullWidth
              options={categories || []}
              value={selectedCategory || null}
              disabled={saving}
              slotProps={{
                popper: {
                  placement: "top-start",
                  modifiers: [
                    {
                      name: "flip",
                      enabled: false, // 🚀 impede virar pra baixo
                    },
                  ],
                },
              }}

              ListboxProps={{
                style: {
                  maxHeight: 260,
                  overflow: "auto",
                },
              }}

              isOptionEqualToValue={(opt, val) =>
                String(opt?.slug ?? opt?.id ?? "") === String(val?.slug ?? val?.id ?? "")
              }

              getOptionLabel={(opt) => {
                const slug = String(opt?.slug ?? opt?.id ?? "");
                const name = String(opt?.name ?? opt?.title ?? opt?.label ?? "");
                return name || slug;
              }}

              onChange={(_, val) => {
                const next = String(val?.slug ?? val?.id ?? "");
                if (next) setCategoryId(next);
              }}

              renderOption={(props, option) => (
                <li {...props} key={String(option?.slug ?? option?.id ?? "")}>
                  <CategoryOption category={option} />
                </li>
              )}

              renderInput={(params) => (
                <TextField
                  {...params}
                  sx={inputSx}
                  label="Categoria"
                  placeholder="Digite para buscar"
                  fullWidth
                />
              )}
            />

            <TextField
              sx={inputSx}
              label="Valor (R$)"
              value={amount}
              onChange={(e) => setAmount(sanitizeBrlInput(e.target.value))}
              onBlur={() => {
                const v = parseBrlToNumber(amount);
                if (Number.isFinite(v)) setAmount(formatNumberToBrlInput(Math.abs(v)));
              }}
              type="text"
              inputProps={{
                inputMode: "decimal",
                pattern: "[0-9]*[.,]?[0-9]*",
              }}
              fullWidth
              disabled={saving}
            />
          </Stack>

          <Divider sx={{ mt: 20 }} />

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ flexWrap: "wrap", rowGap: 0.8 }}
          >
            <Chip
              label="Avulso"
              color={kind === "one_off" ? "primary" : "default"}
              variant={kind === "one_off" ? "filled" : "outlined"}
              disabled={saving}
              onClick={() => {
                if (saving) return;
                setKind("one_off");
                setShowInstallmentsPreview(false);
              }}
              sx={{ fontWeight: 900 }}
            />

            <Chip
              label="Mensal"
              color={kind === "recurring" ? "primary" : "default"}
              variant={kind === "recurring" ? "filled" : "outlined"}
              disabled={saving}
              onClick={() => {
                if (saving) return;
                setKind("recurring");
                setShowInstallmentsPreview(false);
              }}
              sx={{ fontWeight: 900 }}
            />

            <Chip
              label="Parcelado"
              color={kind === "installment" ? "primary" : "default"}
              variant={kind === "installment" ? "filled" : "outlined"}
              disabled={saving}
              onClick={() => {
                if (saving) return;
                setKind("installment");
              }}
              sx={{ fontWeight: 900 }}
            />
          </Stack>

          {kind === "recurring" ? (
            <TextField
              sx={inputSx}
              label="Repetir até"
              type="month"
              value={recurringUntilYm}
              onChange={(e) => setRecurringUntilYm(e.target.value)}
              fullWidth
              disabled={saving}
              helperText="Será criado 1 lançamento por mês, do mês da cobrança até esse mês (inclusive)."
            />
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
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.1} alignItems={{ sm: "center" }}>
                <TextField
                  sx={inputSx}
                  label="Nº parcelas"
                  type="number"
                  value={nParts}
                  onChange={(e) => setNParts(e.target.value)}
                  inputProps={{ min: 2, max: 36 }}
                  fullWidth={isSmDown}
                  style={isSmDown ? undefined : { width: 180 }}
                />
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Centavos distribuídos nas primeiras parcelas.
                </Typography>
              </Stack>

              {/* ✅ preview colapsado no mobile */}
              <Box sx={{ mt: 1.0 }}>
                <Button
                  size="small"
                  onClick={() => {
                    if (saving) return;
                    setShowInstallmentsPreview((v) => !v);
                  }}
                  disabled={saving}
                  sx={{ fontWeight: 950, textTransform: "none", borderRadius: 999 }}
                  endIcon={showInstallmentsPreview ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                >
                  {showInstallmentsPreview ? "Ocultar preview" : "Ver preview das parcelas"}
                </Button>

                {showInstallmentsPreview ? (
                  previewInstallments.length ? (
                    <Stack spacing={0.8} sx={{ mt: 1.0 }}>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
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
                              gap: 1,
                            }}
                          >
                            <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 700 }}>
                              {p.dateLabel}
                            </Typography>

                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 900,
                                px: 0.8,
                                py: 0.2,
                                borderRadius: 1,
                                backgroundColor: "rgba(2,6,23,0.06)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {p.label}
                            </Typography>

                            <Typography variant="body2" sx={{ fontWeight: 950, whiteSpace: "nowrap" }}>
                              {p.valueLabel}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Stack>
                  ) : (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      Para ver o preview, informe um <b>Valor</b> válido e <b>Nº de parcelas</b> (mín. 2).
                    </Alert>
                  )
                ) : null}
              </Box>
            </Box>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={actionsSx}>
        <Button onClick={handleClose} variant="outlined" disabled={saving} sx={{ borderRadius: 2 }}>
          Cancelar
        </Button>

        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          sx={{ fontWeight: 950, borderRadius: 2, minWidth: 160 }}
        >
          {saving ? (
            <Stack direction="row" alignItems="center" spacing={1}>
              <CircularProgress size={18} />
              <span>{savingLabel}</span>
            </Stack>
          ) : (
            "Salvar"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}