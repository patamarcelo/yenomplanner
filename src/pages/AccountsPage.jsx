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
import {
  addAccount,
  updateAccount,
  removeAccount,
  setAccountActive,
  selectAccounts,
} from "../store/accountsSlice";

import { selectHideValues } from "../store/uiSlice";

// visual simples, apple-like (clean)
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

function calcAccountBalance(account, txns) {
  const opening = Number(account?.openingBalance || 0);
  const sum = (txns || [])
    .filter((t) => t?.accountId === account?.id)
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


function AccountFormDialog({ open, onClose, initial }) {
  const dispatch = useDispatch();
  const isEdit = !!initial?.id;
  const hideValues = useSelector(selectHideValues);
  const maskMoney = (formatted) => (hideValues ? "••••" : formatted);

  // estado base
  const [type, setType] = useState(initial?.type || "credit_card");
  const [name, setName] = useState(initial?.name || "");
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

  // quando abrir para editar outro item, sincroniza campos
  useEffect(() => {
    const init = initial || null;
    setType(init?.type || "credit_card");
    setName(init?.name || "");
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

    const payload = {
      type,
      name: (name || "").trim(),
      color, // ✅ sempre rgba gerado do picker
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

    if (isEdit) dispatch(updateAccount({ id: initial.id, patch: payload }));
    else dispatch(addAccount(payload));

    handleClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>{isEdit ? "Editar conta" : "Nova conta"}</DialogTitle>

      <DialogContent>
        <Stack spacing={1.4} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1.2} alignItems="flex-start">
            <TextField
              label="Tipo"
              select
              value={type}
              onChange={(e) => setType(e.target.value)}
              fullWidth
            >
              <MenuItem value="credit_card">Cartão de crédito</MenuItem>
              <MenuItem value="checking">Conta corrente</MenuItem>
            </TextField>

            {/* cor (compacto e bonito) */}
            <Stack spacing={0.8} sx={{ minWidth: 240, flex: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 800 }}>
                Cor
              </Typography>

              <Stack direction="row" spacing={1.2} alignItems="center">
                <TextField
                  type="color"
                  value={hexColor}
                  onChange={(e) => setHexColor(e.target.value)}
                  sx={{
                    width: 64,
                    "& input": { padding: 0, height: 44, cursor: "pointer" },
                  }}
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
                {color}
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

/** resolve txns antigas com cardId ("xp") para accounts novas com id tipo "acc_cc_xp" */
function resolveTxnAccountId(tx, accounts) {
  if (tx?.accountId) return tx.accountId;

  const legacy = tx?.cardId; // "xp" | "nubank" | "porto"
  if (!legacy) return "";

  // tenta match por sufixo (acc_cc_xp)
  const found = (accounts || []).find(
    (a) => a?.type === "credit_card" && String(a.id || "").endsWith(`_${legacy}`)
  );
  return found?.id || "";
}

function usedCreditAmount(tx) {
  const v = Number(tx?.amount || 0);
  if (!Number.isFinite(v)) return 0;

  // estorno / crédito (income) reduz o “usado”
  if (tx?.direction === "income") return -v;
  return v;
}

export default function AccountsPage() {
  const dispatch = useDispatch();
  const accounts = useSelector(selectAccounts);
  const txns = useSelector((s) => s.finance.txns || []);

  const [openNew, setOpenNew] = useState(false);
  const [editAcc, setEditAcc] = useState(null);

  const activeCount = useMemo(() => (accounts || []).filter((a) => safeActive(a)).length, [accounts]);
  const cardsOnly = useMemo(() => (accounts || []).filter((a) => a.type === "credit_card"), [accounts]);
  const checkingOnly = useMemo(() => (accounts || []).filter((a) => a.type === "checking"), [accounts]);

  const hideValues = useSelector(selectHideValues);
  const maskMoney = (formatted) => (hideValues ? "••••" : formatted);

  // Totais cartões
  const { totalCardLimit, totalCardOpen, totalCardAvailable } = useMemo(() => {
    const activeCards = (cardsOnly || []).filter((a) => safeActive(a));
    const limitTotal = activeCards.reduce((acc, a) => acc + Number(a?.limit || 0), 0);

    let usedOpen = 0;
    for (const t of txns || []) {
      const accId = resolveTxnAccountId(t, accounts);
      if (!accId) continue;

      const accObj = (accounts || []).find((a) => a?.id === accId);
      if (!accObj || accObj.type !== "credit_card") continue;
      if (accObj.active === false) continue;

      if (t?.status === "pago") continue; // em aberto = não pago
      usedOpen += usedCreditAmount(t);
    }

    return {
      totalCardLimit: limitTotal,
      totalCardOpen: usedOpen,
      totalCardAvailable: limitTotal - usedOpen,
    };
  }, [accounts, cardsOnly, txns]);

  // Total saldo contas correntes
  const totalCheckingBalance = useMemo(() => {
    return (checkingOnly || []).reduce((acc, a) => {
      const balance = calcAccountBalance(a, txns);
      return acc + Number(balance || 0);
    }, 0);
  }, [checkingOnly, txns]);

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

          <Button variant="contained" sx={{ fontWeight: 900 }} onClick={() => setOpenNew(true)}>
            + Nova conta
          </Button>
        </Stack>

        <Divider />

        {/* Cartões */}
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

        <Stack spacing={1.2}>
          {cardsOnly.map((a) => (
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
                      </Typography>

                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Corte: dia <b>{a?.statement?.cutoffDay ?? "—"}</b> • Vencimento: dia{" "}
                        <b>{a?.statement?.dueDay ?? "—"}</b>
                      </Typography>
                    </Stack>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => dispatch(setAccountActive({ id: a.id, active: !safeActive(a) }))}
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
                        const ok = window.confirm(
                          `Remover "${a.name}"? (isso não apaga lançamentos já existentes)`
                        );
                        if (ok) dispatch(removeAccount(a.id));
                      }}
                    >
                      Remover
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
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
          {checkingOnly.map((a) => {
            const balance = calcAccountBalance(a, txns);

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
                      </Stack>
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => dispatch(setAccountActive({ id: a.id, active: !safeActive(a) }))}
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
                          const ok = window.confirm(
                            `Remover "${a.name}"? (isso não apaga lançamentos já existentes)`
                          );
                          if (ok) dispatch(removeAccount(a.id));
                        }}
                      >
                        Remover
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Stack>

      {/* dialog new */}
      <AccountFormDialog open={openNew} onClose={() => setOpenNew(false)} initial={null} />

      {/* dialog edit */}
      <AccountFormDialog open={!!editAcc} onClose={() => setEditAcc(null)} initial={editAcc} />
    </Box>
  );
}
