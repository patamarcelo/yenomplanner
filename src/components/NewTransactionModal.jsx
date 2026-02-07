// src/components/NewTransactionModal.jsx
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
import { useDispatch } from "react-redux";

import { cards } from "../data/mockCards";
import { categories } from "../data/mockCategories";
import { nextTxnId } from "../data/mockTransactions";
import { splitInstallments } from "../utils/splitInstallments";
import { addTransactions } from "../store/financeSlice";
import { formatBRL } from "../utils/money";

function ymFromDate(dateStr) {
  // YYYY-MM-DD -> YYYY-MM
  const parts = String(dateStr || "").split("-");
  if (parts.length < 2) return "";
  return `${parts[0]}-${parts[1]}`;
}

export default function NewTransactionModal({ open, onClose }) {
  const dispatch = useDispatch();

  const [purchaseDate, setPurchaseDate] = useState("2026-02-01");
  const [chargeDate, setChargeDate] = useState("2026-02-01");
  const [cardId, setCardId] = useState("nubank");
  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("outros");
  const [amount, setAmount] = useState("0");
  const [status, setStatus] = useState("confirmado");

  const [isInstallment, setIsInstallment] = useState(false);
  const [nParts, setNParts] = useState(2);

  const [err, setErr] = useState("");

  const invoiceMonth = useMemo(() => ymFromDate(chargeDate), [chargeDate]);

  const previewParts = useMemo(() => {
    const n = Math.max(1, Number(nParts || 1));
    const v = Number(amount || 0);
    if (!isInstallment || !Number.isFinite(v) || v <= 0 || n <= 1) return [];
    return splitInstallments(v, n);
  }, [amount, isInstallment, nParts]);

  function reset() {
    setPurchaseDate("2026-02-01");
    setChargeDate("2026-02-01");
    setCardId("nubank");
    setMerchant("");
    setDescription("");
    setCategoryId("outros");
    setAmount("0");
    setStatus("confirmado");
    setIsInstallment(false);
    setNParts(2);
    setErr("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSave() {
    setErr("");

    const v = Number(amount || 0);
    const loja = (merchant || "").trim();
    const desc = (description || "").trim();

    if (!loja) {
      setErr("Preencha a Loja.");
      return;
    }
    if (!desc) {
      setErr("Preencha a Descrição.");
      return;
    }
    if (!Number.isFinite(v) || v <= 0) {
      setErr("Informe um valor válido.");
      return;
    }

    if (!isInstallment || Number(nParts) <= 1) {
      const tx = {
        id: nextTxnId(),
        purchaseDate,
        chargeDate,
        invoiceMonth,
        cardId,
        merchant: loja,
        description: desc,
        categoryId,
        kind: "one_off",
        installment: null,
        amount: v,
        notes: "",
        status,
      };

      dispatch(addTransactions(tx));
      handleClose();
      return;
    }

    // Parcelado: gera N linhas (mês da fatura avança mês a mês a partir do chargeDate)
    const n = Math.max(2, Number(nParts));
    const parts = splitInstallments(v, n);
    const groupId = `inst_${Math.random().toString(16).slice(2, 9)}`;

    const base = new Date(chargeDate);
    base.setDate(1);

    const generated = parts.map((partValue, idx) => {
      const d = new Date(base);
      d.setMonth(d.getMonth() + idx);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const ym = `${y}-${m}`;
      const dStr = `${y}-${m}-01`;

      return {
        id: nextTxnId(),
        purchaseDate,
        chargeDate: dStr,
        invoiceMonth: ym,
        cardId,
        merchant: loja,
        description: desc,
        categoryId,
        kind: "installment",
        installment: { groupId, current: idx + 1, total: n },
        amount: partValue,
        notes: "",
        status: idx === 0 ? status : "previsto",
      };
    });

    dispatch(addTransactions(generated));
    handleClose();
  }

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
              label="Data cobrança (fatura)"
              type="date"
              value={chargeDate}
              onChange={(e) => setChargeDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>

          <Stack direction="row" spacing={1.2}>
            <TextField
              label="Cartão"
              select
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              fullWidth
            >
              {cards.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
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
              <MenuItem value="confirmado">Confirmado</MenuItem>
              <MenuItem value="previsto">Previsto</MenuItem>
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

            <TextField
              label="Valor (R$)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              fullWidth
            />
          </Stack>

          <Divider />

          <Stack direction="row" spacing={1.0} alignItems="center">
            <Chip
              label={isInstallment ? "Parcelado" : "Avulso"}
              color={isInstallment ? "primary" : "default"}
              onClick={() => setIsInstallment((v) => !v)}
              variant={isInstallment ? "filled" : "outlined"}
              sx={{ fontWeight: 800 }}
            />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Mês de fatura: <b>{invoiceMonth || "—"}</b>
            </Typography>
          </Stack>

          {isInstallment ? (
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
