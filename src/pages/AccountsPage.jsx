// src/pages/AccountsPage.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Stack,
  Typography,
  Card,
  CardContent,
  Button,
  Divider,
  TextField,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
  CircularProgress,
  Snackbar,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";

import { selectHideValues } from "../store/uiSlice";

import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";

import {
  fetchAllTransactionsThunk,
  selectTransactionsUi,
} from "../store/transactionsSlice";

import {
  fetchAccountsThunk,
  selectAccounts,
  createAccountThunk,
  updateAccountThunk,
  deleteAccountThunk,
} from "../store/accountsSlice.js";

import {
  buildBankShareText,
  BRAZIL_BANKS,
  formatCPF,
  formatCNPJ,
  onlyDigits,
} from "../utils/accountBankShare";

function EmptyStateCard({ icon, title, subtitle, ctaLabel, onCta }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderStyle: "dashed",
        borderWidth: 1,
      }}
    >
      <CardContent sx={{ py: 3 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems="center"
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(0,0,0,0.03)",
              border: (t) => `1px solid ${t.palette.divider}`,
            }}
          >
            {icon}
          </Box>

          <Box sx={{ flex: 1, textAlign: { xs: "center", sm: "left" } }}>
            <Typography sx={{ fontWeight: 950 }}>{title}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
              {subtitle}
            </Typography>
          </Box>

          <Button
            onClick={onCta}
            variant="contained"
            startIcon={<AddRoundedIcon />}
            sx={{ fontWeight: 900, borderRadius: 999, px: 2 }}
          >
            {ctaLabel}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

const pageSx = {
  maxWidth: 1100,
  mx: "auto",
  px: { xs: 2, md: 3 },
  py: 2,
};

function AccountTypePill({ type }) {
  const label = type === "credit_card" ? "Cartão de crédito" : "Conta corrente";
  return <Chip size="small" label={label} variant="outlined" sx={{ fontWeight: 700 }} />;
}

function moneyBRL(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function signedAmount(tx) {
  const v = Math.abs(Number(tx?.amount || 0));
  if (!Number.isFinite(v)) return 0;
  return String(tx?.direction).toLowerCase() === "income" ? v : -v;
}

function calcAccountBalance(account, txns, accounts) {
  const opening = Number(account?.openingBalance || 0);
  const accId = String(account?.id || "");
  const sum = (txns || [])
    .filter((t) => {
      const tid = String(resolveTxnAccountId(t, accounts) || "");
      if (!tid || tid !== accId) return false;

      if (String(account?.type) !== "checking") return true;

      const st = String(t?.status || "").toLowerCase();
      return st === "pago";
    })
    .reduce((acc, t) => acc + signedAmount(t), 0);

  return opening + sum;
}

function softBorder(color, alpha = 0.35) {
  if (!color) return "rgba(0,0,0,0.08)";
  const m = String(color).match(
    /rgba\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*(0|1|0?\.\d+)\s*\)/
  );
  if (!m) return "rgba(0,0,0,0.08)";
  const [, r, g, b] = m;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgba(hex, alpha = 0.2) {
  if (!hex) return "rgba(0,0,0,0.08)";
  const h = String(hex).replace("#", "").padEnd(6, "0").slice(0, 6);
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (![r, g, b].every((x) => Number.isFinite(x))) return "rgba(0,0,0,0.08)";
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbaToHex(rgba) {
  const m = String(rgba || "").match(/rgba\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,/);
  if (!m) return "#000000";
  const [, r, g, b] = m;
  return (
    "#" +
    [r, g, b]
      .map((x) => Number(x).toString(16).padStart(2, "0"))
      .join("")
  );
}

function rgbaToAlpha(rgba) {
  const m = String(rgba || "").match(/rgba\([^,]+,[^,]+,[^,]+,\s*(.+)\)/);
  const a = m ? Number(m[1]) : 0.2;
  if (!Number.isFinite(a)) return 0.2;
  return Math.min(0.6, Math.max(0.05, a));
}

function safeActive(a) {
  return a?.active !== false;
}

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 50);
}

function resolveTxnAccountId(tx, accounts) {
  if (tx?.accountId) return tx.accountId;

  const legacy = tx?.cardId;
  if (!legacy) return "";

  const found = (accounts || []).find(
    (a) =>
      a?.type === "credit_card" &&
      String(a?.externalId || a?.external_id || "").endsWith(`_${legacy}`)
  );
  return found?.id || "";
}

