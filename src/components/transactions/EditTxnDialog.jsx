import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useSelector } from "react-redux";
import { selectCategories } from "../../store/categoriesSlice";

function safeAccountActive(a) {
  return a?.active !== false;
}

// ===== BRL helpers (mesmos que você já tem) =====
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

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function ymFromISO(iso) {
  if (!iso || String(iso).length < 7) return "";
  return String(iso).slice(0, 7);
}

export default function EditTxnDialog({
  open,
  onClose,
  mode = "edit", // "edit" | "duplicate"
  txn,
  accounts,
  onSave,
  defaultAccountId,
  historyIndex, // <- vindo do grid
}) {
  const t = txn || {};
  const categories = useSelector(selectCategories);

  const [purchaseDate, setPurchaseDate] = useState(t.purchaseDate || "");
  const [chargeDate, setChargeDate] = useState(t.chargeDate || "");
  const [invoiceMonth, setInvoiceMonth] = useState(t.invoiceMonth || "");
  const [accountId, setAccountId] = useState(t.accountId || "");
  const [merchant, setMerchant] = useState(t.merchant || "");
  const [description, setDescription] = useState(t.description || "");
  const [categoryId, setCategoryId] = useState(t.categoryId || "");
  const [kind, setKind] = useState(t.kind || "one_off");
  const [status, setStatus] = useState(t.status || "previsto");
  const [amount, setAmount] = useState(formatNumberToBrlInput(Math.abs(Number(t.amount ?? 0))));
  const [err, setErr] = useState("");

  // “statusTouched” pra não ficar sobrescrevendo depois do usuário mexer
  const statusTouchedRef = useRef(false);

  // re-sync quando abrir (e também no “duplicate”)
  React.useEffect(() => {
    const x = txn || {};
    const isDup = mode === "duplicate";
    const isoToday = todayISO();

    setPurchaseDate(isDup ? isoToday : (x.purchaseDate || ""));
    setChargeDate(isDup ? isoToday : (x.chargeDate || ""));
    setInvoiceMonth(isDup ? ymFromISO(isoToday) : (x.invoiceMonth || ""));
    setMerchant(x.merchant || "");
    setDescription(x.description || "");
    setCategoryId(x.categoryId || "");
    setKind(x.kind || "one_off");

    // status vai ser “auto” dependendo da conta (mas só se usuário não mexeu)
    statusTouchedRef.current = false;
    setStatus(x.status || "previsto");

    setAmount(formatNumberToBrlInput(Math.abs(Number(x.amount ?? 0))));
    setErr("");

    setAccountId(x.accountId || defaultAccountId || "");
  }, [txn, defaultAccountId, mode]);

  const accountsById = useMemo(() => {
    const m = {};
    for (const a of accounts || []) if (a?.id) m[a.id] = a;
    return m;
  }, [accounts]);

  const merchantOptions = useMemo(() => {
    const list = historyIndex?.getMerchantSuggestions?.(merchant, 12) || [];
    return list.map((x) => x.label);
  }, [historyIndex, merchant]);

  const descriptionOptions = useMemo(() => {
    const list = historyIndex?.getDescriptionSuggestions?.(merchant, description, 12) || [];
    return list.map((x) => x.label);
  }, [historyIndex, merchant, description]);

  const suggestedCategoryForMerchant = useMemo(() => {
    const best = historyIndex?.getBestCategoryForMerchant?.(merchant) || "";
    return best;
  }, [historyIndex, merchant]);

  // auto categoria quando muda a loja (se estiver vazio OU se estiver duplicando)
  React.useEffect(() => {
    if (!merchant) return;
    if (!suggestedCategoryForMerchant) return;

    // só autopreenche se não tem categoria escolhida (ou se veio inválida)
    if (!categoryId) {
      setCategoryId(suggestedCategoryForMerchant);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant, suggestedCategoryForMerchant]);

  // status automático ao escolher conta: 💳 => confirmado, 🏦 => pago
  function applyAutoStatusByAccount(nextAccountId) {
    if (statusTouchedRef.current) return;

    const acc = nextAccountId ? accountsById[nextAccountId] : null;
    if (!acc) return;

    if (acc.type === "credit_card") setStatus("confirmado");
    else setStatus("pago");
  }

  function validate() {
    if (!String(merchant).trim()) return "Preencha a Loja.";
    if (!String(description).trim()) return "Preencha a Descrição.";
    const v = parseBrlToNumber(amount);
    if (!Number.isFinite(v) || v <= 0) return "Informe um valor válido.";
    return "";
  }

  function handleSave() {
    const e = validate();
    if (e) return setErr(e);

    const v = parseBrlToNumber(amount);

    const payload = {
      ...t,
      purchaseDate,
      chargeDate,
      invoiceMonth,
      accountId: accountId || null,
      merchant: String(merchant).trim(),
      description: String(description).trim(),
      categoryId,
      kind,
      status,
      // sempre manda positivo no form; o sinal é responsabilidade do direction no backend/store
      amount: formatNumberToBrlInput(v),
    };

    if (mode === "duplicate") {
      // duplicar: não pode reutilizar id
      delete payload.id;
      delete payload.clientId;
    }

    onSave(payload);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>
        {mode === "duplicate" ? "Duplicar lançamento" : "Editar lançamento"}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={1.2} sx={{ mt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}

          <Stack direction="row" spacing={1.2}>
            <TextField
              label="Data compra"
              type="date"
              value={purchaseDate}
              onChange={(e) => {
                const v = e.target.value;
                setPurchaseDate(v);
                // ajuda: se invoiceMonth vazio, preenche pelo purchaseDate
                if (!invoiceMonth && v) setInvoiceMonth(ymFromISO(v));
              }}
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
              label="Mês fatura (YYYY-MM)"
              value={invoiceMonth}
              onChange={(e) => setInvoiceMonth(e.target.value)}
              fullWidth
              placeholder="2026-02"
            />

            <TextField
              label="Conta"
              select
              value={accountId || ""}
              onChange={(e) => {
                const next = e.target.value;
                setAccountId(next);
                applyAutoStatusByAccount(next);
              }}
              fullWidth
            >
              <MenuItem value="">(Sem conta)</MenuItem>
              {accounts.filter(safeAccountActive).map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.type === "credit_card" ? "💳 " : "🏦 "}
                  {a.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {/* Loja com sugestões */}
          <Autocomplete
            freeSolo
            options={merchantOptions}
            value={merchant}
            onChange={(e, val) => setMerchant(val || "")}
            inputValue={merchant}
            onInputChange={(e, val) => setMerchant(val || "")}
            renderInput={(params) => <TextField {...params} label="Loja" fullWidth />}
          />

          {/* Descrição com sugestões por loja */}
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
                label="Descrição"
                fullWidth
                helperText={merchant ? "Sugestões baseadas na loja selecionada" : "Selecione uma loja para sugestões"}
              />
            )}
          />

          <Stack direction="row" spacing={1.2}>
            <TextField
              label="Categoria"
              select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              fullWidth
              helperText={
                suggestedCategoryForMerchant
                  ? `Sugestão da loja: ${suggestedCategoryForMerchant}`
                  : "—"
              }
            >
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.slug}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField label="Tipo" select value={kind} onChange={(e) => setKind(e.target.value)} fullWidth>
              <MenuItem value="one_off">Avulso</MenuItem>
              <MenuItem value="recurring">Mensal</MenuItem>
              <MenuItem value="installment">Parcela</MenuItem>
            </TextField>
          </Stack>

          <Stack direction="row" spacing={1.2}>
            <TextField
              label="Status"
              select
              value={status}
              onChange={(e) => {
                statusTouchedRef.current = true;
                setStatus(e.target.value);
              }}
              fullWidth
            >
              <MenuItem value="previsto">Previsto</MenuItem>
              <MenuItem value="confirmado">Confirmado</MenuItem>
              <MenuItem value="pago">Pago</MenuItem>
              <MenuItem value="atraso">Atraso</MenuItem>
            </TextField>

            <TextField
              label="Valor (R$)"
              value={amount}
              onChange={(e) => setAmount(sanitizeBrlInput(e.target.value))}
              onBlur={() => {
                const v = parseBrlToNumber(amount);
                if (Number.isFinite(v)) setAmount(formatNumberToBrlInput(v));
              }}
              inputMode="decimal"
              fullWidth
            />
          </Stack>

          {t?.installment ? (
            <>
              <Divider />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Parcelamento: <b>{t.installment.current}/{t.installment.total}</b>
              </Typography>
            </>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined">
          Cancelar
        </Button>
        <Button onClick={handleSave} variant="contained" sx={{ fontWeight: 900 }}>
          {mode === "duplicate" ? "Criar" : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
