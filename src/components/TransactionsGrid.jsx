// src/components/TransactionsGrid.jsx
import React, { useMemo, useState } from "react";
import { Box, Stack, TextField, MenuItem, Chip, Typography, Divider } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import CardChip from "./CardChip";
import { categories } from "../data/mockCategories";
import { cards } from "../data/mockCards";
import { formatBRL } from "../utils/money";
import { formatDateBR, formatMonthBR } from "../utils/dateBR";

function isoFromInput(v) {
  // input type="date" já vem YYYY-MM-DD
  return v || "";
}

function inDateRange(dateISO, fromISO, toISO) {
  if (!dateISO) return false;
  if (fromISO && dateISO < fromISO) return false;
  if (toISO && dateISO > toISO) return false;
  return true;
}

function getInstallment(row) {
  const r = row?.instance ? row.instance : row;
  return r?.installment || null;
}

export default function TransactionsGrid({ rows, month, onMonthFilterChange }) {
  const safeRows = Array.isArray(rows) ? rows : [];

  // filtros locais da tela
  const [purchaseFrom, setPurchaseFrom] = useState(""); // YYYY-MM-DD
  const [purchaseTo, setPurchaseTo] = useState(""); // YYYY-MM-DD
  const [cardFilter, setCardFilter] = useState(""); // "nubank" | "xp" | ...
  const [merchantQuery, setMerchantQuery] = useState("");
  const [descriptionQuery, setDescriptionQuery] = useState("");
  const [kindFilter, setKindFilter] = useState(""); // one_off | recurring | installment
  const [categoryFilter, setCategoryFilter] = useState("");
  const [remainingMax, setRemainingMax] = useState(""); // "" | "0".."12"

  const columns = useMemo(
    () => [
      {
        field: "purchaseDate",
        headerName: "Data Compra",
        width: 130,
        valueGetter: (params) => params?.row?.purchaseDate,
        renderCell: (params) => formatDateBR(params?.row?.purchaseDate),
      },
      {
        field: "chargeDate",
        headerName: "Data Cobrança",
        width: 140,
        valueGetter: (params) => params?.row?.chargeDate,
        renderCell: (params) => formatDateBR(params?.row?.chargeDate),
      },
      {
        field: "invoiceMonth",
        headerName: "Mês Fatura",
        width: 120,
        valueGetter: (params) => params?.row?.invoiceMonth,
        renderCell: (params) => formatMonthBR(params?.row?.invoiceMonth),
      },
      {
        field: "cardId",
        headerName: "Cartão",
        width: 120,
        renderCell: (p) => <CardChip cardId={p?.value} />,
      },
      { field: "merchant", headerName: "Loja", flex: 1, minWidth: 200 },
      { field: "description", headerName: "Descrição", flex: 1, minWidth: 260 },
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
          const row = params?.row?.instance ? params.row.instance : params?.row;
          const v = row?.categoryId;
          return categories.find((c) => c.id === v)?.name || "—";
        },
      },
      {
        field: "installment",
        headerName: "Parcela",
        width: 110,
        renderCell: (params) => {
          const row = params?.row?.instance ? params.row.instance : params?.row;
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
        width: 120,
        renderCell: (p) => (
          <Chip
            size="small"
            label={p?.value === "confirmado" ? "Confirmado" : "Previsto"}
            variant="outlined"
          />
        ),
      },
    ],
    []
  );

  const monthOptions = useMemo(() => {
    return Array.from(new Set(safeRows.map((r) => r?.invoiceMonth).filter(Boolean))).sort();
  }, [safeRows]);

  const merchantQ = merchantQuery.trim().toLowerCase();
  const descQ = descriptionQuery.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    return safeRows.filter((r) => {
      if (!r) return false;

      // mês de fatura (principal)
      if (month && r.invoiceMonth !== month) return false;

      // data compra range
      if ((purchaseFrom || purchaseTo) && !inDateRange(r.purchaseDate, purchaseFrom, purchaseTo)) {
        return false;
      }

      // cartão
      if (cardFilter && r.cardId !== cardFilter) return false;

      // loja (contains)
      if (merchantQ) {
        const m = String(r.merchant || "").toLowerCase();
        if (!m.includes(merchantQ)) return false;
      }

      // descrição (contains)
      if (descQ) {
        const d = String(r.description || "").toLowerCase();
        if (!d.includes(descQ)) return false;
      }

      // tipo
      if (kindFilter && r.kind !== kindFilter) return false;

      // categoria
      if (categoryFilter && r.categoryId !== categoryFilter) return false;

      // parcelas “acabando” (faltam <= N)
      if (remainingMax !== "") {
        const inst = getInstallment(r);
        if (!inst || typeof inst.current !== "number" || typeof inst.total !== "number") return false;

        const remaining = inst.total - inst.current; // 0 => última
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
    cardFilter,
    merchantQ,
    descQ,
    kindFilter,
    categoryFilter,
    remainingMax,
  ]);

  const filteredTotal = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + Number(r?.amount || 0), 0);
  }, [filteredRows]);

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

          <TextField
            size="small"
            select
            label="Cartão"
            value={cardFilter}
            onChange={(e) => setCardFilter(e.target.value)}
            sx={{ width: 150 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {cards.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
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
            placeholder="Ex: Mercado, assinatura, ida escritório..."
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
          getRowClassName={(p) => `row-${p?.row?.cardId || "none"}`}
          disableRowSelectionOnClick
          sx={{
            border: "none",
            "& .MuiDataGrid-columnHeaders": {
              borderBottom: "1px solid rgba(0,0,0,0.08)",
            },
            "& .MuiDataGrid-cell": { borderBottom: "1px solid rgba(0,0,0,0.06)" },
          }}
        />
      </Box>
    </Box>
  );
}