function isLikelyInvoicePayment(tx) {
  const k = String(tx?.kind || "").toLowerCase();
  if (k.includes("bill_payment") || k.includes("invoice_payment") || k === "payment") return true;

  const desc = String(tx?.description || tx?.memo || tx?.title || "").toLowerCase();
  if (
    desc.includes("pagamento de fatura") ||
    desc.includes("pgto fatura") ||
    desc.includes("fatura paga")
  ) {
    return true;
  }

  return false;
}

function isInvoiceLike(tx) {
  if (tx?.invoice || tx?.invoiceId || tx?.invoice_id) return true;

  const k = String(tx?.kind || "").toLowerCase();
  if (k.includes("invoice") || k.includes("bill")) return true;

  return false;
}

function calcCardOpenUsedForLimit(cardId, txns, accounts) {
  let used = 0;

  for (const t of txns || []) {
    const accId = resolveTxnAccountId(t, accounts);
    if (!accId || String(accId) !== String(cardId)) continue;

    if (isInvoiceLike(t)) continue;
    if (isLikelyInvoicePayment(t)) continue;
    if (String(t?.status || "").toLowerCase() === "paid") continue;

    const dir = String(t?.direction || "").toLowerCase();
    const amt = Number(t?.amount || 0);
    if (!Number.isFinite(amt) || amt === 0) continue;

    if (dir === "income") {
      used -= Math.abs(amt);
    } else {
      used += Math.abs(amt);
    }
  }

  return Math.max(0, used);
}

function emptyCheckingBankDetails() {
  return {
    bankCode: "",
    bankName: "",
    branch: "",
    accountNumber: "",
    accountDigit: "",
    accountKind: "checking",
    holderName: "",
    documentType: "cpf",
    documentNumber: "",
    pixKeyType: "",
    pixKey: "",
  };
}

