// src/components/TransactionsGridMobile.jsx
import React, { useMemo, useState, useCallback } from "react";
import { useEffect } from "react";
import {
  Box,
  Stack,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";

import { useDispatch, useSelector } from "react-redux";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { formatBRL } from "../utils/money";
import { formatDateBR, formatMonthBR } from "../utils/dateBR";
import {
  patchTransactionThunk,
  deleteTransactionThunk,
  createTransactionThunk,
} from "../store/transactionsSlice";
import { selectCategories } from "../store/categoriesSlice";
import SpinnerPage from "./ui/Spinner";
import EditTxnDialog from "./transactions/EditTxnDialog";
import buildTxnHistoryIndex from "./transactions/buildTxnHistoryIndex";
import TransactionsMobileFiltersSheet from "./TransactionsMobileFiltersSheet";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import Fab from "@mui/material/Fab";



/* =========================
   Helpers
========================= */
const STATUS_META = {
  previsto: {
    label: "Previsto",
    sx: { bgcolor: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.70)" },
  },
  confirmado: {
    label: "Confirmado",
    sx: { bgcolor: "rgba(46,125,50,0.12)", color: "#1b5e20" },
  },
  invoiced: {
    label: "Faturado",
    sx: { bgcolor: "rgba(245,124,0,0.16)", color: "#e65100" },
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

function getRowShape(row) {
  if (!row) return {};
  return row?.original || row;
}

function getTxnDirection(row) {
  const r = getRowShape(row);
  const d = String(r?.direction || "").toLowerCase();
  if (d === "income" || d === "in") return "in";
  return "out";
}

function resolveAccountIdFast(row) {
  const r = getRowShape(row);
  return r?.accountId || r?.account_id || r?.account || null;
}

function getInvoiceRef(row) {
  const r = getRowShape(row) || {};
  return r.invoice || r.invoiceId || r.invoice_id || (r.invoice && r.invoice.id) || null;
}

function isTxnLocked(row) {
  const r = getRowShape(row);
  return !!getInvoiceRef(r) || r?.status === "invoiced";
}

function resolveInvoiceYM(row, accountsById) {
  const r = getRowShape(row);
  if (r?.invoiceMonth) return String(r.invoiceMonth).slice(0, 7);
  if (r?.invoice_month) return String(r.invoice_month).slice(0, 7);

  const accId = resolveAccountIdFast(r);
  const acc = accId ? accountsById?.[accId] : null;

  if (acc?.type === "credit_card") {
    const charge = r?.chargeDate || r?.charge_date || "";
    return String(charge).slice(0, 7);
  }

  return "";
}

function resolveCategory(categoryId, categoriesBySlug, categoriesById) {
  const key = String(categoryId ?? "").trim();
  if (!key) return null;
  if (/^\d+$/.test(key)) return categoriesById[key] || categoriesById[Number(key)] || null;
  return categoriesBySlug[key] || null;
}

function MsIcon({ name, size = 18, color = "inherit" }) {
  if (!name) return null;
  const raw = String(name).trim();
  if (!raw) return null;

  const isEmojiLike = /[^\w_]/.test(raw);
  if (isEmojiLike || raw.length <= 2) {
    return <span style={{ fontSize: size, lineHeight: 1, color }}>{raw}</span>;
  }

  return (
    <span
      className="material-symbols-rounded"
      style={{
        fontSize: size,
        lineHeight: 1,
        color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-hidden="true"
    >
      {raw}
    </span>
  );
}

function CategoryChip({ cat }) {
  if (!cat) {
    return <Chip size="small" label="—" variant="outlined" sx={{ fontWeight: 900 }} />;
  }

  const dot = cat.color || "rgba(2,6,23,0.22)";
  const iconTxt = String(cat.icon || "").trim();

  return (
    <Chip
      size="small"
      variant="outlined"
      label={cat.name}
      icon={
        iconTxt ? (
          <MsIcon name={iconTxt} size={18} />
        ) : (
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 6,
              background: dot,
              display: "inline-block",
            }}
          />
        )
      }
      sx={{
        fontWeight: 900,
        borderColor: dot,
        bgcolor: alpha(dot, 0.1),
        "& .MuiChip-icon": { marginLeft: 0 },
      }}
    />
  );
}

function AccountChip({ accountId, accountsById }) {
  const acc = accountId ? accountsById?.[accountId] : null;

  if (!acc) {
    return <Chip size="small" variant="outlined" label="—" sx={{ fontWeight: 850 }} />;
  }

  const iconEmoji = acc.type === "credit_card" ? "💳" : "🏦";

  return (
    <Chip
      size="small"
      variant="outlined"
      icon={<span style={{ fontSize: 14, lineHeight: 1, marginLeft: 4 }}>{iconEmoji}</span>}
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

function addMonthStr(ym, delta) {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1 + delta, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function monthLabelLong(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "Período";
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function autoFitCols(jsonRows) {
  if (!jsonRows?.length) return [];
  const keys = Object.keys(jsonRows[0] || {});
  return keys.map((k) => {
    let max = k.length;
    for (const row of jsonRows) {
      const v = row?.[k];
      const s = v == null ? "" : String(v);
      if (s.length > max) max = s.length;
    }
    return { wch: Math.min(Math.max(max + 2, 10), 45) };
  });
}

function MobileTxnCard({
  row,
  accountsById,
  categoriesBySlug,
  categoriesById,
  handleEdit,
  handleDuplicate,
  handleDelete,
}) {
  const r = getRowShape(row);
  const accId = resolveAccountIdFast(r);
  const cat = resolveCategory(r?.categoryId, categoriesBySlug, categoriesById);
  const dir = getTxnDirection(r);
  const isIn = dir === "in";
  const meta = STATUS_META[r?.status || "previsto"] || STATUS_META.previsto;
  const ym = r?.invoiceMonth || r?.invoice_month || "";
  const locked = isTxnLocked(r);

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        borderColor: "rgba(0,0,0,0.08)",
        boxShadow: "0 2px 8px rgba(2,6,23,0.04)",
      }}
    >
      <CardContent sx={{ px: 1.6, py: 1.25, "&:last-child": { pb: 1.25 } }}>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: 14,
                  lineHeight: 1.15,
                }}
                noWrap
                title={r?.merchant || "—"}
              >
                {r?.merchant || "—"}
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  mt: 0.2,
                  fontSize: 12,
                  lineHeight: 1.15,
                }}
                noWrap
                title={r?.description || "—"}
              >
                {r?.description || "—"}
              </Typography>
            </Box>

            <Typography
              sx={{
                fontWeight: 950,
                fontSize: 15,
                lineHeight: 1,
                color: isIn ? "success.main" : "error.main",
                whiteSpace: "nowrap",
                ml: 1,
              }}
            >
              {formatBRL(Math.abs(Number(r?.amount || 0)))}
            </Typography>
          </Stack>

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
          >
            <Stack direction="row" gap={0.55} flexWrap="wrap" sx={{ minWidth: 0, flex: 1 }}>
              <Chip
                size="small"
                label={formatDateBR(r?.purchaseDate || r?.purchase_date)}
                variant="outlined"
                sx={{ height: 24, fontWeight: 800 }}
              />
              <Chip
                size="small"
                label={formatMonthBR(String(ym).slice(0, 7))}
                variant="outlined"
                sx={{ height: 24, fontWeight: 800 }}
              />
              <Chip
                size="small"
                label={meta.label}
                sx={{
                  height: 24,
                  fontWeight: 900,
                  bgcolor: meta.sx.bgcolor,
                  color: meta.sx.color,
                }}
              />
            </Stack>

            <Stack direction="row" gap={0.35} flexShrink={0}>
              <Tooltip title={locked ? "Bloqueado" : "Editar"}>
                <span>
                  <IconButton
                    size="small"
                    disabled={locked}
                    onClick={() => handleEdit(r)}
                    sx={{
                      width: 30,
                      height: 30,
                      color: "primary.main",
                      bgcolor: "rgba(25,118,210,0.08)",
                    }}
                  >
                    <EditRoundedIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title={locked ? "Bloqueado" : "Duplicar"}>
                <span>
                  <IconButton
                    size="small"
                    disabled={locked}
                    onClick={() => handleDuplicate(r)}
                    sx={{
                      width: 30,
                      height: 30,
                      color: "#6a1b9a",
                      bgcolor: "rgba(106,27,154,0.08)",
                    }}
                  >
                    <ContentCopyRoundedIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title={locked ? "Bloqueado" : "Excluir"}>
                <span>
                  <IconButton
                    size="small"
                    disabled={locked}
                    onClick={() => handleDelete(r)}
                    sx={{
                      width: 30,
                      height: 30,
                      color: "error.main",
                      bgcolor: "rgba(211,47,47,0.08)",
                    }}
                  >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>

          <Stack direction="row" gap={0.65} flexWrap="wrap">
            <AccountChip accountId={accId} accountsById={accountsById} />
            <CategoryChip cat={cat} />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}


export default function TransactionsGridMobile({
  rows,
  month,
  status,
  onMonthFilterChange,
}) {
  const dispatch = useDispatch();
  const theme = useTheme();

  const categories = useSelector(selectCategories);
  const accounts = useSelector((s) => s.accounts?.accounts || []);
  const safeRows = Array.isArray(rows) ? rows : [];

  const historyIndex = useMemo(() => buildTxnHistoryIndex(safeRows), [safeRows]);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const [dialogMode, setDialogMode] = useState("edit");
  const [editingRow, setEditingRow] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [accountFilter, setAccountFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [merchantQuery, setMerchantQuery] = useState("");
  const [descriptionQuery, setDescriptionQuery] = useState("");
  const [purchaseFrom, setPurchaseFrom] = useState("");
  const [purchaseTo, setPurchaseTo] = useState("");
  const [remainingMax, setRemainingMax] = useState("");

  const [createOpen, setCreateOpen] = useState(false);

  const showToast = useCallback((message, severity = "success") => {
    setToast({ open: true, severity, message });
  }, []);

  useEffect(() => {
    const today = new Date();

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    setPurchaseFrom(fmt(yesterday));
    setPurchaseTo(fmt(tomorrow));

    // garante que os outros filtros começam limpos
    setAccountFilter("");
    setCategoryFilter("");
    setKindFilter("");
    setStatusFilter("");
    setTipoFilter("");
    setMerchantQuery("");
    setDescriptionQuery("");
    setRemainingMax("");
  }, []);

  const categoriesBySlug = useMemo(() => {
    const m = {};
    for (const c of categories || []) {
      if (c?.slug) m[c.slug] = c;
    }
    return m;
  }, [categories]);

  const categoriesById = useMemo(() => {
    const m = {};
    for (const c of categories || []) {
      if (c?.id != null) {
        m[c.id] = c;
        m[String(c.id)] = c;
      }
    }
    return m;
  }, [categories]);

  const accountsIndex = useMemo(() => {
    const accountsById = {};
    for (const a of accounts || []) {
      accountsById[a.id] = a;
      accountsById[String(a.id)] = a;
    }
    return { accountsById };
  }, [accounts]);

  const shiftRange = useCallback(
    (delta) => {
      const next = addMonthStr(month, delta);
      onMonthFilterChange?.(next);
    },
    [month, onMonthFilterChange]
  );

  const filteredRows = useMemo(() => {
    const currentYM = String(month || "");

    return safeRows.filter((raw) => {
      const row = getRowShape(raw);

      const rowAccId = String(resolveAccountIdFast(row) || "");
      const rowCat = resolveCategory(row?.categoryId, categoriesBySlug, categoriesById);
      const rowKind = String(row?.kind || "");
      const rowStatus = String(row?.status || "");
      const rowDir = String(row?.direction || "");
      const rowMerchant = String(row?.merchant || "").toLowerCase();
      const rowDesc = String(row?.description || "").toLowerCase();
      const purchaseDate = String(row?.purchaseDate || row?.purchase_date || "");
      const rowYM = String(resolveInvoiceYM(row, accountsIndex.accountsById) || "").slice(0, 7);

      if (currentYM && rowYM && rowYM !== currentYM) return false;
      if (accountFilter && rowAccId !== String(accountFilter)) return false;
      if (categoryFilter && (!rowCat || String(rowCat.slug) !== String(categoryFilter))) return false;
      if (kindFilter && rowKind !== String(kindFilter)) return false;
      if (statusFilter && rowStatus !== String(statusFilter)) return false;
      if (tipoFilter && rowDir !== String(tipoFilter)) return false;
      if (merchantQuery && !rowMerchant.includes(String(merchantQuery).toLowerCase())) return false;
      if (descriptionQuery && !rowDesc.includes(String(descriptionQuery).toLowerCase())) return false;
      if (purchaseFrom && purchaseDate && purchaseDate < purchaseFrom) return false;
      if (purchaseTo && purchaseDate && purchaseDate > purchaseTo) return false;

      if (remainingMax) {
        const inst = row?.installment;
        if (!inst) return false;
        const remain = Number(inst?.total || 0) - Number(inst?.current || 0);
        if (Number.isFinite(remain) && remain > Number(remainingMax)) return false;
      }

      return true;
    });
  }, [
    safeRows,
    month,
    accountFilter,
    categoryFilter,
    kindFilter,
    statusFilter,
    tipoFilter,
    merchantQuery,
    descriptionQuery,
    purchaseFrom,
    purchaseTo,
    remainingMax,
    categoriesBySlug,
    categoriesById,
    accountsIndex.accountsById,
  ]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const raw of filteredRows) {
      const row = getRowShape(raw);
      const amt = Number(row?.amount || 0);
      const dir = getTxnDirection(row);
      if (dir === "in") income += Math.abs(amt);
      else expense += Math.abs(amt);
    }

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [filteredRows]);

  const runBusy = useCallback(
    async (thunkAction) => {
      try {
        setBusy(true);
        const res = dispatch(thunkAction);
        if (res?.unwrap) return await res.unwrap();
        return await Promise.resolve(res);
      } finally {
        setBusy(false);
      }
    },
    [dispatch]
  );

  const handleEdit = useCallback((row) => {
    setDialogMode("edit");
    setEditingRow(getRowShape(row));
  }, []);

  const handleDuplicate = useCallback((row) => {
    setDialogMode("duplicate");
    setEditingRow(getRowShape(row));
  }, []);

  const handleDelete = useCallback((row) => {
    setDeleteTarget(getRowShape(row));
  }, []);

  const handleDialogSave = useCallback(
    async (payload) => {
      try {
        if (dialogMode === "create") {
          await runBusy(createTransactionThunk(payload));
          showToast("Lançamento criado com sucesso.", "success");
        } else if (dialogMode === "duplicate") {
          await runBusy(createTransactionThunk(payload));
          showToast("Lançamento duplicado com sucesso.", "success");
        } else {
          await runBusy(
            patchTransactionThunk({
              id: editingRow.id,
              patch: payload,
            })
          );
          showToast("Lançamento atualizado com sucesso.", "success");
        }

        setEditingRow(null);
      } catch {
        showToast("Não foi possível salvar.", "error");
      }
    },
    [dialogMode, editingRow, runBusy, showToast]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget?.id) return;
    try {
      await runBusy(deleteTransactionThunk(deleteTarget.id));
      showToast("Lançamento excluído com sucesso.", "success");
      setDeleteTarget(null);
    } catch {
      showToast("Erro ao excluir lançamento.", "error");
    }
  }, [deleteTarget, runBusy, showToast]);

  const handleClearFilters = useCallback(() => {
    setAccountFilter("");
    setCategoryFilter("");
    setKindFilter("");
    setStatusFilter("");
    setTipoFilter("");
    setMerchantQuery("");
    setDescriptionQuery("");
    setPurchaseFrom("");
    setPurchaseTo("");
    setRemainingMax("");
  }, []);

  const handleExportXlsx = useCallback(() => {
    const wb = XLSX.utils.book_new();

    const launchRows = filteredRows.map((raw) => {
      const row = getRowShape(raw);
      const cat = resolveCategory(row?.categoryId, categoriesBySlug, categoriesById);
      const accId = resolveAccountIdFast(row);
      const acc = accId ? accountsIndex.accountsById[accId] : null;

      return {
        DataCompra: formatDateBR(row?.purchaseDate || row?.purchase_date),
        MesFatura: formatMonthBR(resolveInvoiceYM(row, accountsIndex.accountsById)),
        Conta: acc?.name || "",
        Loja: row?.merchant || "",
        Descricao: row?.description || "",
        Categoria: cat?.name || "",
        Tipo: row?.kind || "",
        Direcao: row?.direction || "",
        Status: row?.status || "",
        Parcela: row?.installment
          ? `${row.installment.current ?? "—"}/${row.installment.total ?? "—"}`
          : "",
        Valor: Number(row?.amount || 0),
      };
    });

    const ws1 = XLSX.utils.json_to_sheet(launchRows);
    ws1["!cols"] = autoFitCols(launchRows);
    XLSX.utils.book_append_sheet(wb, ws1, "Lancamentos");

    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `lancamentos-${month || "periodo"}.xlsx`
    );
  }, [filteredRows, categoriesBySlug, categoriesById, accountsIndex.accountsById, month]);

  return (
    <Box sx={{ width: "100%" }}>
      <Stack spacing={1.15}>
        <Card
          variant="outlined"
          sx={{
            borderRadius: 2,
            borderColor: "rgba(0,0,0,0.08)",
          }}
        >
          <CardContent sx={{ px: 1.6, py: 1.1, "&:last-child": { pb: 1.1 } }}>
            <Stack spacing={1}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 950, fontSize: 18, lineHeight: 1.05 }}>
                    Lançamentos
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.2 }}>
                    {filteredRows.length} itens
                  </Typography>
                </Box>

                <Stack direction="row" alignItems="center" gap={0.5}>
                  <IconButton
                    size="small"
                    onClick={() => shiftRange(-1)}
                    sx={{ width: 30, height: 30 }}
                  >
                    <ChevronLeftRoundedIcon sx={{ fontSize: 20 }} />
                  </IconButton>

                  <Chip
                    label={monthLabelLong(month)}
                    sx={{
                      height: 28,
                      fontWeight: 900,
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      "& .MuiChip-label": {
                        px: 1.2,
                      },
                    }}
                  />

                  <IconButton
                    size="small"
                    onClick={() => shiftRange(1)}
                    sx={{ width: 30, height: 30 }}
                  >
                    <ChevronRightRoundedIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Stack>
              </Stack>

              <Stack direction="row" gap={0.7} flexWrap="wrap">
                <Chip
                  size="small"
                  label={`Entradas: ${formatBRL(totals.income)}`}
                  sx={{
                    height: 26,
                    fontWeight: 850,
                    color: "success.main",
                    bgcolor: (t) => t.palette.success.main + "14",
                  }}
                />
                <Chip
                  size="small"
                  label={`Saídas: ${formatBRL(totals.expense)}`}
                  sx={{
                    height: 26,
                    fontWeight: 850,
                    color: "error.main",
                    bgcolor: (t) => t.palette.error.main + "14",
                  }}
                />
                <Chip
                  size="small"
                  label={`Saldo: ${formatBRL(totals.balance)}`}
                  sx={{
                    height: 26,
                    fontWeight: 900,
                    color: totals.balance >= 0 ? "success.main" : "error.main",
                    bgcolor: (t) =>
                      totals.balance >= 0
                        ? t.palette.success.main + "14"
                        : t.palette.error.main + "14",
                  }}
                />
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<TuneRoundedIcon />}
                  onClick={() => setMobileFiltersOpen(true)}
                  sx={{
                    ml: "auto",
                    borderRadius: 999,
                    fontWeight: 900,
                    px: 1.25,
                    minHeight: 28,
                  }}
                >
                  Filtros
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<FileDownloadRoundedIcon />}
                  onClick={handleExportXlsx}
                  sx={{
                    borderRadius: 999,
                    fontWeight: 900,
                    px: 1.15,
                    minHeight: 28,
                  }}
                >
                  Exportar
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {status === "loading" ? (
          <SpinnerPage status={status} />
        ) : filteredRows.length ? (
          <Stack spacing={1}>
            {filteredRows.map((row) => (
              <MobileTxnCard
                key={row?.id}
                row={row}
                accountsById={accountsIndex.accountsById}
                categoriesBySlug={categoriesBySlug}
                categoriesById={categoriesById}
                handleEdit={handleEdit}
                handleDuplicate={handleDuplicate}
                handleDelete={handleDelete}
              />
            ))}
          </Stack>
        ) : (
          <Alert severity="info">Nenhum lançamento encontrado para os filtros atuais.</Alert>
        )}
      </Stack>

      <TransactionsMobileFiltersSheet
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        purchaseFrom={purchaseFrom}
        setPurchaseFrom={setPurchaseFrom}
        purchaseTo={purchaseTo}
        setPurchaseTo={setPurchaseTo}
        shiftRange={shiftRange}
        accountFilter={accountFilter}
        setAccountFilter={setAccountFilter}
        accounts={accounts}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        categories={categories}
        categoriesBySlug={categoriesBySlug}
        kindFilter={kindFilter}
        setKindFilter={setKindFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        tipoFilter={tipoFilter}
        setTipoFilter={setTipoFilter}
        merchantQuery={merchantQuery}
        setMerchantQuery={setMerchantQuery}
        descriptionQuery={descriptionQuery}
        setDescriptionQuery={setDescriptionQuery}
        remainingMax={remainingMax}
        setRemainingMax={setRemainingMax}
        handleClearFilters={handleClearFilters}
        STATUS_META={STATUS_META}
      />

      <EditTxnDialog
        open={!!editingRow}
        onClose={() => {
          setEditingRow(null);
        }}
        mode={dialogMode}
        txn={editingRow || {}}
        accounts={accounts || []}
        defaultAccountId={resolveAccountIdFast(editingRow)}
        onSave={handleDialogSave}
        historyIndex={historyIndex || {}}
        busy={busy}
      />

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 950 }}>Excluir lançamento</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja excluir{" "}
            <b>{deleteTarget?.merchant || deleteTarget?.description || "este lançamento"}</b>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete}>
            Excluir
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
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