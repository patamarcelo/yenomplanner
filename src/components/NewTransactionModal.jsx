import React, { useMemo, useState } from "react";
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
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";

import { categories } from "../data/mockCategories";
import { nextTxnId } from "../data/mockTransactions";
import { splitInstallments } from "../utils/splitInstallments";
import { addTransactions } from "../store/financeSlice";
import { formatBRL } from "../utils/money";
import { computeInvoiceMonthFromPurchase, ymFromDate } from "../utils/billingDates";

import { formatMonthBR } from "../utils/dateBR";

export default function NewTransactionModal({ open, onClose }) {
  const dispatch = useDispatch();
  const accounts = useSelector((s) => s.accounts.accounts);

  const [purchaseDate, setPurchaseDate] = useState("2026-02-01");
  const [chargeDate, setChargeDate] = useState("2026-02-01");

  // conta é opcional (planned pode ficar sem)
  const [accountId, setAccountId] = useState("");

  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("outros");
  const [amount, setAmount] = useState("0");

  // status novo: planned/confirmed/paid/overdue (overdue normalmente é calculado, mas deixamos no modelo)
  const [status, setStatus] = useState("planned");

  // tipo: one_off | recurring | installment
  const [kind, setKind] = useState("one_off");
  const [nParts, setNParts] = useState(2);

  const [err, setErr] = useState("");

  const [direction, setDirection] = useState("expense");


  const selectedAccount = useMemo(() => {
    if (!accountId) return null;
    return accounts.find((a) => a.id === accountId) || null;
  }, [accounts, accountId]);

  // invoiceMonth:
  // - cartão: deriva de purchaseDate + cutoffDay
  // - outros: deriva de chargeDate (como você já fazia)
  const invoiceMonth = useMemo(() => {
    if (selectedAccount?.type === "credit_card") {
      const cutoffDay = selectedAccount?.statement?.cutoffDay;
      return computeInvoiceMonthFromPurchase(purchaseDate, cutoffDay);
    }
    return ymFromDate(chargeDate);
  }, [purchaseDate, chargeDate, selectedAccount]);

  const previewParts = useMemo(() => {
    const n = Math.max(1, Number(nParts || 1));
    const v = Number(amount || 0);
    if (kind !== "installment" || !Number.isFinite(v) || v <= 0 || n <= 1) return [];
    return splitInstallments(v, n);
  }, [amount, kind, nParts]);

  function reset() {
    setPurchaseDate("2026-02-01");
    setChargeDate("2026-02-01");
    setAccountId("");
    setMerchant("");
    setDescription("");
    setCategoryId("outros");
    setAmount("0");
    setStatus("planned");
    setKind("one_off");
    setNParts(2);
    setErr("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function validate() {
    const v = Number(amount || 0);
    const loja = (merchant || "").trim();
    const desc = (description || "").trim();

    if (!loja) return "Preencha a Loja.";
    if (!desc) return "Preencha a Descrição.";
    if (!Number.isFinite(v) || v <= 0) return "Informe um valor válido.";

    // regra: planned pode não ter conta; confirmed/paid idealmente deve ter
    if ((status === "confirmed" || status === "paid") && !accountId) {
      return "Para Confirmado/Pago, selecione uma Conta/Cartão (ou use Previsto).";
    }

    // se for cartão, chargeDate pode ser usado como “vencimento da parcela/registro”, mas a fatura vem do cutoff.
    // não travo aqui.

    // parcelado precisa de N >= 2
    if (kind === "installment") {
      const n = Number(nParts);
      if (!Number.isFinite(n) || n < 2) return "Parcelado precisa ter no mínimo 2 parcelas.";
    }

    return "";
  }

  function buildBaseTxn() {
    const loja = (merchant || "").trim();
    const desc = (description || "").trim();
    const v = Number(amount || 0);

    return {
      purchaseDate,
      chargeDate,
      invoiceMonth,
      accountId: accountId || null,
      cardId: null, // legado: vamos parar de usar aos poucos (agora usamos accountId)
      merchant: loja,
      description: desc,
      categoryId,
      amount: v,
      notes: "",
      status,
      direction
    };
  }

  function handleSave() {
    setErr("");
    const e = validate();
    if (e) {
      setErr(e);
      return;
    }

    const base = buildBaseTxn();

    // AVULSO
    if (kind === "one_off") {
      const tx = {
        id: nextTxnId(),
        ...base,
        kind: "one_off",
        installment: null,
      };
      dispatch(addTransactions(tx));
      handleClose();
      return;
    }

    // MENSAL
    if (kind === "recurring") {
      const tx = {
        id: nextTxnId(),
        ...base,
        kind: "recurring",
        installment: null,
        recurring: {
          // scaffold simples — depois a gente cria “grupo” e gera próximos meses
          rule: "monthly",
        },
      };
      dispatch(addTransactions(tx));
      handleClose();
      return;
    }

    // PARCELADO
    const n = Math.max(2, Number(nParts));
    const parts = splitInstallments(base.amount, n);
    const groupId = `inst_${Math.random().toString(16).slice(2, 9)}`;

    // para parcelado, os meses avançam a partir do invoiceMonth/chargeDate base
    const baseDate = new Date(base.chargeDate);
    baseDate.setDate(1);

    const generated = parts.map((partValue, idx) => {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + idx);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const ym = `${y}-${m}`;
      const dStr = `${y}-${m}-01`;

      return {
        id: nextTxnId(),
        ...base,
        chargeDate: dStr,
        invoiceMonth: selectedAccount?.type === "credit_card" ? ym : ym, // aqui fica igual; depois refinamos por regra de cartão
        kind: "installment",
        installment: { groupId, current: idx + 1, total: n },
        amount: partValue,
        status: idx === 0 ? base.status : "planned",
      };
    });

    dispatch(addTransactions(generated));
    handleClose();
  }

  const kindLabel = kind === "one_off" ? "Avulso" : kind === "recurring" ? "Mensal" : "Parcelado";

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 850 }}>Novo lançamento</DialogTitle>

      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}

          <Stack direction="row" spacing={1.2}>
            <TextField
              label="Data compra"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Data cobrança"
              type="date"
              value={chargeDate}
              onChange={(e) => setChargeDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>

          <Stack direction="row" spacing={1.2}>
            <TextField
              label="Conta / Cartão"
              select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              fullWidth
            >
              <MenuItem value="">(Sem conta) — Provisionar</MenuItem>

              <Divider />

              {accounts
                .filter((a) => a.active)
                .map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.type === "credit_card" ? `💳 ${a.name}` : `🏦 ${a.name}`}
                  </MenuItem>
                ))}
            </TextField>

            <TextField
              label="Status"
              select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              fullWidth
            >
              <MenuItem value="planned">Previsto</MenuItem>
              <MenuItem value="confirmed">Confirmado</MenuItem>
              <MenuItem value="paid">Pago</MenuItem>
              <MenuItem value="overdue">Atrasado</MenuItem>
            </TextField>
          </Stack>

          <TextField
            label="Loja *"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Ex: iFood, Uber, Amazon..."
            fullWidth
          />

          <TextField
            label="Descrição *"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Mercado semana, ida escritório, assinatura..."
            fullWidth
          />

          <Stack direction="row" spacing={1.2}>
            <TextField
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
          </Stack>
          <Stack direction="row" spacing={1.2}>
            <TextField
              label="Tipo"
              select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              sx={{ width: 160 }}
            >
              <MenuItem value="expense">Despesa</MenuItem>
              <MenuItem value="income">Receita</MenuItem>
            </TextField>

            <TextField
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
            />
            <Chip
              label="Mensal"
              color={kind === "recurring" ? "primary" : "default"}
              variant={kind === "recurring" ? "filled" : "outlined"}
              onClick={() => setKind("recurring")}
            />
            <Chip
              label="Parcelado"
              color={kind === "installment" ? "primary" : "default"}
              variant={kind === "installment" ? "filled" : "outlined"}
              onClick={() => setKind("installment")}
            />
          </Stack>

          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Mês de fatura: <b>{formatMonthBR(invoiceMonth) || "—"}</b>{" "}
            {selectedAccount?.type === "credit_card" ? (
              <span style={{ opacity: 0.8 }}>
                (cutoff dia {selectedAccount?.statement?.cutoffDay || "—"})
              </span>
            ) : null}
          </Typography>

          {kind === "installment" ? (
            <Box>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <TextField
                  label="Nº parcelas"
                  type="number"
                  value={nParts}
                  onChange={(e) => setNParts(e.target.value)}
                  inputProps={{ min: 2, max: 36 }}
                  sx={{ width: 160 }}
                />
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Centavos distribuídos nas primeiras parcelas.
                </Typography>
              </Stack>

              {previewParts.length ? (
                <Stack spacing={0.6} sx={{ mt: 1.2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    Preview das parcelas
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    {previewParts.map((val, idx) => (
                      <Chip
                        key={idx}
                        label={`${idx + 1}/${previewParts.length} — ${formatBRL(val)}`}
                        variant="outlined"
                        sx={{ mb: 0.6 }}
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
        <Button onClick={handleClose} variant="outlined">
          Cancelar
        </Button>
        <Button onClick={handleSave} variant="contained" sx={{ fontWeight: 850 }}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
