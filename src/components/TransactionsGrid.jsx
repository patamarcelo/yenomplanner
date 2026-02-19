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

import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";

import { useDispatch, useSelector } from "react-redux";
import { alpha } from "@mui/material/styles";

import { formatBRL } from "../utils/money";
import { formatDateBR, formatMonthBR } from "../utils/dateBR";
import { patchTransactionThunk, deleteTransactionThunk, createTransactionThunk } from "../store/transactionsSlice";
import { selectCategories } from "../store/categoriesSlice";
import SpinnerPage from "./ui/Spinner";

import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";

import useDebouncedValue from "../hooks/useDebouncedValue";
import buildTxnHistoryIndex from "./transactions/buildTxnHistoryIndex";
import EditTxnDialog from "./transactions/EditTxnDialog";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";



// =========================
// Constantes (fora do componente)
// =========================
// ✅ adicionar "invoiced"
const STATUS_LIST = ["previsto", "confirmado", "invoiced", "pago", "atraso"];

const STATUS_META = {
  previsto: { label: "Previsto", sx: { bgcolor: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.70)" } },
  confirmado: { label: "Confirmado", sx: { bgcolor: "rgba(46,125,50,0.12)", color: "#1b5e20" } },

  // ✅ novo status
  invoiced: { label: "Faturado", sx: { bgcolor: "rgba(245,124,0,0.16)", color: "#e65100" } },

  pago: { label: "Pago", sx: { bgcolor: "rgba(25,118,210,0.14)", color: "#0d47a1" } },
  atraso: { label: "Atraso", sx: { bgcolor: "rgba(211,47,47,0.14)", color: "#b71c1c" } },
};

// ✅ helper: trava quando está em fatura
function getInvoiceRef(row) {
  const r = getRowShape(row) || {};
  // aceita invoice como string/uuid, invoiceId, invoice_id, ou objeto {id}
  return (
    r.invoice ||
    r.invoiceId ||
    r.invoice_id ||
    (r.invoice && r.invoice.id) ||
    null
  );
}

function isTxnLocked(row) {
  const r = getRowShape(row) || {};
  const invRef = getInvoiceRef(r);
  const st = String(r.status || "").trim().toLowerCase();

  // ✅ trava por vínculo OU (fallback) por status
  return !!invRef || st === "invoiced";
}




const YEAR_ALL = "__ALL_YEAR__";
const MONTH_ALL = "__ALL_MONTH__";
const YM_RE = /^\d{4}-\d{2}$/;

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

// =========================
// Helpers: BRL input/output
// =========================

function isInvoicePaymentTxn(row) {
  const r = getRowShape(row) || {};

  // ✅ melhor caso: veio algum campo explícito do backend
  if (r.isInvoicePayment) return true;
  if (r.kind === "transfer") return true;
  if (r.category_id === "cc_payment" || r.categoryId === "cc_payment") return true;

  // ✅ se veio bill com kind
  const billKind = String(r?.bill?.kind || r?.bill_kind || "").toLowerCase();
  if (billKind === "cc_invoice") return true;

  // ⚠️ fallback heurístico (último recurso)
  const merchant = String(r.merchant || "").toLowerCase();
  const desc = String(r.description || "").toLowerCase();
  const hasPayWords = merchant.includes("pag") || desc.includes("pag");
  const hasInvoiceWords = merchant.includes("fatura") || desc.includes("fatura") || merchant.includes("invoice") || desc.includes("invoice");

  return !!r.invoice && hasPayWords && hasInvoiceWords;
}

function normalizeKey(v) {
  return String(v ?? "").trim().toLowerCase();
}

function rowMatchesCategoryFilter(row, categoryFilter, categoriesBySlug, categoriesById) {
  const filterKey = normalizeKey(categoryFilter);
  if (!filterKey) return true;

  const rowKeyRaw = row?.categoryId;
  const rowKey = normalizeKey(rowKeyRaw);

  // 1) Match direto (slug vs slug, id vs id como string)
  if (rowKey === filterKey) return true;

  // 2) Se o ROW vem como ID ("2") e o filtro é SLUG ("casa"):
  // resolve a categoria do row e compara pelo slug
  if (isNumericId(rowKeyRaw)) {
    const cat = resolveCategory(rowKeyRaw, categoriesBySlug, categoriesById);
    const rowSlug = normalizeKey(cat?.slug);
    if (rowSlug && rowSlug === filterKey) return true;
  }

  // 3) Se o FILTRO vier numérico (caso você mude no futuro), e a row vier slug:
  if (isNumericId(categoryFilter)) {
    const cat = resolveCategory(categoryFilter, categoriesBySlug, categoriesById);
    const filterSlug = normalizeKey(cat?.slug);
    if (filterSlug && rowKey === filterSlug) return true;
  }

  return false;
}

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

// ✅ resolve invoiceMonth mesmo quando não vem preenchido
function resolveInvoiceYM(row, accountsById) {
  const r = getRowShape(row) || {};

  const accId = r.accountId;
  const acc = accId ? accountsById?.[accId] : null;

  const isCreditCard = acc?.type === "credit_card";

  // ✅ Se for cartão → usar mês da fatura obrigatoriamente
  if (isCreditCard) {
    const inv = String(r.invoiceMonth || "").trim();
    return inv && inv.length >= 7 ? inv.slice(0, 7) : "";
  }

  // ✅ Se não for cartão → usar data da compra
  const p = String(r.purchaseDate || "").trim();
  return p && p.length >= 7 ? p.slice(0, 7) : "";
}


function pad2(n) {
  return String(n).padStart(2, "0");
}

function isNumericId(v) {
  if (v === null || v === undefined) return false;
  // aceita number ou string só com dígitos
  return typeof v === "number"
    ? Number.isFinite(v)
    : /^\d+$/.test(String(v).trim());
}

function resolveCategory(categoryId, categoriesBySlug, categoriesById) {
  const key = String(categoryId ?? "").trim();
  if (!key) return null;

  if (isNumericId(key)) {
    return categoriesById[key] || categoriesById[Number(key)] || null;
  }

  // slug/texto (ex: "casa", "alimentacao")
  return categoriesBySlug[key] || null;
}


// =========================
// UI helpers
// =========================
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

function CategoryChip({ cat, size = "small" }) {
  if (!cat) return <Chip size={size} label="—" variant="outlined" sx={{ fontWeight: 900 }} />;

  const dot = cat.color || "rgba(2,6,23,0.22)";
  const iconTxt = String(cat.icon || "").trim();

  return (
    <Chip
      size={size}
      variant="outlined"
      label={cat.name}
      icon={
        iconTxt ? (
          <MsIcon name={iconTxt} size={18} />
        ) : (
          <span style={{ width: 10, height: 10, borderRadius: 6, background: dot, display: "inline-block" }} />
        )
      }
      sx={{
        fontWeight: 900,
        borderColor: dot,
        padding: "10px",
        bgcolor: alpha(dot, 0.10),
        "& .MuiChip-icon": { marginLeft: 0 },
      }}
    />
  );
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

// =========================
// Edit dialog
// =========================

// =========================
// Componente principal
// =========================
export default function TransactionsGrid({ rows, month, onMonthFilterChange, status }) {
  const dispatch = useDispatch();

  const categories = useSelector(selectCategories);
  const accounts = useSelector((s) => s.accounts?.accounts || []);
  const safeRows = Array.isArray(rows) ? rows : [];

  const historyIndex = useMemo(() => buildTxnHistoryIndex(safeRows), [safeRows]);

  const [busy, setBusy] = useState(false);


  const runBusy = useCallback(async (thunkAction) => {
    try {
      setBusy(true);
      const res = dispatch(thunkAction);
      // se for RTK createAsyncThunk, unwrap existe:
      if (res?.unwrap) await res.unwrap();
      else await Promise.resolve(res);
    } finally {
      setBusy(false);
    }
  }, [dispatch]);

  const [dialogMode, setDialogMode] = useState("edit"); // "edit" | "duplicate"

  function sumAgg(map, key, patch) {
    const cur = map.get(key) || { income: 0, expense: 0, balance: 0, count: 0 };
    const next = {
      income: cur.income + (patch.income || 0),
      expense: cur.expense + (patch.expense || 0),
      balance: cur.balance + (patch.balance || 0),
      count: cur.count + (patch.count || 0),
    };
    map.set(key, next);
  }

  function autoFitCols(jsonRows) {
    // largura simples por conteúdo (bom o suficiente)
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






  // ✅ maps memoizados (evita .find() por linha)
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
      if (c?.id !== undefined && c?.id !== null) {
        m[String(c.id)] = c;
      }
    }
    return m;
  }, [categories]);


  console.log('categoriesBySlug', categoriesBySlug)

  const accountsIndex = useMemo(() => {
    const accountsById = {};
    const byLegacyCardId = {};
    const byPrefixedLegacy = {}; // acc_cc_${legacy}
    const direct = {};

    for (const a of accounts || []) {
      if (!a?.id) continue;
      accountsById[a.id] = a;
      direct[a.id] = a.id;

      if (a.legacyCardId) {
        byLegacyCardId[String(a.legacyCardId)] = a.id;
      }

      // ajuda quando existe conta criada com prefixo
      if (String(a.id).startsWith("acc_cc_")) {
        const legacy = String(a.id).replace("acc_cc_", "");
        if (legacy) byPrefixedLegacy[legacy] = a.id;
      }
    }

    return { accountsById, byLegacyCardId, byPrefixedLegacy, direct };
  }, [accounts]);

  const resolveAccountIdFast = useCallback(
    (row) => {
      const r = getRowShape(row);
      if (!r) return "";

      if (r.accountId) return r.accountId;

      const legacy = r.cardId;
      if (!legacy) return "";

      const legacyKey = String(legacy);

      // tenta conta id "acc_cc_${legacy}"
      if (accountsIndex.byPrefixedLegacy[legacyKey]) return accountsIndex.byPrefixedLegacy[legacyKey];

      // tenta id direto
      if (accountsIndex.direct[legacyKey]) return legacyKey;

      // tenta legacyCardId
      if (accountsIndex.byLegacyCardId[legacyKey]) return accountsIndex.byLegacyCardId[legacyKey];

      return "";
    },
    [accountsIndex]
  );

  // =========================
  // ✅ FILTRO: ANO + MÊS (populado)
  // =========================
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonth = pad2(now.getMonth() + 1);

  const ymFromProp = String(month || "").trim();
  const propYear = YM_RE.test(ymFromProp) ? ymFromProp.slice(0, 4) : "";
  const propMonth = YM_RE.test(ymFromProp) ? ymFromProp.slice(5, 7) : "";

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

  const emitMonthToParent = useCallback(
    (nextYear, nextMonth) => {
      if (typeof onMonthFilterChange !== "function") return;

      if (nextYear === YEAR_ALL || nextMonth === MONTH_ALL) {
        onMonthFilterChange("ALL");
        return;
      }

      onMonthFilterChange(`${nextYear}-${nextMonth}`);
    },
    [onMonthFilterChange]
  );

  // opções de anos a partir das transações (memo)
  const yearOptions = useMemo(() => {
    const set = new Set();
    for (const r of safeRows) {
      const ym = resolveInvoiceYM(r, accountsIndex.accountsById);
      if (ym) set.add(ym.slice(0, 4));
    }
    set.add(currentYear);
    return Array.from(set).sort().reverse();
  }, [safeRows, currentYear, accountsIndex]);

  // =========================
  // Filtros locais
  // =========================
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

  const debouncedMerchantQuery = useDebouncedValue(merchantQuery, 1200);
  const debouncedDescriptionQuery = useDebouncedValue(descriptionQuery, 1200);

  const merchantQ = useMemo(() => debouncedMerchantQuery.trim().toLowerCase(), [debouncedMerchantQuery]);
  const descQ = useMemo(() => debouncedDescriptionQuery.trim().toLowerCase(), [debouncedDescriptionQuery]);


  const handleEdit = useCallback((row) => {
    const txn = getRowShape(row);
    setDialogMode("edit");
    setSelectedTxn(txn);
    setEditOpen(true);
  }, []);

  const handleDuplicate = useCallback((row) => {
    const txn = getRowShape(row);
    setDialogMode("duplicate");
    setSelectedTxn(txn);
    setEditOpen(true);
  }, []);


  const handleDelete = useCallback((row) => {
    const txn = getRowShape(row);
    const ok = window.confirm(`Excluir lançamento "${txn?.merchant || "—"}" (${formatBRL(txn?.amount)})?`);
    if (!ok) return;
    runBusy(deleteTransactionThunk(txn.id));
  }, [runBusy]);


  const handleSaveDialog = useCallback(async (payload) => {
    if (dialogMode === "duplicate") {
      // cria novo
      await runBusy(createTransactionThunk(payload));
    } else {
      // edita existente
      await runBusy(patchTransactionThunk({ id: payload?.id, patch: payload }));
    }

    setEditOpen(false);
    setSelectedTxn(null);
    setDialogMode("edit");
  }, [dialogMode, runBusy]);


  // ✅ filtro pesado memoizado
  const filteredRows = useMemo(() => {
    const maxRemain = remainingMax !== "" ? Number(remainingMax) : null;
    const hasRemain = remainingMax !== "" && Number.isFinite(maxRemain);

    const filtered = safeRows.filter((r) => {
      if (!r) return false;

      // ✅ FILTRO POR ANO/MÊS
      const ym = resolveInvoiceYM(r, accountsIndex.accountsById);
      if (yearFilter !== YEAR_ALL) {
        if (!ym) return false;

        const y = ym.slice(0, 4);
        const m = ym.slice(5, 7);

        if (y !== yearFilter) return false;
        if (monthFilter !== MONTH_ALL && m !== monthFilter) return false;
      }

      if ((purchaseFrom || purchaseTo) && !inDateRange(r.purchaseDate, purchaseFrom, purchaseTo)) return false;

      if (accountFilter) {
        const accId = resolveAccountIdFast(r);
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

      if (categoryFilter) {
        if (!rowMatchesCategoryFilter(r, categoryFilter, categoriesBySlug, categoriesById)) return false;
      }

      if (statusFilter && r.status !== statusFilter) return false;
      if (tipoFilter && getTxnDirection(r) !== tipoFilter) return false;

      if (hasRemain) {
        const inst = getInstallment(r);
        if (!inst || typeof inst.current !== "number" || typeof inst.total !== "number") return false;

        const remaining = inst.total - inst.current;
        if (remaining > maxRemain) return false;
      }

      return true;
    });

    // ✅ ORDENAÇÃO POR DATA (mais recente primeiro)
    // Se purchaseDate estiver em ISO (YYYY-MM-DD) ou ISO datetime, Date() funciona bem.
    return filtered.sort((a, b) => {
      const ta = a?.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
      const tb = b?.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
      return tb - ta;
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
    resolveAccountIdFast,
    categoriesBySlug,
    categoriesById,
    accountsIndex,
  ]);

  console.log('filteredRows', filteredRows)
  // const filteredTotal = useMemo(() => {
  //   let acc = 0;

  //   for (const r of filteredRows) {
  //     const value = Math.abs(Number(r?.amount || 0));

  //     if (r?.direction === "income") {
  //       acc += value;
  //     } else if (r?.direction === "expense") {
  //       acc -= value;
  //     }
  //   }

  //   return acc;
  // }, [filteredRows]);


  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const r0 of filteredRows) {
      const r = getRowShape(r0);

      // ✅ não soma pagamento de fatura (evita double counting)
      if (isInvoicePaymentTxn(r)) continue;

      const value = Math.abs(Number(r?.amount || 0));
      if (r?.direction === "income") income += value;
      if (r?.direction === "expense") expense += value;
    }

    return { income, expense, balance: income - expense };
  }, [filteredRows]);


  const handleExportXlsx = useCallback(() => {
    try {
      const rowsBase = (filteredRows || []).map(getRowShape).filter(Boolean);

      // ✅ para resumos: evita double counting, igual seu totals()
      const rowsForAgg = rowsBase.filter((r) => !isInvoicePaymentTxn(r));

      // =========================
      // Aba 1: Lançamentos
      // =========================
      const lançamentos = rowsBase.map((r) => {
        const ym = resolveInvoiceYM(r, accountsIndex.accountsById);
        const accId = resolveAccountIdFast(r);
        const acc = accId ? accountsIndex.accountsById?.[accId] : null;
        const cat = resolveCategory(r?.categoryId, categoriesBySlug, categoriesById);

        const amount = Number(r?.amount || 0);
        const abs = Math.abs(amount);

        return {
          ID: r.id || "",
          Data: r.purchaseDate || "",
          MesFatura: ym || "",
          Conta: acc?.name || "",
          TipoConta: acc?.type || "",
          Loja: r.merchant || "",
          Descricao: r.description || "",
          Categoria: cat?.name || "",
          CategoriaSlug: cat?.slug || "",
          Direcao: r.direction || "",
          Status: r.status || "",
          TipoLancamento: r.kind || "",
          Parcela: r.installment ? `${r.installment.current ?? ""}/${r.installment.total ?? ""}` : "",
          ValorAbs: abs,       // número (bom para Excel)
          ValorOriginal: amount, // se quiser ver o sinal original
          EhPagamentoFatura: isInvoicePaymentTxn(r) ? "SIM" : "NAO",
        };
      });

      // =========================
      // Aba 2: Resumo por Categoria
      // =========================
      const catAgg = new Map();
      for (const r of rowsForAgg) {
        const cat = resolveCategory(r?.categoryId, categoriesBySlug, categoriesById);
        const key = cat?.name || "Sem categoria";

        const value = Math.abs(Number(r?.amount || 0));
        const dir = String(r?.direction || "").toLowerCase();

        if (dir === "income") sumAgg(catAgg, key, { income: value, balance: value, count: 1 });
        else if (dir === "expense") sumAgg(catAgg, key, { expense: value, balance: -value, count: 1 });
        else sumAgg(catAgg, key, { count: 1 });
      }

      const resumoCategoria = Array.from(catAgg.entries())
        .map(([Categoria, v]) => ({
          Categoria,
          Itens: v.count,
          Entradas: v.income,
          Saidas: v.expense,
          Saldo: v.income - v.expense,
        }))
        .sort((a, b) => Math.abs(b.Saidas) - Math.abs(a.Saidas));

      // =========================
      // Aba 3: Resumo por Conta
      // =========================
      const accAgg = new Map();
      for (const r of rowsForAgg) {
        const accId = resolveAccountIdFast(r);
        const acc = accId ? accountsIndex.accountsById?.[accId] : null;
        const key = acc?.name || "Sem conta";

        const value = Math.abs(Number(r?.amount || 0));
        const dir = String(r?.direction || "").toLowerCase();

        if (dir === "income") sumAgg(accAgg, key, { income: value, balance: value, count: 1 });
        else if (dir === "expense") sumAgg(accAgg, key, { expense: value, balance: -value, count: 1 });
        else sumAgg(accAgg, key, { count: 1 });
      }

      const resumoConta = Array.from(accAgg.entries())
        .map(([Conta, v]) => ({
          Conta,
          Itens: v.count,
          Entradas: v.income,
          Saidas: v.expense,
          Saldo: v.income - v.expense,
        }))
        .sort((a, b) => Math.abs(b.Saidas) - Math.abs(a.Saidas));

      // =========================
      // Aba 4: Fluxo Mensal (YYYY-MM)
      // =========================
      const monthAgg = new Map();
      for (const r of rowsForAgg) {
        const ym = resolveInvoiceYM(r, accountsIndex.accountsById);
        const key = ym || "Sem mês";

        const value = Math.abs(Number(r?.amount || 0));
        const dir = String(r?.direction || "").toLowerCase();

        if (dir === "income") sumAgg(monthAgg, key, { income: value, balance: value, count: 1 });
        else if (dir === "expense") sumAgg(monthAgg, key, { expense: value, balance: -value, count: 1 });
        else sumAgg(monthAgg, key, { count: 1 });
      }

      const fluxoMensal = Array.from(monthAgg.entries())
        .map(([Mes, v]) => ({
          Mes,
          Itens: v.count,
          Entradas: v.income,
          Saidas: v.expense,
          Saldo: v.income - v.expense,
        }))
        .sort((a, b) => String(a.Mes).localeCompare(String(b.Mes)));

      // =========================
      // Monta Workbook
      // =========================
      const wb = XLSX.utils.book_new();

      const ws1 = XLSX.utils.json_to_sheet(lançamentos);
      ws1["!cols"] = autoFitCols(lançamentos);
      XLSX.utils.book_append_sheet(wb, ws1, "Lancamentos");

      const ws2 = XLSX.utils.json_to_sheet(resumoCategoria);
      ws2["!cols"] = autoFitCols(resumoCategoria);
      XLSX.utils.book_append_sheet(wb, ws2, "Resumo Categoria");

      const ws3 = XLSX.utils.json_to_sheet(resumoConta);
      ws3["!cols"] = autoFitCols(resumoConta);
      XLSX.utils.book_append_sheet(wb, ws3, "Resumo Conta");

      const ws4 = XLSX.utils.json_to_sheet(fluxoMensal);
      ws4["!cols"] = autoFitCols(fluxoMensal);
      XLSX.utils.book_append_sheet(wb, ws4, "Fluxo Mensal");

      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `yenom_export_${stamp}.xlsx`;

      const arrayBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([arrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(blob, filename);
    } catch (e) {
      console.error("[EXPORT_XLSX] erro", e);
      alert("Não foi possível exportar o Excel. Veja o console para detalhes.");
    }
  }, [
    filteredRows,
    accountsIndex,
    resolveAccountIdFast,
    categoriesBySlug,
    categoriesById,
  ]);

  // ✅ columns memoizadas e SEM .find() por linha
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
          const ym = resolveInvoiceYM(params?.row, accountsIndex.accountsById); // ✅ usa params.row
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
          const accId = resolveAccountIdFast(params?.row);
          return <AccountChip accountId={accId} accountsById={accountsIndex.accountsById} />;
        },
      },

      { field: "merchant", headerName: "Loja", flex: 1, minWidth: 180 },
      { field: "description", headerName: "Descrição", flex: 2, minWidth: 260 },
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
        width: 170,
        renderCell: (params) => {
          const row = getRowShape(params?.row);
          const cat = resolveCategory(row?.categoryId, categoriesBySlug, categoriesById);
          return <CategoryChip cat={cat} />;
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

          const locked = isTxnLocked(row);

          // ✅ quando travado: mostra chip e não deixa editar
          if (locked) {
            return (
              <Tooltip title="Bloqueado: este lançamento está vinculado a uma fatura">
                <Chip
                  size="small"
                  label={meta.label}
                  sx={{
                    height: 30,
                    fontWeight: 900,
                    bgcolor: meta.sx.bgcolor,
                    color: meta.sx.color,
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                />
              </Tooltip>
            );
          }

          // ✅ normal: select editável
          return (
            <TextField
              select
              size="small"
              value={current}
              onChange={(e) =>
                dispatch(
                  patchTransactionThunk({
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
                  marginTop: "15px",
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
        width: 98,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        align: "right",
        headerAlign: "right",
        renderCell: (params) => {
          const row = getRowShape(params?.row);
          const locked = isTxnLocked(row);
          const lockTip = "Bloqueado: lançamento vinculado a fatura (invoiced)";

          return (
            <Stack
              direction="row"
              spacing={0.4}
              justifyContent="flex-end"
              sx={{ width: "100%", ml: 1, opacity: locked ? 0.55 : 1 }}
            >
              <Tooltip title={locked ? lockTip : "Editar"}>
                <span>
                  <IconButton
                    size="small"
                    disabled={locked}
                    onClick={() => handleEdit(params?.row)}
                    sx={{
                      color: "primary.main",
                      bgcolor: "rgba(25,118,210,0.08)",
                      transition: "all .15s ease",
                      "&:hover": { bgcolor: "rgba(25,118,210,0.18)", transform: "scale(1.08)" },
                    }}
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title={locked ? lockTip : "Duplicar"}>
                <span>
                  <IconButton
                    size="small"
                    disabled={locked}
                    onClick={() => handleDuplicate(params?.row)}
                    sx={{
                      color: "#6a1b9a",
                      bgcolor: "rgba(106,27,154,0.08)",
                      transition: "all .15s ease",
                      "&:hover": { bgcolor: "rgba(106,27,154,0.18)", transform: "scale(1.08)" },
                    }}
                  >
                    <ContentCopyRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title={locked ? lockTip : "Excluir"}>
                <span>
                  <IconButton
                    size="small"
                    disabled={locked}
                    onClick={() => handleDelete(params?.row)}
                    sx={{
                      color: "error.main",
                      bgcolor: "rgba(211,47,47,0.08)",
                      transition: "all .15s ease",
                      "&:hover": { bgcolor: "rgba(211,47,47,0.18)", transform: "scale(1.08)" },
                    }}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },

    ],
    [dispatch, handleEdit, handleDelete, categoriesBySlug, resolveAccountIdFast, accountsIndex.accountsById]
  );

  const ultraCompactFiltersSx = {
    "& .MuiInputBase-root": { height: 30, fontSize: 11.5 },
    "& .MuiOutlinedInput-input": { padding: "6px 10px" },
    "& .MuiInputLabel-root": { fontSize: 11, top: -3 },
    "& .MuiInputLabel-shrink": { fontSize: 10, transform: "translate(14px, -6px) scale(0.85)" },
    "& .MuiMenuItem-root": { fontSize: 11.5, minHeight: 30 },
    "& .material-symbols-rounded": { fontSize: 15 },
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 100px)",
        width: "100%",
        overflow: "hidden",
      }}
    >
      <Stack spacing={1.2} sx={{ mb: 1.2, ...ultraCompactFiltersSx }}>
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
              onChange={(e) => {
                const nextMonth = e.target.value;

                if (nextMonth === MONTH_ALL) {
                  setYearFilter(YEAR_ALL);
                  setMonthFilter(MONTH_ALL);
                  emitMonthToParent(YEAR_ALL, MONTH_ALL);
                  return;
                }

                setMonthFilter(nextMonth);

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
              SelectProps={{
                renderValue: (val) => {
                  if (!val) return "Todas";
                  const cat = categoriesBySlug[val];
                  if (!cat) return String(val);
                  return (
                    <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
                      <MsIcon name={(cat.icon || "").trim() || "tag"} size={18} />
                      <span
                        style={{
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {cat.name}
                      </span>
                    </Stack>
                  );
                },
              }}
            >
              <MenuItem value="">Todas</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.slug}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
                    <MsIcon name={(c.icon || "").trim() || "tag"} size={18} />
                    <span style={{ fontWeight: 900, whiteSpace: "nowrap" }}>{c.name}</span>
                  </Stack>
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
              {STATUS_LIST.map((c) => (
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

        <Stack
          direction="row"
          alignItems="center"
          sx={{ gap: 1.2, flexWrap: "wrap" }}
        >
          {/* ESQUERDA */}
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Itens: <b>{filteredRows.length}</b>
          </Typography>
          <Tooltip title="Exportar Excel (.xlsx) com abas (lançamentos e resumos)">
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadRoundedIcon />}
              onClick={handleExportXlsx}
              sx={{
                fontWeight: 900,
                borderRadius: 999,
                textTransform: "none",
                px: 1.2,
                height: 30,
              }}
            >
              Exportar
            </Button>
          </Tooltip>

          {/* MEIO */}
          <Stack
            direction="row"
            alignItems="center"
            sx={{ gap: 1.2, flexWrap: "wrap" }}
          >

          </Stack>

          {/* DIREITA */}
          <Box
            sx={{
              ml: "auto",
              display: "flex",
              justifyContent: "flex-end",
              gap: 1,
              flexWrap: "wrap",
            }}
          >


            <Chip
              size="small"
              label={`Entradas: ${formatBRL(totals.income)}`}
              sx={{
                fontWeight: 800,
                color: "success.main",
                bgcolor: (theme) => theme.palette.success.main + "14",
                border: "1px solid",
                borderColor: "success.main",
              }}
            />

            <Chip
              size="small"
              label={`Saídas: ${formatBRL(totals.expense)}`}
              sx={{
                fontWeight: 800,
                color: "error.main",
                bgcolor: (theme) => theme.palette.error.main + "14",
                border: "1px solid",
                borderColor: "error.main",
              }}
            />

            <Chip
              size="small"
              label={`Saldo: ${formatBRL(totals.balance)}`}
              sx={{
                fontWeight: 900,
                letterSpacing: 0.2,
                color: totals.balance >= 0 ? "success.main" : "error.main",
                bgcolor: (theme) =>
                  totals.balance >= 0
                    ? theme.palette.success.main + "14"
                    : theme.palette.error.main + "14",
                border: "1px solid",
                borderColor:
                  totals.balance >= 0 ? "success.main" : "error.main",
              }}
            />
          </Box>

        </Stack>


        <Divider />
      </Stack>

      {status === "loading" ? (
        <SpinnerPage status={status} />
      ) : (
        <Box
          sx={{
            flex: 1,
            width: "100%",
            minHeight: 0,
            position: "relative",
            // zoom: 0.88,
            overflow: 'hidden'
          }}
        >
          <DataGrid
            rows={filteredRows}
            columns={columns}
            getRowId={(r) => r?.id}
            disableRowSelectionOnClick
            density="comfortable"
            rowHeight={48}
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
            getRowClassName={(params) =>
              params.indexRelativeToCurrentPage % 2 === 0 ? "row-even" : "row-odd"
            }
            sx={{
              border: "none",
              zoom: 0.88,
              // Deixe as larguras/alturas a cargo do Box pai que tem flex: 1
              "& .MuiDataGrid-columnHeaders": { borderBottom: "1px solid rgba(0,0,0,0.08)" },
              "& .MuiDataGrid-cell": { borderBottom: "1px solid rgba(0,0,0,0.05)" },
              "& .row-even": { backgroundColor: "rgba(0,0,0,0.041)" },
              "& .row-odd": { backgroundColor: "transparent" },
            }}
          />
        </Box>
      )}

      {/* ✅ monta o dialog só quando precisa (melhora navegação) */}
      {editOpen ? (
        <EditTxnDialog
          open={editOpen}
          onClose={() => {
            setEditOpen(false);
            setSelectedTxn(null);
            setDialogMode("edit");
          }}
          mode={dialogMode}
          txn={selectedTxn}
          accounts={accounts}
          defaultAccountId={resolveAccountIdFast(selectedTxn)}
          onSave={handleSaveDialog}
          historyIndex={historyIndex}
        />
      ) : null}

    </Box>
  );
}