function AccountFormDialog({ open, onClose, initial }) {
  const dispatch = useDispatch();
  const isEdit = !!initial?.id;
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState("checking");
  const [name, setName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");

  const [hexColor, setHexColor] = useState("#000000");
  const [alpha, setAlpha] = useState(0.08);
  const color = useMemo(() => hexToRgba(hexColor, alpha), [hexColor, alpha]);

  const [limit, setLimit] = useState("");
  const [cutoffDay, setCutoffDay] = useState("1");
  const [dueDay, setDueDay] = useState("10");

  const [bankDetails, setBankDetails] = useState(emptyCheckingBankDetails());

  useEffect(() => {
    const init = initial || null;

    setType(init?.type || "checking");
    setName(init?.name || "");
    setExternalId(init?.externalId || init?.external_id || "");
    setOpeningBalance(String(init?.openingBalance ?? 0));

    setHexColor(rgbaToHex(init?.color || "rgba(0,0,0,0.08)"));
    setAlpha(rgbaToAlpha(init?.color || "rgba(0,0,0,0.08)"));

    setLimit(init?.type === "credit_card" ? String(init?.limit ?? 0) : "");
    setCutoffDay(init?.type === "credit_card" ? String(init?.statement?.cutoffDay ?? 1) : "1");
    setDueDay(init?.type === "credit_card" ? String(init?.statement?.dueDay ?? 10) : "10");

    setBankDetails({
      ...emptyCheckingBankDetails(),
      ...(init?.bankDetails || {}),
    });

    setSaving(false);
  }, [initial, open]);

  function handleClose() {
    if (saving) return;
    onClose();
  }

  function setBankField(field, value) {
    setBankDetails((prev) => ({ ...prev, [field]: value }));
  }

  function validate() {
    const nm = (name || "").trim();
    if (!nm) return "Informe o nome.";

    if (type === "credit_card") {
      const lim = Number(limit);
      const cd = Number(cutoffDay);
      const dd = Number(dueDay);
      if (!Number.isFinite(lim) || lim <= 0) return "Informe um limite válido.";
      if (!Number.isFinite(cd) || cd < 1 || cd > 28) return "Dia de corte deve ser entre 1 e 28.";
      if (!Number.isFinite(dd) || dd < 1 || dd > 28) return "Dia de vencimento deve ser entre 1 e 28.";
    }

    if (type === "checking") {
      const ob = Number(openingBalance);
      if (!Number.isFinite(ob)) return "Saldo inicial inválido.";
    }

    return "";
  }

  async function handleSave() {
    const err = validate();
    if (err) {
      window.alert(err);
      return;
    }

    const nm = (name || "").trim();

    const autoExternal =
      externalId?.trim() || `acc_${type === "credit_card" ? "cc" : "checking"}_${slugify(nm)}`;

    const payload = {
      externalId: autoExternal,
      type,
      name: nm,
      color,
      active: initial?.active ?? true,
      openingBalance: Number(openingBalance || 0),
    };

    if (type === "credit_card") {
      payload.limit = Number(limit);
      payload.statement = {
        cutoffDay: Number(cutoffDay),
        dueDay: Number(dueDay),
      };
    } else {
      payload.bankDetails = {
        ...bankDetails,
        bankCode: onlyDigits(bankDetails.bankCode),
        branch: onlyDigits(bankDetails.branch),
        accountNumber: onlyDigits(bankDetails.accountNumber),
        accountDigit: onlyDigits(bankDetails.accountDigit),
        documentNumber: onlyDigits(bankDetails.documentNumber),
        holderName: String(bankDetails.holderName || "").toUpperCase(),
      };
    }

    try {
      setSaving(true);
      if (isEdit) {
        await dispatch(updateAccountThunk({ id: initial.id, patch: payload })).unwrap();
      } else {
        await dispatch(createAccountThunk(payload)).unwrap();
      }
      onClose();
    } catch (e) {
      window.alert(e?.message || "Não foi possível salvar a conta.");
    } finally {
      setSaving(false);
    }
  }

  const selectedBank =
    BRAZIL_BANKS.find((b) => b.code === bankDetails.bankCode) || null;

  const sharePreview = useMemo(() => {
    return buildBankShareText({ bankDetails });
  }, [bankDetails]);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>
        {isEdit ? "Editar conta" : "Nova conta"}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 900, mb: 1 }}>Tipo</Typography>
            <ToggleButtonGroup
              value={type}
              exclusive
              onChange={(_, value) => value && setType(value)}
              fullWidth
              size="small"
            >
              <ToggleButton value="checking">Conta corrente</ToggleButton>
              <ToggleButton value="credit_card">Cartão de crédito</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              border: (t) => `1px solid ${t.palette.divider}`,
            }}
          >
            <Typography sx={{ fontWeight: 900, mb: 1.2 }}>Identificação</Typography>

            <Stack spacing={1.2}>
              <TextField
                label="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                placeholder="Ex: C6, Nubank, Conta principal"
              />

              <TextField
                label="External ID (opcional)"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                fullWidth
                placeholder='Ex: "acc_checking_c6"'
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                <TextField
                  label="Saldo inicial (R$)"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  inputMode="decimal"
                  fullWidth
                />

                <Stack spacing={0.8} sx={{ minWidth: { xs: "100%", sm: 240 }, flex: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800 }}>
                    Cor
                  </Typography>

                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <TextField
                      type="color"
                      value={hexColor}
                      onChange={(e) => setHexColor(e.target.value)}
                      sx={{ width: 70, "& input": { padding: 0, height: 44, cursor: "pointer" } }}
                    />
                    <Box
                      sx={{
                        flex: 1,
                        height: 44,
                        borderRadius: 1.5,
                        backgroundColor: color,
                        border: `1px solid ${softBorder(color, 0.45)}`,
                      }}
                    />
                  </Stack>

                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <Typography variant="caption" sx={{ minWidth: 82, color: "text.secondary" }}>
                      Intensidade
                    </Typography>
                    <Slider
                      value={alpha}
                      min={0.05}
                      max={0.6}
                      step={0.05}
                      onChange={(_, v) => setAlpha(v)}
                      sx={{ flex: 1 }}
                    />
                    <Typography variant="caption" sx={{ width: 44, textAlign: "right", color: "text.secondary" }}>
                      {alpha.toFixed(2)}
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>
            </Stack>
          </Box>

          {type === "credit_card" ? (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                border: (t) => `1px solid ${t.palette.divider}`,
              }}
            >
              <Typography sx={{ fontWeight: 900, mb: 1.2 }}>Dados do cartão</Typography>

              <Stack spacing={1.2}>
                <TextField
                  label="Limite (R$)"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  inputMode="decimal"
                  fullWidth
                />

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                  <TextField
                    label="Dia de corte"
                    type="number"
                    value={cutoffDay}
                    onChange={(e) => setCutoffDay(e.target.value)}
                    inputProps={{ min: 1, max: 28 }}
                    fullWidth
                  />
                  <TextField
                    label="Dia de vencimento"
                    type="number"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    inputProps={{ min: 1, max: 28 }}
                    fullWidth
                  />
                </Stack>

                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Corte e vencimento entre 1 e 28 para evitar problemas em meses curtos.
                </Typography>
              </Stack>
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: (t) => `1px solid ${t.palette.divider}`,
                }}
              >
                <Typography sx={{ fontWeight: 900, mb: 1.2 }}>Dados bancários</Typography>

                <Stack spacing={1.2}>
                  <TextField
                    select
                    label="Tipo da conta"
                    value={bankDetails.accountKind}
                    onChange={(e) => setBankField("accountKind", e.target.value)}
                    fullWidth
                  >
                    <MenuItem value="checking">Conta corrente</MenuItem>
                    <MenuItem value="payment">Conta pagamento</MenuItem>
                    <MenuItem value="savings">Conta poupança</MenuItem>
                  </TextField>

                  <Autocomplete
                    options={BRAZIL_BANKS}
                    value={selectedBank}
                    onChange={(_, option) => {
                      setBankField("bankCode", option?.code || "");
                      setBankField("bankName", option?.name || "");
                    }}
                    getOptionLabel={(option) => (option ? `${option.code} - ${option.name}` : "")}
                    renderInput={(params) => <TextField {...params} label="Banco" fullWidth />}
                  />

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                    <TextField
                      label="Código do banco"
                      value={bankDetails.bankCode}
                      onChange={(e) =>
                        setBankField("bankCode", onlyDigits(e.target.value).slice(0, 10))
                      }
                      fullWidth
                    />
                    <TextField
                      label="Nome do banco"
                      value={bankDetails.bankName}
                      onChange={(e) => setBankField("bankName", e.target.value)}
                      fullWidth
                    />
                  </Stack>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                    <TextField
                      label="Agência"
                      value={bankDetails.branch}
                      onChange={(e) =>
                        setBankField("branch", onlyDigits(e.target.value).slice(0, 20))
                      }
                      fullWidth
                    />
                    <TextField
                      label="Conta"
                      value={bankDetails.accountNumber}
                      onChange={(e) =>
                        setBankField("accountNumber", onlyDigits(e.target.value).slice(0, 30))
                      }
                      fullWidth
                    />
                    <TextField
                      label="Dígito"
                      value={bankDetails.accountDigit}
                      onChange={(e) =>
                        setBankField("accountDigit", onlyDigits(e.target.value).slice(0, 10))
                      }
                      sx={{ minWidth: 110 }}
                    />
                  </Stack>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                    <TextField
                      select
                      label="Documento"
                      value={bankDetails.documentType}
                      onChange={(e) => setBankField("documentType", e.target.value)}
                      fullWidth
                    >
                      <MenuItem value="cpf">CPF</MenuItem>
                      <MenuItem value="cnpj">CNPJ</MenuItem>
                    </TextField>

                    <TextField
                      label={bankDetails.documentType === "cnpj" ? "CNPJ" : "CPF"}
                      value={
                        bankDetails.documentType === "cnpj"
                          ? formatCNPJ(bankDetails.documentNumber)
                          : formatCPF(bankDetails.documentNumber)
                      }
                      onChange={(e) =>
                        setBankField("documentNumber", onlyDigits(e.target.value))
                      }
                      fullWidth
                    />
                  </Stack>

                  <TextField
                    label="Nome do titular"
                    value={bankDetails.holderName}
                    onChange={(e) => setBankField("holderName", e.target.value.toUpperCase())}
                    fullWidth
                  />

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                    <TextField
                      select
                      label="Tipo da chave PIX"
                      value={bankDetails.pixKeyType}
                      onChange={(e) => setBankField("pixKeyType", e.target.value)}
                      fullWidth
                    >
                      <MenuItem value="">Sem PIX</MenuItem>
                      <MenuItem value="cpf">CPF</MenuItem>
                      <MenuItem value="cnpj">CNPJ</MenuItem>
                      <MenuItem value="email">E-mail</MenuItem>
                      <MenuItem value="phone">Telefone</MenuItem>
                      <MenuItem value="random">Aleatória</MenuItem>
                    </TextField>

                    <TextField
                      label="Chave PIX"
                      value={bankDetails.pixKey}
                      onChange={(e) => setBankField("pixKey", e.target.value)}
                      fullWidth
                    />
                  </Stack>
                </Stack>
              </Box>

              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: (t) => `1px solid ${t.palette.divider}`,
                  bgcolor: (t) =>
                    t.palette.mode === "dark"
                      ? "rgba(255,255,255,0.02)"
                      : "rgba(0,0,0,0.015)",
                }}
              >
                <Typography sx={{ fontWeight: 900, mb: 1.2 }}>Prévia para compartilhar</Typography>
                <Box
                  sx={{
                    whiteSpace: "pre-line",
                    fontFamily: "monospace",
                    fontSize: 13,
                    p: 1.5,
                    borderRadius: 2,
                    border: (t) => `1px dashed ${t.palette.divider}`,
                  }}
                >
                  {sharePreview}
                </Box>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          sx={{ fontWeight: 900 }}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AccountsPage() {
  const dispatch = useDispatch();
  const accounts = useSelector(selectAccounts);
  const txns = useSelector(selectTransactionsUi);
  const hideValues = useSelector(selectHideValues);

  const [toast, setToast] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const maskMoney = (formatted) => (hideValues ? "••••" : formatted);

  function showToast(message, severity = "success") {
    setToast({
      open: true,
      severity,
      message,
    });
  }

  function closeToast() {
    setToast((prev) => ({ ...prev, open: false }));
  }

  useEffect(() => {
    dispatch(fetchAccountsThunk());
    dispatch(fetchAllTransactionsThunk());
  }, [dispatch]);

  const [openNew, setOpenNew] = useState(false);
  const [editAcc, setEditAcc] = useState(null);
  const [newType, setNewType] = useState("credit_card");

  const activeCount = useMemo(() => (accounts || []).filter((a) => safeActive(a)).length, [accounts]);
  const cardsOnly = useMemo(() => (accounts || []).filter((a) => a.type === "credit_card"), [accounts]);
  const checkingOnly = useMemo(() => (accounts || []).filter((a) => a.type === "checking"), [accounts]);

  const { totalCardLimit, totalCardOpen, totalCardAvailable } = useMemo(() => {
    const activeCards = (cardsOnly || []).filter((a) => safeActive(a));
    const limitTotal = activeCards.reduce((acc, a) => acc + Number(a?.limit || 0), 0);

    let openTotal = 0;
    for (const c of activeCards) {
      openTotal += calcCardOpenUsedForLimit(c.id, txns, accounts);
    }

    const available = limitTotal - openTotal;

    return {
      totalCardLimit: limitTotal,
      totalCardOpen: openTotal,
      totalCardAvailable: available,
    };
  }, [accounts, cardsOnly, txns]);

  const totalCheckingBalance = useMemo(() => {
    return (checkingOnly || []).reduce((acc, a) => {
      const balance = calcAccountBalance(a, txns, accounts);
      return acc + Number(balance || 0);
    }, 0);
  }, [checkingOnly, txns, accounts]);

  async function handleCopyBankData(account) {
    try {
      const text = account?.shareText || buildBankShareText(account);

      if (!text || !text.trim()) {
        showToast("Não há dados bancários para copiar.", "error");
        return;
      }

      await navigator.clipboard.writeText(text);
      showToast("Dados bancários copiados com sucesso.", "success");
    } catch (error) {
      showToast("Não foi possível copiar os dados bancários.", "error");
    }
  }

  return (
    <Box sx={pageSx}>
      <Stack spacing={1.2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 950 }}>
              Contas
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Ativas: <b>{activeCount}</b> • Cartões: <b>{cardsOnly.length}</b> • Correntes:{" "}
              <b>{checkingOnly.length}</b>
            </Typography>
          </Box>

          {cardsOnly.length > 0 && checkingOnly.length > 0 && (
            <Button
              variant="contained"
              sx={{ fontWeight: 900 }}
              onClick={() => {
                setNewType("credit_card");
                setOpenNew(true);
              }}
            >
              + Nova conta
            </Button>
          )}
        </Stack>

        <Divider />

        {cardsOnly.length > 0 && (
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mt: 0.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
              Cartões de crédito
            </Typography>

            <Stack direction="row" spacing={2} alignItems="baseline" sx={{ flexWrap: "wrap" }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Limite total: <b>{maskMoney(moneyBRL(totalCardLimit))}</b>
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Em aberto: <b>{maskMoney(moneyBRL(totalCardOpen))}</b>
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 950 }}>
                Disponível: {maskMoney(moneyBRL(totalCardAvailable))}
              </Typography>
            </Stack>
          </Stack>
        )}

        <Stack spacing={1.2}>
          {cardsOnly.length === 0 ? (
            <EmptyStateCard
              icon={<CreditCardRoundedIcon sx={{ fontSize: 30, opacity: 0.9 }} />}
              title="Nenhum cartão cadastrado ainda"
              subtitle="Cadastre seus cartões para controlar limite, corte e vencimento por fatura."
              ctaLabel="Cadastrar cartão"
              onCta={() => {
                setNewType("credit_card");
                setOpenNew(true);
              }}
            />
          ) : (
            cardsOnly.map((a) => {
              const openUsed = calcCardOpenUsedForLimit(a.id, txns, accounts);
              const available = Number(a?.limit || 0) - openUsed;

              return (
                <Card
                  key={a.id}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    borderColor: softBorder(a.color, 0.25),
                    borderWidth: 1,
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                    "&:hover": {
                      borderColor: softBorder(a.color, 0.45),
                      boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                    },
                  }}
                >
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                      <Stack direction="row" spacing={3.5} alignItems="center">
                        <Typography sx={{ fontSize: 32, lineHeight: "32px" }}>💳</Typography>

                        <Stack spacing={0.6}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography sx={{ fontWeight: 950 }}>{a.name}</Typography>
                            <AccountTypePill type={a.type} />
                            {!safeActive(a) ? <Chip size="small" label="Inativo" variant="outlined" /> : null}
                          </Stack>

                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            Limite: <b>{maskMoney(moneyBRL(a.limit))}</b>
                            {"  "}•{"  "}Em aberto: <b>{maskMoney(moneyBRL(openUsed))}</b>
                            {"  "}•{"  "}Disponível: <b>{maskMoney(moneyBRL(available))}</b>
                          </Typography>

                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            Corte: dia <b>{a?.statement?.cutoffDay ?? "—"}</b> • Vencimento: dia{" "}
                            <b>{a?.statement?.dueDay ?? "—"}</b>
                          </Typography>

                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            external_id: <b>{a.externalId || a.external_id || "—"}</b>
                          </Typography>
                        </Stack>
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() =>
                            dispatch(updateAccountThunk({ id: a.id, patch: { ...a, active: !safeActive(a) } }))
                          }
                        >
                          {safeActive(a) ? "Desativar" : "Ativar"}
                        </Button>

                        <Button size="small" variant="outlined" onClick={() => setEditAcc(a)}>
                          Editar
                        </Button>

                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={() => {
                            const ok = window.confirm(`Remover "${a.name}"?`);
                            if (ok) dispatch(deleteAccountThunk(a.id));
                          }}
                        >
                          Remover
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })
          )}
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mt: 0.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
            Contas correntes
          </Typography>

          <Stack direction="row" spacing={2} alignItems="baseline" sx={{ flexWrap: "wrap" }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Saldo total: <b>{maskMoney(moneyBRL(totalCheckingBalance))}</b>
            </Typography>
          </Stack>
        </Stack>

        <Stack spacing={1.2}>
          {checkingOnly.length === 0 ? (
            <EmptyStateCard
              icon={<AccountBalanceRoundedIcon sx={{ fontSize: 30, opacity: 0.9 }} />}
              title="Nenhuma conta corrente cadastrada ainda"
              subtitle="Cadastre sua conta para acompanhar saldo e movimentações."
              ctaLabel="Cadastrar conta"
              onCta={() => {
                setNewType("checking");
                setOpenNew(true);
              }}
            />
          ) : (
            checkingOnly.map((a) => {
              const balance = calcAccountBalance(a, txns, accounts);
              const bank = a.bankDetails || {};

              return (
                <Card
                  key={a.id}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    borderColor: softBorder(a.color, 0.25),
                    borderWidth: 1,
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                    "&:hover": {
                      borderColor: softBorder(a.color, 0.45),
                      boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                    },
                  }}
                >
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                        <Stack direction="row" spacing={3.5} alignItems="center">
                          <Typography sx={{ fontSize: 32, lineHeight: "32px" }}>🏦</Typography>

                          <Stack spacing={0.6}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography sx={{ fontWeight: 950 }}>{a.name}</Typography>
                              <AccountTypePill type={a.type} />
                              {!safeActive(a) ? <Chip size="small" label="Inativo" variant="outlined" /> : null}
                            </Stack>

                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              Sem fatura (usa data de cobrança).
                            </Typography>

                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              Saldo atual: <b>{maskMoney(moneyBRL(balance))}</b>
                            </Typography>

                            {/* <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              external_id: <b>{a.externalId || a.external_id || "—"}</b>
                            </Typography> */}
                          </Stack>
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ContentCopyRoundedIcon />}
                            onClick={() => handleCopyBankData(a)}
                          >
                            Copiar dados
                          </Button>

                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() =>
                              dispatch(updateAccountThunk({ id: a.id, patch: { ...a, active: !safeActive(a) } }))
                            }
                          >
                            {safeActive(a) ? "Desativar" : "Ativar"}
                          </Button>

                          <Button size="small" variant="outlined" onClick={() => setEditAcc(a)}>
                            Editar
                          </Button>

                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() => {
                              const ok = window.confirm(`Remover "${a.name}"?`);
                              if (ok) dispatch(deleteAccountThunk(a.id));
                            }}
                          >
                            Remover
                          </Button>
                        </Stack>
                      </Stack>

                      <Accordion
                        disableGutters
                        elevation={0}
                        sx={{
                          borderRadius: 2,
                          border: (t) => `1px solid ${t.palette.divider}`,
                          bgcolor: (t) =>
                            t.palette.mode === "dark"
                              ? "rgba(255,255,255,0.02)"
                              : "rgba(0,0,0,0.015)",
                          "&:before": { display: "none" },
                          overflow: "hidden",
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMoreRoundedIcon />}
                          sx={{
                            minHeight: 52,
                            "& .MuiAccordionSummary-content": {
                              my: 1,
                              display: 'flex',
                              justifyContent: 'space-around'
                            },
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              color: "text.secondary",
                              pr: 2,
                              lineHeight: 1.5,
                            }}
                          >
                            <b>{bank.bankCode || "—"} - {bank.bankName || "—"}</b>
                            {" • "}Ag <b>{bank.branch || "—"}</b>
                            {" • "}Conta{" "}
                            <b>
                              {bank.accountNumber || "—"}
                              {bank.accountDigit ? `-${bank.accountDigit}` : ""}
                            </b>
                          </Typography>
                          <Typography variant="body2" sx={{ color: "text.secondary", pr: 2 }}>
                              Tipo:{" "}
                              <b>
                                {bank.accountKind === "payment"
                                  ? "Conta pagamento"
                                  : bank.accountKind === "savings"
                                    ? "Conta poupança"
                                    : "Conta corrente"}
                              </b>
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary" , pr: 2}}>
                              Documento:{" "}
                              <b>
                                {bank.documentType === "cnpj"
                                  ? formatCNPJ(bank.documentNumber)
                                  : formatCPF(bank.documentNumber)}
                              </b>
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              Nome: <b>{bank.holderName || "—"}</b>
                            </Typography>
                        </AccordionSummary>

                        <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
                          <Stack spacing={0.7}>
                            

                            

  

                            <Box
                              sx={{
                                mt: 0.8,
                                whiteSpace: "pre-line",
                                fontFamily: "monospace",
                                fontSize: 12,
                                color: "text.secondary",
                                p: 1.2,
                                borderRadius: 1.5,
                                border: (t) => `1px dashed ${t.palette.divider}`,
                              }}
                            >
                              {a.shareText || buildBankShareText(a)}
                            </Box>
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })
          )}
        </Stack>
      </Stack>

      <AccountFormDialog
        open={openNew}
        onClose={() => setOpenNew(false)}
        initial={{ type: newType }}
      />

      <AccountFormDialog
        open={!!editAcc}
        onClose={() => setEditAcc(null)}
        initial={editAcc}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={closeToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={closeToast}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}