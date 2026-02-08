// src/components/TransactionsGrid.jsx
import React, { useMemo, useState, useCallback } from "react";
import {
  Box,
  Stack,
  TextField,
  MenuItem,
  Chip,
  Typography,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";

import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";

import { useDispatch, useSelector } from "react-redux";
import { categories } from "../data/mockCategories";
import { formatBRL } from "../utils/money";
import { formatDateBR, formatMonthBR } from "../utils/dateBR";

// ✅ agora existem no slice (você já adicionou)
import { updateTransaction, removeTransaction } from "../store/financeSlice";

// =========================
// Helpers: BRL input/output
// =========================

function sanitizeBrlInput(raw) {
  // mantém apenas dígitos, vírgula, ponto e sinal
  return String(raw ?? "")
    .replace(/\s+/g, "")
    .replace(/[^0-9,\.\-]/g, "");
}

function parseBrlToNumber(raw) {
  // Aceita: "1.234,56" | "1234,56" | "1234.56" | "1,23" | "10" etc.
  const s0 = sanitizeBrlInput(raw);
  if (!s0) return NaN;

  // Se tem vírgula, assume vírgula como decimal e remove pontos (milhar)
  if (s0.includes(",")) {
    const s = s0.replace(/\./g, "").replace(/,/g, ".");
    return Number(s);
  }

  // Sem vírgula: permite decimal com ponto
  return Number(s0);
}

function formatNumberToBrlInput(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  // converte 1234.5 -> "1234,50" (sem separador de milhar para facilitar edição)
  return v.toFixed(2).replace(".", ",");
}

// =========================
// Helpers: direção (entrada/saída)
// =========================

function getTxnDirection(row) {
  const r = getRowShape(row) || {};
  const d = String(r.direction || r.flow || r.type || r.movement || "")
    .trim()
    .toLowerCase();

  if (["in", "entrada", "income", "receita", "credit"].includes(d)) return "in";
  if (["out", "saida", "saída", "expense", "despesa", "debit"].includes(d)) return "out";

  // fallback: se amount for negativo, é saída
  const amt = Number(r.amount);
  if (Number.isFinite(amt) && amt < 0) return "out";

  // padrão do app (normalmente a maioria é despesa)
  return "out";
}

function isoFromInput(v) {
  return v || "";
}

function inDateRange(dateISO, fromISO, toISO) {
  if (!dateISO) return false;
  if (fromISO && dateISO < fromISO) return false;
  if (toISO && dateISO > toISO) return false;
  return true;
}

function getRowShape(row) {
  return row?.instance ? row.instance : row;
}

function getInstallment(row) {
  const r = getRowShape(row);
  return r?.installment || null;
}

function safeAccountActive(a) {
  // ✅ se active for undefined, consideramos ativo
  return a?.active !== false;
}

function resolveAccountId(row, accounts) {
  const r = getRowShape(row);

  // já veio certo (conta corrente / novos lançamentos)
  if (r?.accountId) return r.accountId;

  const legacy = r?.cardId; // "nubank" | "xp" | "porto"
  if (!legacy) return "";

  // 1) padrão atual do seu mock: acc_cc_${cardId}
  const byPrefix = accounts.find((a) => a?.id === `acc_cc_${legacy}`);
  if (byPrefix) return byPrefix.id;

  // 2) se algum dia você usar id = "xp"
  const direct = accounts.find((a) => a?.id === legacy);
  if (direct) return direct.id;

  // 3) se algum dia você adicionar legacyCardId
  const found = accounts.find((a) => a?.legacyCardId === legacy);
  return found?.id || "";
}




function AccountChip({ accountId, accountsById }) {
  const acc = accountId ? accountsById[accountId] : null;

  if (!acc) {
    return (
      <Chip
        size="small"
        variant="outlined"
        label="—"
        sx={{ fontWeight: 850 }}
      />
    );
  }

  const iconEmoji = acc.type === "credit_card" ? "💳" : "🏦";

  return (
    <Chip
      size="small"
      variant="outlined"
      icon={
        <span
          style={{
            fontSize: 14,
            lineHeight: 1,
            marginLeft: 4,
          }}
        >
          {iconEmoji}
        </span>
      }
      label={acc.name}
      sx={{
        fontWeight: 850,
        borderRadius: 999,
        borderColor: "rgba(0,0,0,0.10)",
        backgroundColor: acc.color || "rgba(0,0,0,0.04)",
        "& .MuiChip-icon": {
          marginLeft: "6px",
          marginRight: "-4px",
        },
        "& .MuiChip-label": {
          fontWeight: 850,
          marginLeft: '10px'
        },
      }}
    />
  );
}


function EditTxnDialog({ open, onClose, txn, accounts, onSave, defaultAccountId }) {
  const t = txn || {};

  const [purchaseDate, setPurchaseDate] = useState(t.purchaseDate || "");
  const [chargeDate, setChargeDate] = useState(t.chargeDate || "");
  const [invoiceMonth, setInvoiceMonth] = useState(t.invoiceMonth || "");
  const [accountId, setAccountId] = useState(t.accountId || "");
  const [merchant, setMerchant] = useState(t.merchant || "");
  const [description, setDescription] = useState(t.description || "");
  const [categoryId, setCategoryId] = useState(t.categoryId || "");
  const [kind, setKind] = useState(t.kind || "one_off");
  const [status, setStatus] = useState(t.status || "previsto");
  const [amount, setAmount] = useState(formatNumberToBrlInput(t.amount ?? ""));
  const [err, setErr] = useState("");


  React.useEffect(() => {
    const x = txn || {};
    setPurchaseDate(x.purchaseDate || "");
    setChargeDate(x.chargeDate || "");
    setInvoiceMonth(x.invoiceMonth || "");
    setAccountId(x.accountId || "");
    setMerchant(x.merchant || "");
    setDescription(x.description || "");
    setCategoryId(x.categoryId || "");
    setKind(x.kind || "one_off");
    setStatus(x.status || "previsto");
    setAmount(formatNumberToBrlInput(x.amount ?? ""));
    setErr("");
    // se tiver accountId explícito no lançamento, respeita; senão usa o default resolvido
    setAccountId(x.accountId || defaultAccountId || "");
  }, [txn, defaultAccountId]);

  function validate() {
    if (!merchant.trim()) return "Preencha a Loja.";
    if (!description.trim()) return "Preencha a Descrição.";
    const v = parseBrlToNumber(amount);
    if (!Number.isFinite(v) || v <= 0) return "Informe um valor válido.";
    return "";
  }

  function handleSave() {
    const e = validate();
    if (e) return setErr(e);

    const v = parseBrlToNumber(amount);

    onSave({
      ...t,
      purchaseDate,
      chargeDate,
      invoiceMonth,
      accountId: accountId || null,
      merchant: merchant.trim(),
      description: description.trim(),
      categoryId,
      kind,
      status,
      amount: Number(v),
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>Editar lançamento</DialogTitle>
      <DialogContent>
        <Stack spacing={1.2} sx={{ mt: 1 }}>
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
              onChange={(e) => setAccountId(e.target.value)}
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

          <TextField label="Loja" value={merchant} onChange={(e) => setMerchant(e.target.value)} fullWidth />

          <TextField
            label="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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

            <TextField label="Tipo" select value={kind} onChange={(e) => setKind(e.target.value)} fullWidth>
              <MenuItem value="one_off">Avulso</MenuItem>
              <MenuItem value="recurring">Mensal</MenuItem>
              <MenuItem value="installment">Parcela</MenuItem>
            </TextField>
          </Stack>

          <Stack direction="row" spacing={1.2}>
            <TextField label="Status" select value={status} onChange={(e) => setStatus(e.target.value)} fullWidth>
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
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Parcelamento: <b>{t.installment.current}/{t.installment.total}</b>
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined">
          Cancelar
        </Button>
        <Button onClick={handleSave} variant="contained" sx={{ fontWeight: 900 }}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function TransactionsGrid({ rows, month, onMonthFilterChange }) {
  const dispatch = useDispatch();
  const safeRows = Array.isArray(rows) ? rows : [];

  const accounts = useSelector((s) => s.accounts?.accounts || []);

  const status_list = ['previsto', 'confirmado', 'pago', 'atraso']
  const STATUS_META = {
    previsto: {
      label: "Previsto",
      color: "default",
      sx: { bgcolor: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.70)" }
    },
    confirmado: {
      label: "Confirmado",
      color: "success",
      sx: { bgcolor: "rgba(46,125,50,0.12)", color: "#1b5e20" },
    },
    pago: {
      label: "Pago",
      color: "primary",
      sx: { bgcolor: "rgba(25,118,210,0.14)", color: "#0d47a1" },
    },
    atraso: {
      label: "Atraso",
      color: "error",
      sx: { bgcolor: "rgba(211,47,47,0.14)", color: "#b71c1c" },
    },
  };





  const accountsById = useMemo(() => {
    const m = {};
    for (const a of accounts) m[a.id] = a;
    return m;
  }, [accounts]);

  // ✅ CSS dinâmico por conta (linhas)
  const accountRowSx = useMemo(() => {
    const sx = {};
    for (const a of accounts) {
      const id = a?.id;
      if (!id) continue;
      const color = a.color || "rgba(0,0,0,0.04)";
      // row background clarinho (apple-like)
      sx[`& .acc-${id}`] = { backgroundColor: color };
      sx[`& .acc-${id}:hover`] = { backgroundColor: color };
      sx[`& .acc-${id}.Mui-selected`] = { backgroundColor: color };
      sx[`& .acc-${id}.Mui-selected:hover`] = { backgroundColor: color };
    }
    return sx;
  }, [accounts]);

  // filtros
  const [purchaseFrom, setPurchaseFrom] = useState("");
  const [purchaseTo, setPurchaseTo] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [merchantQuery, setMerchantQuery] = useState("");
  const [descriptionQuery, setDescriptionQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [remainingMax, setRemainingMax] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");

  // editar
  const [editOpen, setEditOpen] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);

  const MONTH_ALL = "__ALL__";
  const monthOptions = useMemo(() => {
    return Array.from(new Set(safeRows.map((r) => r?.invoiceMonth).filter(Boolean))).sort();
  }, [safeRows]);

  const merchantQ = merchantQuery.trim().toLowerCase();
  const descQ = descriptionQuery.trim().toLowerCase();

  const handleEdit = useCallback((row) => {
    const txn = getRowShape(row);
    setSelectedTxn(txn);
    setEditOpen(true);
  }, []);

  const handleDelete = useCallback(
    (row) => {
      const txn = getRowShape(row);
      const ok = window.confirm(`Excluir lançamento "${txn?.merchant || "—"}" (${formatBRL(txn?.amount)})?`);
      if (!ok) return;
      dispatch(removeTransaction(txn.id));
    },
    [dispatch]
  );

  const handleSaveEdit = useCallback(
    (patch) => {
      // ✅ financeSlice.updateTransaction espera { id, patch }
      dispatch(updateTransaction({ id: patch?.id, patch }));
      setEditOpen(false);
      setSelectedTxn(null);
    },
    [dispatch]
  );

  const filteredRows = useMemo(() => {
    return safeRows.filter((r) => {
      if (!r) return false;

      if (month && r.invoiceMonth !== month) return false;

      if ((purchaseFrom || purchaseTo) && !inDateRange(r.purchaseDate, purchaseFrom, purchaseTo)) return false;

      if (accountFilter) {
        const accId = resolveAccountId(r, accounts);
        if ((accId || "") !== accountFilter) return false;
      }


      if (merchantQ) {
        const m = String(r.merchant || "").toLowerCase();
        if (!m.includes(merchantQ)) return false;
      }

      if (descQ) {
        const d = String(r.description || "").toLowerCase();
        if (!d.includes(descQ)) return false;
      }

      if (kindFilter && r.kind !== kindFilter) return false;

      if (categoryFilter && r.categoryId !== categoryFilter) return false;

      if (statusFilter && r.status !== statusFilter) return false;

      if (tipoFilter && getTxnDirection(r) !== tipoFilter) return false;
      const getTipo = getTxnDirection(r)
      console.log('get', getTipo)
      console.log('tipoFilter', tipoFilter)
      if (remainingMax !== "") {
        const inst = getInstallment(r);
        if (!inst || typeof inst.current !== "number" || typeof inst.total !== "number") return false;

        const remaining = inst.total - inst.current;
        const max = Number(remainingMax);
        if (!Number.isFinite(max)) return false;
        if (remaining > max) return false;
      }

      return true;
    });
  }, [
    safeRows,
    month,
    purchaseFrom,
    purchaseTo,
    accountFilter,
    merchantQ,
    descQ,
    kindFilter,
    categoryFilter,
    remainingMax,
    statusFilter,
    tipoFilter
  ]);

  const filteredTotal = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + Number(r?.amount || 0), 0);
  }, [filteredRows]);

  const columns = useMemo(
    () => [
      {
        field: "flow",
        headerName: "Tipo",
        width: 46,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => {
          const row = getRowShape(params?.row);
          const dir = getTxnDirection(row);
          const isIn = dir === "in";
          return (
            <Tooltip title={isIn ? "Entrada" : "Saída"}>
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  marginTop: '4px',
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: isIn ? "rgba(46,125,50,0.12)" : "rgba(211,47,47,0.12)",
                  color: isIn ? "#1b5e20" : "#b71c1c",
                }}
              >
                {isIn ? (
                  <ArrowUpwardRoundedIcon fontSize="small" />
                ) : (
                  <ArrowDownwardRoundedIcon fontSize="small" />
                )}
              </Box>
            </Tooltip>
          );
        },
      },
      {
        field: "purchaseDate",
        headerName: "Data Compra",
        width: 120,
        renderCell: (params) => formatDateBR(params?.row?.purchaseDate),
      },
      {
        field: "chargeDate",
        headerName: "Data Cobrança",
        width: 120,
        renderCell: (params) => formatDateBR(params?.row?.chargeDate),
      },
      {
        field: "invoiceMonth",
        headerName: "Mês Fatura",
        width: 100,
        renderCell: (params) => formatMonthBR(params?.row?.invoiceMonth),
      },
      {
        field: "accountBadge",
        headerName: "Conta",
        width: 180,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const accId = resolveAccountId(params?.row, accounts);
          return <AccountChip accountId={accId} accountsById={accountsById} />;
        },
      },
      { field: "merchant", headerName: "Loja", flex: 1, minWidth: 140 },
      { field: "description", headerName: "Descrição", flex: 1, minWidth: 240 },
      {
        field: "kind",
        headerName: "Tipo",
        width: 120,
        renderCell: (p) => {
          const map = {
            one_off: { label: "Avulso", variant: "outlined" },
            recurring: { label: "Mensal", variant: "outlined" },
            installment: { label: "Parcela", variant: "filled" },
          };
          const info = map[p?.value] || { label: p?.value || "—", variant: "outlined" };
          return <Chip size="small" label={info.label} variant={info.variant} />;
        },
      },
      {
        field: "categoryId",
        headerName: "Categoria",
        width: 120,
        renderCell: (params) => {
          const row = getRowShape(params?.row);
          const v = row?.categoryId;
          return categories.find((c) => c.id === v)?.name || "—";
        },
      },
      {
        field: "installment",
        headerName: "Parcela",
        width: 100,
        renderCell: (params) => {
          const row = getRowShape(params?.row);
          const inst = row?.installment;
          if (!inst) return "—";
          return `${inst.current ?? "—"}/${inst.total ?? "—"}`;
        },
      },
      {
        field: "amount",
        headerName: "Valor",
        width: 110,
        align: "right",
        headerAlign: "right",
        renderCell: (params) => {
          const row = getRowShape(params?.row);
          const dir = getTxnDirection(row);
          const isIn = dir === "in";
          const v = Number(row?.amount ?? 0);
          const abs = Math.abs(v);

          return (
            <Box
              sx={{
                width: "100%",
                textAlign: "right",
                fontWeight: 900,
                color: isIn ? "#1b5e20" : "#b71c1c",
              }}
            >
              {formatBRL(abs)}
            </Box>
          );
        },
      },
      {
        field: "status",
        headerName: "Status",
        width: 130,
        sortable: false,
        renderCell: (params) => {
          const row = getRowShape(params?.row);
          const current = row?.status || "previsto";
          const meta = STATUS_META[current] || STATUS_META.previsto;

          return (
            <TextField
              select
              size="small"
              value={current}
              onChange={(e) =>
                dispatch(
                  updateTransaction({
                    id: row.id,
                    patch: { status: e.target.value },
                  })
                )
              }
              SelectProps={{ displayEmpty: true }}
              sx={{
                minWidth: 110,
                "& .MuiOutlinedInput-root": {
                  height: 25,
                  marginTop: '5px',
                  fontSize: 13,
                  bgcolor: meta.sx.bgcolor,
                  color: meta.sx.color,
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  border: "none",
                },
              }}
            >
              {Object.entries(STATUS_META).map(([value, m]) => (
                <MenuItem key={value} value={value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
          );
        },
      },
      {
        field: "actions",
        headerName: "Opções",
        width: 90,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        align: "right",
        headerAlign: "right",
        renderCell: (params) => (
          <Stack direction="row" spacing={0.2} justifyContent="flex-end" sx={{ width: "100%", marginTop: '2px' }}>
            <Tooltip title="Editar">
              <IconButton size="small" onClick={() => handleEdit(params?.row)}>
                <EditRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Excluir">
              <IconButton size="small" onClick={() => handleDelete(params?.row)}>
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [accounts, accountsById, dispatch, handleEdit, handleDelete]
  );

  const monthSelectValue = month === "" || month == null ? MONTH_ALL : month;

  return (
    <Box>
      <Stack spacing={1.2} sx={{ mb: 1.2 }}>
        <Stack spacing={0.9}>
          {/* 🔹 LINHA 1 — PERÍODO / CONTA */}
          <Stack
            direction="row"
            spacing={0.9}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
            alignItems="baseline"
          >
            <TextField
              size="small"
              select
              label="Mês"
              value={monthSelectValue}
              onChange={(e) => {
                const v = e.target.value;
                onMonthFilterChange(v === MONTH_ALL ? "" : v);
              }}
              sx={{ minWidth: 132, width: { xs: "100%", sm: 140 } }}
            >
              <MenuItem value={MONTH_ALL}>Todos</MenuItem>
              <Divider sx={{ my: 0.5 }} />

              {monthOptions.map((ym) => (
                <MenuItem key={ym} value={ym}>
                  {formatMonthBR(ym)}
                </MenuItem>
              ))}
            </TextField>


            <TextField
              size="small"
              label="De"
              type="date"
              value={purchaseFrom}
              onChange={(e) => setPurchaseFrom(isoFromInput(e.target.value))}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 132, width: { xs: "49%", sm: 145 } }}
            />

            <TextField
              size="small"
              label="Até"
              type="date"
              value={purchaseTo}
              onChange={(e) => setPurchaseTo(isoFromInput(e.target.value))}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 132, width: { xs: "49%", sm: 145 } }}
            />

            <TextField
              size="small"
              select
              label="Conta"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              sx={{ minWidth: 170, width: { xs: "100%", sm: 200 } }}
            >
              <MenuItem value="">Todas</MenuItem>
              {accounts
                .filter(safeAccountActive)
                .map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.type === "credit_card" ? "💳 " : "🏦 "}
                    {a.name}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              size="small"
              select
              label="Tipo"
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              sx={{ minWidth: 170, width: { xs: "100%", sm: 200 } }}
            >
              <MenuItem value="">Todas</MenuItem>
              <MenuItem value="out">Saídas</MenuItem>
              <MenuItem value="in">Entradas</MenuItem>
            </TextField>
          </Stack>

          {/* 🔹 LINHA 2 — FILTROS AVANÇADOS */}
          <Stack
            direction="row"
            spacing={0.9}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
            alignItems="baseline"
          >
            <TextField
              size="small"
              label="Loja"
              value={merchantQuery}
              onChange={(e) => setMerchantQuery(e.target.value)}
              sx={{ minWidth: 160, width: { xs: "100%", sm: 190 } }}
              placeholder="Buscar..."
            />

            <TextField
              size="small"
              label="Descrição"
              value={descriptionQuery}
              onChange={(e) => setDescriptionQuery(e.target.value)}
              sx={{ minWidth: 180, width: { xs: "100%", sm: 220 } }}
              placeholder="Ex: Mercado, assinatura..."
            />

            <TextField
              size="small"
              select
              label="Tipo"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              sx={{ minWidth: 120, width: { xs: "48%", sm: 140 } }}
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="one_off">Avulso</MenuItem>
              <MenuItem value="recurring">Mensal</MenuItem>
              <MenuItem value="installment">Parcela</MenuItem>
            </TextField>

            <TextField
              size="small"
              select
              label="Categoria"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              sx={{ minWidth: 140, width: { xs: "48%", sm: 170 } }}
            >
              <MenuItem value="">Todas</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              size="small"
              select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ minWidth: 140, width: { xs: "48%", sm: 170 } }}
            >
              <MenuItem value="">Todas</MenuItem>
              {status_list.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              size="small"
              select
              label="Parcelas"
              value={remainingMax}
              onChange={(e) => setRemainingMax(e.target.value)}
              sx={{ minWidth: 170, width: { xs: "100%", sm: 210 } }}
            >
              <MenuItem value="">Todas</MenuItem>
              <MenuItem value="0">Somente última</MenuItem>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <MenuItem key={n} value={String(n)}>
                  Faltam {n} ou menos
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>


        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Itens: <b>{filteredRows.length}</b>
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 900 }}>
            Total exibido: {formatBRL(filteredTotal)}
          </Typography>
        </Stack>

        <Divider />
      </Stack>

      <Box sx={{ height: 560, width: "100%" }}>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          getRowId={(r) => r?.id}
          // rowHeight={60}   // padrão é ~52
          // columnHeaderHeight={70}
          // density="standard"
          disableRowSelectionOnClick
          getRowClassName={(params) =>
            params.indexRelativeToCurrentPage % 2 === 0 ? "row-even" : "row-odd"
          }
          sx={{
            border: "none",
            "& .MuiDataGrid-columnHeaders": {
              borderBottom: "1px solid rgba(0,0,0,0.08)",
            },
            "& .MuiDataGrid-cell": {
              borderBottom: "1px solid rgba(0,0,0,0.05)",
            },

            /* ✅ zebra */
            "& .row-even": {
              backgroundColor: "rgba(0,0,0,0.041)",
            },
            "& .row-odd": {
              backgroundColor: "transparent",
            },
          }}
        />
      </Box>

      <EditTxnDialog
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelectedTxn(null);
        }}
        txn={selectedTxn}
        accounts={accounts}
        defaultAccountId={resolveAccountId(selectedTxn, accounts)}
        onSave={handleSaveEdit}
      />
    </Box>
  );
}
