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
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";

import { selectHideValues } from "../store/uiSlice";

import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

import {
  fetchAllTransactionsThunk,
  selectTransactionsUi,
} from "../store/transactionsSlice";

import {
  fetchAccountsThunk,
  selectAccounts,
  createAccountThunk,
  updateAccountThunk,
  deleteAccountThunk
} from "../store/accountsSlice.js";


// visual simples, apple-like (clean)
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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"),
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
  const v = Number(tx?.amount || 0);
  if (!Number.isFinite(v)) return 0;
  // income soma, expense subtrai
  return tx?.direction === "income" ? v : -v;
}

function calcAccountBalance(account, txns, accounts) {
  const opening = Number(account?.openingBalance || 0);
  const accId = String(account?.id || "");

  const sum = (txns || [])
    .filter((t) => {
      const tid = String(resolveTxnAccountId(t, accounts) || "");
      if (!tid || tid !== accId) return false;

      // 🔒 regra só para conta corrente
      if (String(account?.type) !== "checking") return true;

      const st = String(t?.status || "").toLowerCase();

      // ✅ somente transações efetivamente pagas entram no saldo
      return st === "paid";
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

/** resolve txns antigas com cardId ("xp") para accounts novas (legado) */
function resolveTxnAccountId(tx, accounts) {
  if (tx?.accountId) return tx.accountId;

  const legacy = tx?.cardId; // "xp" | "nubank" | "porto"
  if (!legacy) return "";

  const found = (accounts || []).find(
    (a) => a?.type === "credit_card" && String(a?.externalId || a?.external_id || "").endsWith(`_${legacy}`)
  );
  return found?.id || "";
}

function isLikelyInvoicePayment(tx) {
  const k = String(tx?.kind || "").toLowerCase();
  if (k.includes("bill_payment") || k.includes("invoice_payment") || k === "payment") return true;

  const desc = String(tx?.description || tx?.memo || tx?.title || "").toLowerCase();
  if (desc.includes("pagamento de fatura") || desc.includes("pgto fatura") || desc.includes("fatura paga")) return true;

  return false;
}

function isInvoiceLike(tx) {
  // se em algum lugar você marca invoice/bill no txn, blinda aqui
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

    // ✅ só transações (não invoices/bills)
    if (isInvoiceLike(t)) continue;

    // ✅ pagamento de fatura nunca consome limite
    if (isLikelyInvoicePayment(t)) continue;

    // ✅ pago NÃO entra no em aberto
    if (String(t?.status || "").toLowerCase() === "paid") continue;

    // ✅ só despesa consome limite (income é estorno/credito)
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

function usedCreditAmount(tx) {
  const v = Number(tx?.amount || 0);
  if (!Number.isFinite(v)) return 0;

  // estorno / crédito (income) reduz o “usado”
  if (tx?.direction === "income") return -v;
  return v;
}

function AccountFormDialog({ open, onClose, initial }) {
  const dispatch = useDispatch();
  const isEdit = !!initial?.id;
  const hideValues = useSelector(selectHideValues);
  const maskMoney = (formatted) => (hideValues ? "••••" : formatted);

  // estado base
  const [type, setType] = useState(initial?.type || "credit_card");
  const [name, setName] = useState(initial?.name || "");
  const [externalId, setExternalId] = useState(initial?.externalId || initial?.external_id || "");
  const [openingBalance, setOpeningBalance] = useState(String(initial?.openingBalance ?? 0));

  // cor via picker + alpha
  const [hexColor, setHexColor] = useState(rgbaToHex(initial?.color || "rgba(0,0,0,0.08)"));
  const [alpha, setAlpha] = useState(rgbaToAlpha(initial?.color || "rgba(0,0,0,0.08)"));
  const color = useMemo(() => hexToRgba(hexColor, alpha), [hexColor, alpha]);

  // cartão
  const [limit, setLimit] = useState(initial?.type === "credit_card" ? String(initial?.limit ?? 0) : "");
  const [cutoffDay, setCutoffDay] = useState(
    initial?.type === "credit_card" ? String(initial?.statement?.cutoffDay ?? 1) : "1"
  );
  const [dueDay, setDueDay] = useState(
    initial?.type === "credit_card" ? String(initial?.statement?.dueDay ?? 10) : "10"
  );

  useEffect(() => {
    const init = initial || null;
    setType(init?.type || "credit_card");
    setName(init?.name || "");
    setExternalId(init?.externalId || init?.external_id || "");
    setOpeningBalance(String(init?.openingBalance ?? 0));
    setHexColor(rgbaToHex(init?.color || "rgba(0,0,0,0.08)"));
    setAlpha(rgbaToAlpha(init?.color || "rgba(0,0,0,0.08)"));
    setLimit(init?.type === "credit_card" ? String(init?.limit ?? 0) : "");
    setCutoffDay(init?.type === "credit_card" ? String(init?.statement?.cutoffDay ?? 1) : "1");
    setDueDay(init?.type === "credit_card" ? String(init?.statement?.dueDay ?? 10) : "10");
  }, [initial, open]);

  function reset() {
    const init = initial || null;
    setType(init?.type || "credit_card");
    setName(init?.name || "");
    setExternalId(init?.externalId || init?.external_id || "");
    setOpeningBalance(String(init?.openingBalance ?? 0));
    setHexColor(rgbaToHex(init?.color || "rgba(0,0,0,0.08)"));
    setAlpha(rgbaToAlpha(init?.color || "rgba(0,0,0,0.08)"));
    setLimit(init?.type === "credit_card" ? String(init?.limit ?? 0) : "");
    setCutoffDay(init?.type === "credit_card" ? String(init?.statement?.cutoffDay ?? 1) : "1");
    setDueDay(init?.type === "credit_card" ? String(init?.statement?.dueDay ?? 10) : "10");
  }

  function handleClose() {
    reset();
    onClose();
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

  function handleSave() {
    const err = validate();
    if (err) return alert(err);

    const nm = (name || "").trim();

    const autoExternal =
      externalId?.trim() ||
      `acc_${type === "credit_card" ? "cc" : "checking"}_${slugify(nm)}`; // ex: acc_cc_nubank

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
      payload.statement = { cutoffDay: Number(cutoffDay), dueDay: Number(dueDay) };
    } else {
      payload.limit = null;
      payload.statement = null;
    }

    if (isEdit) dispatch(updateAccountThunk({ id: initial.id, patch: payload }));
    else dispatch(createAccountThunk(payload));

    handleClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>{isEdit ? "Editar conta" : "Nova conta"}</DialogTitle>

      <DialogContent>
        <Stack spacing={1.4} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1.2} alignItems="flex-start">
            <TextField label="Tipo" select value={type} onChange={(e) => setType(e.target.value)} fullWidth>
              <MenuItem value="credit_card">Cartão de crédito</MenuItem>
              <MenuItem value="checking">Conta corrente</MenuItem>
            </TextField>

            {/* cor */}
            <Stack spacing={0.8} sx={{ minWidth: 240, flex: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 800 }}>
                Cor
              </Typography>

              <Stack direction="row" spacing={1.2} alignItems="center">
                <TextField
                  type="color"
                  value={hexColor}
                  onChange={(e) => setHexColor(e.target.value)}
                  sx={{ width: 64, "& input": { padding: 0, height: 44, cursor: "pointer" } }}
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

              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {maskMoney(color)}
              </Typography>
            </Stack>
          </Stack>

          <TextField
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            placeholder="Ex: Porto, Nubank, Conta Corrente"
          />

          <TextField
            label="External ID (opcional)"
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            fullWidth
            placeholder='Ex: "acc_cc_nubank" (se vazio, gera automático)'
          />

          {type === "credit_card" ? (
            <Stack spacing={1.2}>
              <TextField
                label="Limite (R$)"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                inputMode="decimal"
                fullWidth
              />
              <Stack direction="row" spacing={1.2}>
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
                * Corte e vencimento entre 1 e 28 (evita problemas em meses curtos).
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Conta corrente não usa fatura (sem corte/vencimento).
            </Typography>
          )}

          {type === "checking" ? (
            <Stack spacing={1.0}>
              <TextField
                label="Saldo inicial (R$)"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                inputMode="decimal"
                fullWidth
              />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Esse saldo é a base para calcular o saldo atual.
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined">
          Cancelar
        </Button>
        <Button onClick={handleSave} variant="contained" sx={{ fontWeight: 900 }}>
          Salvar
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
  const maskMoney = (formatted) => (hideValues ? "••••" : formatted);

  useEffect(() => {
    dispatch(fetchAccountsThunk());
    dispatch(fetchAllTransactionsThunk());
  }, [dispatch]);


  const [openNew, setOpenNew] = useState(false);
  const [editAcc, setEditAcc] = useState(null);
  const [newType, setNewType] = useState("credit_card"); // 👈 novo


  const activeCount = useMemo(() => (accounts || []).filter((a) => safeActive(a)).length, [accounts]);
  const cardsOnly = useMemo(() => (accounts || []).filter((a) => a.type === "credit_card"), [accounts]);
  const checkingOnly = useMemo(() => (accounts || []).filter((a) => a.type === "checking"), [accounts]);

  // Totais cartões (ainda usando txns do front, mas sem quebrar)
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
          {
            cardsOnly.length > 0 && checkingOnly.length > 0 && (
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

            )
          }

        </Stack>

        <Divider />

        {/* Cartões */}
        {
          cardsOnly.length > 0 && (

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

          )
        }
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
                          <Stack direction="row" spacing={1} alignItems="center">
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
                          onClick={() => dispatch(updateAccountThunk({ id: a.id, patch: { ...a, active: !safeActive(a) } }))}
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

        {/* Correntes */}
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
                        <Typography sx={{ fontSize: 32, lineHeight: "32px" }}>🏦</Typography>

                        <Stack spacing={0.6}>
                          <Stack direction="row" spacing={1} alignItems="center">
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
            }))}
        </Stack>
      </Stack>

      {/* dialog new */}
      <AccountFormDialog
        open={openNew}
        onClose={() => setOpenNew(false)}
        initial={{ type: newType }} // 👈 pré-seleciona o tipo
      />


      {/* dialog edit */}
      <AccountFormDialog open={!!editAcc} onClose={() => setEditAcc(null)} initial={editAcc} />
    </Box>
  );
}
