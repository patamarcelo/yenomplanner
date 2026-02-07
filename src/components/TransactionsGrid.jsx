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

import { useDispatch, useSelector } from "react-redux";
import { categories } from "../data/mockCategories";
import { formatBRL } from "../utils/money";
import { formatDateBR, formatMonthBR } from "../utils/dateBR";

// ✅ agora existem no slice (você já adicionou)
import { updateTransaction, removeTransaction } from "../store/financeSlice";

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
  const [amount, setAmount] = useState(String(t.amount ?? ""));
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
    setAmount(String(x.amount ?? ""));
    setErr("");
    setAccountId(defaultAccountId || "");
  }, [txn, defaultAccountId]);

  function validate() {
    if (!merchant.trim()) return "Preencha a Loja.";
    if (!description.trim()) return "Preencha a Descrição.";
    const v = Number(amount || 0);
    if (!Number.isFinite(v) || v <= 0) return "Informe um valor válido.";
    return "";
  }

  function handleSave() {
    const e = validate();
    if (e) return setErr(e);

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
      amount: Number(amount),
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
              onChange={(e) => setAmount(e.target.value)}
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

  const firstCardRow = safeRows.find(r => r?.cardId);
  const accounts = useSelector((s) => s.accounts?.accounts || []);

  console.log("FIRST CARD ROW:", firstCardRow);
  console.log("RESOLVED accId:", resolveAccountId(firstCardRow, accounts));

  console.log("ACCOUNTS IDS:", accounts.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    legacyCardId: a.legacyCardId,
  })));

  console.log("RESOLVE xp =>", resolveAccountId({ cardId: "xp" }, accounts));

  const STATUS_META = {
    previsto: {
      label: "Previsto",
      color: "default",
      sx: { bgcolor: "rgba(0,0,0,0.06)", color: "yellow" },
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

  // editar
  const [editOpen, setEditOpen] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);

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
      // seu slice agora aceita payload direto (patch com id)
      dispatch(updateTransaction(patch));
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
  ]);

  const filteredTotal = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + Number(r?.amount || 0), 0);
  }, [filteredRows]);

  const columns = useMemo(
    () => [
      {
        field: "purchaseDate",
        headerName: "Data Compra",
        width: 130,
        renderCell: (params) => formatDateBR(params?.row?.purchaseDate),
      },
      {
        field: "chargeDate",
        headerName: "Data Cobrança",
        width: 140,
        renderCell: (params) => formatDateBR(params?.row?.chargeDate),
      },
      {
        field: "invoiceMonth",
        headerName: "Mês Fatura",
        width: 120,
        renderCell: (params) => formatMonthBR(params?.row?.invoiceMonth),
      },
      {
        field: "accountBadge",
        headerName: "Conta",
        width: 210,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const accId = resolveAccountId(params?.row, accounts);
          return <AccountChip accountId={accId} accountsById={accountsById} />;
        },
      },
      { field: "merchant", headerName: "Loja", flex: 1, minWidth: 170 },
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
        width: 150,
        renderCell: (params) => {
          const row = getRowShape(params?.row);
          const v = row?.categoryId;
          return categories.find((c) => c.id === v)?.name || "—";
        },
      },
      {
        field: "installment",
        headerName: "Parcela",
        width: 110,
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
        width: 130,
        align: "right",
        headerAlign: "right",
        renderCell: (params) => formatBRL(params?.row?.amount),
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
                  height: 30,
                  marginTop: '10px',
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
        headerName: "",
        width: 90,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        align: "right",
        headerAlign: "right",
        renderCell: (params) => (
          <Stack direction="row" spacing={0.2} justifyContent="flex-end" sx={{ width: "100%", marginTop: '10px' }}>
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
    [accountsById, handleEdit, handleDelete]
  );

  return (
    <Box>
      <Stack spacing={1.2} sx={{ mb: 1.2 }}>
        <Stack direction="row" spacing={1.2} sx={{ flexWrap: "wrap" }} alignItems="center">
          <TextField
            size="small"
            select
            label="Mês Fatura"
            value={month || ""}
            onChange={(e) => onMonthFilterChange(e.target.value)}
            sx={{ width: 170 }}
          >
            {monthOptions.map((ym) => (
              <MenuItem key={ym} value={ym}>
                {formatMonthBR(ym)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            label="Compra de"
            type="date"
            value={purchaseFrom}
            onChange={(e) => setPurchaseFrom(isoFromInput(e.target.value))}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />

          <TextField
            size="small"
            label="Compra até"
            type="date"
            value={purchaseTo}
            onChange={(e) => setPurchaseTo(isoFromInput(e.target.value))}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />

          {/* ✅ Contas + cartões (não filtra fora por active undefined) */}
          <TextField
            size="small"
            select
            label="Conta"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            sx={{ width: 240 }}
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
            label="Loja"
            value={merchantQuery}
            onChange={(e) => setMerchantQuery(e.target.value)}
            sx={{ width: 220 }}
            placeholder="Buscar..."
          />

          <TextField
            size="small"
            label="Descrição"
            value={descriptionQuery}
            onChange={(e) => setDescriptionQuery(e.target.value)}
            sx={{ width: 240 }}
            placeholder="Ex: Mercado, assinatura..."
          />

          <TextField
            size="small"
            select
            label="Tipo"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            sx={{ width: 150 }}
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
            sx={{ width: 170 }}
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
            label="Parcelas restantes"
            value={remainingMax}
            onChange={(e) => setRemainingMax(e.target.value)}
            sx={{ width: 220 }}
          >
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="0">Somente última (faltam 0)</MenuItem>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <MenuItem key={n} value={String(n)}>
                Faltam {n} ou menos
              </MenuItem>
            ))}
          </TextField>
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
