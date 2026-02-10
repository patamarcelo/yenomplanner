// src/components/NewTransactionModal.jsx
import React, { useMemo, useState, useEffect } from "react";
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
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";

import { categories } from "../data/mockCategories";
import { splitInstallments } from "../utils/splitInstallments";
import { formatBRL } from "../utils/money";
import { computeInvoiceMonthFromPurchase, ymFromDate } from "../utils/billingDates";
import { formatMonthBR } from "../utils/dateBR";

import { createTransactionThunk } from "../store/transactionsSlice";

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

export default function NewTransactionModal({ open, onClose }) {
  const dispatch = useDispatch();
  const accounts = useSelector((s) => s.accounts?.accounts || []);
  const apiError = useSelector((s) => s.transactions?.error || "");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // defaults
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [chargeDate, setChargeDate] = useState(todayISO());
  const [chargeTouched, setChargeTouched] = useState(false);

  const [accountId, setAccountId] = useState("");

  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("outros");

  // guardar como string (o thunk vai converter pra amount string e o serializer vira cents)
  const [amount, setAmount] = useState("0");

  const [status, setStatus] = useState("planned"); // planned | confirmed | paid | overdue

  const [kind, setKind] = useState("one_off"); // one_off | recurring | installment
  const [nParts, setNParts] = useState(2);

  // expense | income
  const [direction, setDirection] = useState("expense");

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

  // auto-ajuste chargeDate quando trocar conta / purchaseDate (se usuário não editou manualmente)
  useEffect(() => {
    if (!open) return;

    if (!chargeTouched) {
      const today = todayISO();

      if (!selectedAccount) {
        // sem conta: cobrança = hoje
        setChargeDate(today);
        return;
      }

      if (selectedAccount.type === "checking") {
        // conta corrente: cobrança = compra (padrão hoje)
        setChargeDate(purchaseDate || today);
        return;
      }

      // cartão: cobrança = (invoiceMonth + dueDay)
      const dueDay = selectedAccount?.statement?.dueDay ?? 10;
      const ym = computeInvoiceMonthFromPurchase(purchaseDate || today, selectedAccount?.statement?.cutoffDay);
      const d = makeChargeDateFromYM(ym, dueDay);
      setChargeDate(d || today);
    }
  }, [open, selectedAccount, purchaseDate, chargeTouched]);

  const previewParts = useMemo(() => {
    const n = Math.max(1, Number(nParts || 1));
    const v = Number(String(amount || "0").replace(",", "."));
    if (kind !== "installment" || !Number.isFinite(v) || v <= 0 || n <= 1) return [];
    return splitInstallments(v, n);
  }, [amount, kind, nParts]);

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
    setKind("one_off");
    setNParts(2);
    setDirection("expense");

    setErr("");
    setSaving(false);
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  function validate() {
    const v = Number(String(amount || "0").replace(",", "."));
    const loja = (merchant || "").trim();
    const desc = (description || "").trim();

    if (!purchaseDate) return "Selecione a data da compra.";
    if (!chargeDate) return "Selecione a data de cobrança.";
    if (!loja) return "Preencha a Loja.";
    if (!desc) return "Preencha a Descrição.";
    if (!Number.isFinite(v) || v <= 0) return "Informe um valor válido.";

    // regra: confirmed/paid idealmente com conta
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

    return {
      client_id: genClientId(),
      purchaseDate,
      chargeDate,
      invoiceMonth, // thunk converte pra invoice_month = YYYY-MM-01
      accountId: accountId || null,
      merchant: loja,
      description: desc,
      categoryId,
      amount, // string
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
        const res = await dispatch(
          createTransactionThunk({
            ...base,
            kind: "one_off",
            installmentGroupId: null,
            installmentCurrent: null,
            installmentTotal: null,
            recurringRule: null,
          })
        ).unwrap();

        // ok
        handleClose();
        return;
      }

      // MENSAL
      if (kind === "recurring") {
        await dispatch(
          createTransactionThunk({
            ...base,
            kind: "recurring",
            recurringRule: "monthly",
          })
        ).unwrap();

        handleClose();
        return;
      }

      // PARCELADO
      const n = Math.max(2, Number(nParts));
      const vNum = Number(String(amount || "0").replace(",", "."));
      const parts = splitInstallments(vNum, n);

      const groupId = `inst_${Math.random().toString(16).slice(2, 9)}`;

      // baseDate = mês da chargeDate, dia 01
      const baseDate = new Date(base.chargeDate);
      baseDate.setDate(1);

      // cria N lançamentos (um por mês)
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
            amount: String(partValue.toFixed(2)).replace(".", ","), // manda string
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

  const isExpense = direction === "expense";

  const borderColor = isExpense
    ? "rgba(211,47,47,0.45)"   // vermelho mais presente
    : "rgba(46,125,50,0.45)"; // verde mais presente

  const tintBg = isExpense
    ? "rgba(211,47,47,0.22)"  // MUITO suave
    : "rgba(46,125,50,0.22)";

  const gradientAccent = isExpense
    ? "rgba(211,47,47,0.28)"
    : "rgba(46,125,50,0.28)";

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
      color: "whitesmoke",
      fontWeight: 600,
    },
    "& .MuiInputLabel-root.Mui-focused": {
      color: "whitesmoke",
    },
    "& .MuiInputBase-input": {
      color: "#111", // texto digitado (mantém legível)
    },
    "& .MuiOutlinedInput-root": {
      backgroundColor: "rgba(255,255,255,0.92)",
      borderRadius: 2,
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(255,255,255,0.35)",
    },
    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(255,255,255,0.6)",
    },
    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(255,255,255,0.9)",
    },
    "& .MuiFormHelperText-root": {
      color: "rgba(245,245,245,0.8)", // whitesmoke mais suave
    },
  };



  const inputBg = isExpense ? "rgba(211,47,47,0.045)" : "rgba(46,125,50,0.045)";
  const inputBgHover = isExpense ? "rgba(211,47,47,0.070)" : "rgba(46,125,50,0.070)";
  const inputBgFocus = isExpense ? "rgba(211,47,47,0.095)" : "rgba(46,125,50,0.095)";

  const inputBorder = "rgba(0,0,0,0.14)";
  const inputBorderHover = isExpense ? "rgba(211,47,47,0.35)" : "rgba(46,125,50,0.35)";
  const inputBorderFocus = isExpense ? "rgba(211,47,47,0.55)" : "rgba(46,125,50,0.55)";

  const inputRing = isExpense ? "rgba(211,47,47,0.16)" : "rgba(46,125,50,0.16)";


  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 2,
          border: `1.5px solid ${borderColor}`,

          // fundo legível + elegante
          background: `
            linear-gradient(
              -180deg,
              ${gradientAccent} 10%,
              ${tintBg} 10px,
              rgba(255,255,255,0.96) 80%
            )
          `,
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          transition: "all 0.2s ease",
          "&:hover": {
            boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
            borderColor: isExpense
              ? "rgba(211,47,47,0.65)"
              : "rgba(46,125,50,0.65)",
          },
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 950, py: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
          <Typography sx={{ fontWeight: 950, color: 'whitesmoke' }}>Novo lançamento</Typography>

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

          // aplica em TODOS os TextFields/Selects do modal
          "& .MuiTextField-root .MuiOutlinedInput-root": {
            borderRadius: 2,
            backgroundColor: inputBg,
            transition: "background-color .15s ease, box-shadow .15s ease, border-color .15s ease",

            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: inputBorder,
            },

            "&:hover": {
              backgroundColor: inputBgHover,
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: inputBorderHover,
              },
            },

            "&.Mui-focused": {
              backgroundColor: inputBgFocus,
              boxShadow: `0 0 0 4px ${inputRing}`,
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: inputBorderFocus,
                borderWidth: 1,
              },
            },
          },

          // deixa o placeholder mais visível
          "& .MuiInputBase-input::placeholder": {
            opacity: 0.85,
          },

          // helper text discreto e alinhado
          "& .MuiFormHelperText-root": {
            marginLeft: 0,
            marginRight: 0,
            opacity: 0.85,
          },

          // melhora o Select (ícone / padding)
          "& .MuiSelect-select": {
            paddingTop: "12.5px",
            paddingBottom: "12.5px",
          },
        }}
      >
        <Stack spacing={1.4}>
          {err ? <Alert severity="error">{err}</Alert> : null}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
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
                setAccountId(e.target.value);
                // ao trocar a conta, volta a auto-calcular (se usuário não tinha mexido)
                setChargeTouched(false);
              }}
              fullWidth
            >
              <MenuItem value="">(Sem conta) — Provisionar</MenuItem>
              <Divider />
              {accounts
                .filter((a) => a.active !== false)
                .map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.type === "credit_card" ? `💳 ${a.name}` : `🏦 ${a.name}`}
                  </MenuItem>
                ))}
            </TextField>

            <TextField
              sx={inputSx} label="Status" select value={status} onChange={(e) => setStatus(e.target.value)} fullWidth>
              <MenuItem value="planned">Previsto</MenuItem>
              <MenuItem value="confirmed">Confirmado</MenuItem>
              <MenuItem value="paid">Pago</MenuItem>
              <MenuItem value="overdue">Atrasado</MenuItem>
            </TextField>
          </Stack>

          <TextField
            sx={inputSx}
            label="Loja *"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Ex: iFood, Uber, Amazon..."
            fullWidth
          />

          <TextField
            sx={inputSx}
            label="Descrição *"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Mercado semana, assinatura..."
            fullWidth
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
            <TextField
              sx={inputSx}
              label="Categoria"
              select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              fullWidth
            >
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              sx={inputSx}
              label="Valor (R$)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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

              {previewParts.length ? (
                <Stack spacing={0.6} sx={{ mt: 1.2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>
                    Preview das parcelas
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    {previewParts.map((val, idx) => (
                      <Chip
                        key={idx}
                        label={`${idx + 1}/${previewParts.length} — ${formatBRL(val)}`}
                        variant="outlined"
                        sx={{ mb: 0.6, fontWeight: 850 }}
                      />
                    ))}
                  </Stack>
                </Stack>
              ) : null}
            </Box>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" disabled={saving}>
          Cancelar
        </Button>

        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          sx={{
            fontWeight: 950,
            borderRadius: 2,
            minWidth: 140,
          }}
        >
          {saving ? <CircularProgress size={18} /> : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
