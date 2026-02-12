// src/components/TransactionsGrid.jsx
import React, { useMemo, useState, useCallback, useRef } from "react";
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

import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";

import { useDispatch, useSelector } from "react-redux";
import { formatBRL } from "../utils/money";
import { formatDateBR, formatMonthBR } from "../utils/dateBR";

import { patchTransactionThunk, deleteTransactionThunk } from "../store/transactionsSlice";
import { selectCategories } from "../store/categoriesSlice";
import SpinnerPage from "./ui/Spinner";

// =========================
// Helpers: BRL input/output
// =========================

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

// =========================
// Helpers: direção (entrada/saída)
// =========================

function getRowShape(row) {
  return row?.instance ? row.instance : row;
}

function getTxnDirection(row) {
  const r = getRowShape(row) || {};
  const d = String(r.direction || r.flow || r.type || r.movement || "")
    .trim()
    .toLowerCase();

  if (["in", "entrada", "income", "receita", "credit"].includes(d)) return "in";
  if (["out", "saida", "saída", "expense", "despesa", "debit"].includes(d)) return "out";

  const amt = Number(r.amount);
  if (Number.isFinite(amt) && amt < 0) return "out";

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

function getInstallment(row) {
  const r = getRowShape(row);
  return r?.installment || null;
}

function safeAccountActive(a) {
  return a?.active !== false;
}

function resolveAccountId(row, accounts) {
  const r = getRowShape(row);

  if (r?.accountId) return r.accountId;

  const legacy = r?.cardId;
  if (!legacy) return "";

  const byPrefix = accounts.find((a) => a?.id === `acc_cc_${legacy}`);
  if (byPrefix) return byPrefix.id;

  const direct = accounts.find((a) => a?.id === legacy);
  if (direct) return direct.id;

  const found = accounts.find((a) => a?.legacyCardId === legacy);
  return found?.id || "";
}

// ✅ resolve invoiceMonth mesmo quando não vem preenchido
function resolveInvoiceYM(row) {
  const r = getRowShape(row) || {};
  const inv = String(r.invoiceMonth || "").trim();
  if (inv && inv.length >= 7) return inv.slice(0, 7);

  const p = String(r.purchaseDate || "").trim();
  if (p && p.length >= 7) return p.slice(0, 7);

  const c = String(r.chargeDate || "").trim();
  if (c && c.length >= 7) return c.slice(0, 7);

  return "";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function AccountChip({ accountId, accountsById }) {
  const acc = accountId ? accountsById[accountId] : null;

  if (!acc) {
    return <Chip size="small" variant="outlined" label="—" sx={{ fontWeight: 850 }} />;
  }

  const iconEmoji = acc.type === "credit_card" ? "💳" : "🏦";

  return (
    <Chip
      size="small"
      variant="outlined"
      icon={
        <span style={{ fontSize: 14, lineHeight: 1, marginLeft: 4 }}>
          {iconEmoji}
        </span>
      }
      label={acc.name}
      sx={{
        fontWeight: 850,
        borderRadius: 999,
        borderColor: "rgba(0,0,0,0.10)",
        backgroundColor: acc.color || "rgba(0,0,0,0.04)",
        "& .MuiChip-icon": { marginLeft: "6px", marginRight: "-4px" },
        "& .MuiChip-label": { fontWeight: 850, marginLeft: "10px" },
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

  const categories = useSelector(selectCategories);

  React.useEffect(() => {
    const x = txn || {};
    setPurchaseDate(x.purchaseDate || "");
    setChargeDate(x.chargeDate || "");
    setInvoiceMonth(x.invoiceMonth || "");
    setMerchant(x.merchant || "");
    setDescription(x.description || "");
    setCategoryId(x.categoryId || "");
    setKind(x.kind || "one_off");
    setStatus(x.status || "previsto");
    setAmount(formatNumberToBrlInput(x.amount ?? ""));
    setErr("");
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
      amount: formatNumberToBrlInput(v),
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

          <TextField
            label="Loja"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            fullWidth
          />

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

export default function TransactionsGrid({ rows, month, onMonthFilterChange, status }) {
  const dispatch = useDispatch();
  const categories = useSelector(selectCategories);
  const safeRows = Array.isArray(rows) ? rows : [];
  const accounts = useSelector((s) => s.accounts?.accounts || []);

  const status_list = ["previsto", "confirmado", "pago", "atraso"];
  const STATUS_META = {
    previsto: {
      label: "Previsto",
      sx: { bgcolor: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.70)" },
    },
    confirmado: {
      label: "Confirmado",
      sx: { bgcolor: "rgba(46,125,50,0.12)", color: "#1b5e20" },
    },
    pago: {
      label: "Pago",
      sx: { bgcolor: "rgba(25,118,210,0.14)", color: "#0d47a1" },
    },
    atraso: {
      label: "Atraso",
      sx: { bgcolor: "rgba(211,47,47,0.14)", color: "#b71c1c" },
    },
  };

  const accountsById = useMemo(() => {
    const m = {};
    for (const a of accounts) m[a.id] = a;
    return m;
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

  // =========================
  // ✅ FILTRO: ANO + MÊS (populado)
  // =========================
  const YEAR_ALL = "__ALL_YEAR__";
  const MONTH_ALL = "__ALL_MONTH__";

  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonth = pad2(now.getMonth() + 1);
  const currentYM = `${currentYear}-${currentMonth}`;

  const ymFromProp = String(month || "").trim();
  const YM_RE = /^\d{4}-\d{2}$/;

  const propYear = YM_RE.test(ymFromProp) ? ymFromProp.slice(0, 4) : "";
  const propMonth = YM_RE.test(ymFromProp) ? ymFromProp.slice(5, 7) : "";


  // ✅ estado local (não sincroniza mais com o pai)
  const [yearFilter, setYearFilter] = useState(() => propYear || currentYear);
  const [monthFilter, setMonthFilter] = useState(() => propMonth || currentMonth);

  // ✅ se o pai passar month="" (ou inválido), começa em Todos/Todos
  React.useEffect(() => {
    if (!YM_RE.test(ymFromProp)) {
      setYearFilter(YEAR_ALL);
      setMonthFilter(MONTH_ALL);
    }
    // só roda na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);




  // opções de anos/meses a partir das transações
  const ymList = useMemo(() => {
    return (safeRows || [])
      .map((r) => resolveInvoiceYM(r))
      .filter(Boolean);
  }, [safeRows]);

  const yearOptions = useMemo(() => {
    const set = new Set(ymList.map((ym) => ym.slice(0, 4)));
    set.add(currentYear); // garante ano atual
    return Array.from(set).sort().reverse();
  }, [ymList, currentYear]);

  const MONTHS = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  function emitMonthToParent(nextYear, nextMonth) {
    if (typeof onMonthFilterChange !== "function") return;

    if (nextYear === YEAR_ALL || nextMonth === MONTH_ALL) {
      return onMonthFilterChange("ALL"); // ✅ token explícito
    }

    return onMonthFilterChange(`${nextYear}-${nextMonth}`);
  }




  // =================================

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
      dispatch(deleteTransactionThunk(txn.id));
    },
    [dispatch]
  );

  const handleSaveEdit = useCallback(
    (patch) => {
      dispatch(patchTransactionThunk({ id: patch?.id, patch }));
      setEditOpen(false);
      setSelectedTxn(null);
    },
    [dispatch]
  );

  const filteredRows = useMemo(() => {
    return safeRows.filter((r) => {
      if (!r) return false;

      // ✅ FILTRO POR ANO/MÊS
      const ym = resolveInvoiceYM(r); // YYYY-MM
      if (yearFilter !== YEAR_ALL) {
        if (!ym) return false;

        const y = ym.slice(0, 4);
        const m = ym.slice(5, 7);

        if (y !== yearFilter) return false;

        if (monthFilter !== MONTH_ALL && m !== monthFilter) return false;
      }

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
    yearFilter,
    monthFilter,
    purchaseFrom,
    purchaseTo,
    accountFilter,
    merchantQ,
    descQ,
    kindFilter,
    categoryFilter,
    remainingMax,
    statusFilter,
    tipoFilter,
    accounts,
  ]);
  console.log('filteredRows', filteredRows)

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
                  marginTop: "12px",
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: isIn ? "rgba(46,125,50,0.12)" : "rgba(211,47,47,0.12)",
                  color: isIn ? "#1b5e20" : "#b71c1c",
                }}
              >
                {isIn ? <ArrowUpwardRoundedIcon fontSize="small" /> : <ArrowDownwardRoundedIcon fontSize="small" />}
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
        field: "invoiceMonth",
        headerName: "Mês Fatura",
        width: 100,
        renderCell: (params) => {
          const ym = resolveInvoiceYM(params?.row);
          return formatMonthBR(ym || params?.row?.invoiceMonth);
        },
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
              onChange={(e) => dispatch(patchTransactionThunk({ id: row.id, patch: { status: e.target.value } }))}
              SelectProps={{ displayEmpty: true }}
              sx={{
                minWidth: 110,
                "& .MuiOutlinedInput-root": {
                  height: 30,
                  marginTop: "10px",
                  
                  fontSize: 13,
                  bgcolor: meta.sx.bgcolor,
                  color: meta.sx.color,
                },
                "& .MuiOutlinedInput-notchedOutline": { border: "none" },
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
          <Stack direction="row" spacing={0.2} justifyContent="flex-end" sx={{ width: "100%", marginTop: "12px" }}>
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
    [accounts, accountsById, dispatch, handleEdit, handleDelete, categories]
  );

  const handleYearChange = useCallback((e) => {
    const nextYear = e.target.value;
    setYearFilter(nextYear);
    if (nextYear === YEAR_ALL) {
      setMonthFilter(MONTH_ALL);
      emitMonthToParent(YEAR_ALL, MONTH_ALL);
    } else {
      emitMonthToParent(nextYear, monthFilter);
    }
  }, [monthFilter, emitMonthToParent]); // Memoriaza a função

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 120px)', // Ocupa a tela inteira menos o header (ajuste os 120px se necessário)
        width: '100%',
        overflow: 'hidden' // Impede que a página inteira ganhe scroll, mantendo o scroll só na tabela
      }}
    >
      <Stack spacing={1.2} sx={{ mb: 1.2 }}>
        <Stack spacing={0.9} pt={1}>
          {/* 🔹 LINHA 1 — PERÍODO / CONTA */}
          <Stack direction="row" spacing={0.9} useFlexGap sx={{ flexWrap: "wrap" }} alignItems="baseline">
            {/* ✅ Ano */}
            <TextField
              size="small"
              select
              label="Ano"
              value={yearFilter}
              onChange={(e) => {
                const nextYear = e.target.value;

                // ✅ Ano = Todos => Mês também vira Todos e remove filtro
                if (nextYear === YEAR_ALL) {
                  setYearFilter(YEAR_ALL);
                  setMonthFilter(MONTH_ALL);
                  emitMonthToParent(YEAR_ALL, MONTH_ALL);
                  return;
                }

                setYearFilter(nextYear);
                emitMonthToParent(nextYear, monthFilter);
              }}

              sx={{ minWidth: 120, width: { xs: "49%", sm: 130 } }}
            >
              <MenuItem value={YEAR_ALL}>Todos</MenuItem>
              <Divider sx={{ my: 0.5 }} />
              {yearOptions.map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </TextField>


            {/* ✅ Mês */}
            <TextField
              size="small"
              select
              label="Mês"
              value={monthFilter}
              // Localize o TextField do Mês e altere o onChange:
              onChange={(e) => {
                const nextMonth = e.target.value;

                if (nextMonth === MONTH_ALL) {
                  setYearFilter(YEAR_ALL); // Se o mês é todos, o ano deve ser todos para mostrar TUDO
                  setMonthFilter(MONTH_ALL);
                  emitMonthToParent(YEAR_ALL, MONTH_ALL);
                  return;
                }

                setMonthFilter(nextMonth);
                // Se escolheu um mês mas o ano estava em "Todos", força o ano atual
                if (yearFilter === YEAR_ALL) {
                  setYearFilter(currentYear);
                  emitMonthToParent(currentYear, nextMonth);
                } else {
                  emitMonthToParent(yearFilter, nextMonth);
                }
              }}
              sx={{ minWidth: 120, width: { xs: "49%", sm: 160 } }}
            >
              <MenuItem value={MONTH_ALL}>Todos</MenuItem>
              <Divider sx={{ my: 0.5 }} />

              {MONTHS.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
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
              {accounts.filter(safeAccountActive).map((a) => (
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
          <Stack direction="row" spacing={0.9} useFlexGap sx={{ flexWrap: "wrap" }} alignItems="baseline">
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
                <MenuItem key={c.id} value={c.slug}>
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

      {status === "loading" ? (
        <SpinnerPage status={status} />
      ) : (
        <Box
          sx={{
            flex: 1,           // Faz o Box crescer para ocupar o espaço restante
            width: "100%",
            minHeight: 0,      // CRUCIAL: No Flexbox, isso permite que o filho tenha scroll em vez de empurrar o pai
            position: "relative",
            zoom: 0.9
          }}
        >
          <DataGrid
            rows={filteredRows}
            density="comfortable"
            columns={columns}
            getRowId={(r) => r?.id}
            disableRowSelectionOnClick
            rowHeight={42} // Altura fixa ajuda a performance
            pageSizeOptions={[25, 50, 100]}
            initialState={{
              pagination: { paginationModel: { pageSize: 50 } },
            }}
            // Isso impede que o Grid renderize o que não está na tela:
            // virtualization
            getRowClassName={(params) =>
              params.indexRelativeToCurrentPage % 2 === 0 ? "row-even" : "row-odd"
            }
            sx={{
              border: "none",
              alignItems: 'center',
              "& .MuiDataGrid-columnHeaders": {
                borderBottom: "1px solid rgba(0,0,0,0.08)",
              },
              "& .MuiDataGrid-cell": {
                borderBottom: "1px solid rgba(0,0,0,0.05)",
              },
              "& .row-even": { backgroundColor: "rgba(0,0,0,0.041)" },
              "& .row-odd": { backgroundColor: "transparent" },
            }}
          />
        </Box>
      )}

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
