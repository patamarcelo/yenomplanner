// Patch para o seu TransactionsGrid.jsx
// Mantém desktop com DataGrid e cria experiência própria para mobile.

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
  CircularProgress,
  Snackbar,
  useMediaQuery,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { alpha, useTheme } from "@mui/material/styles";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";

import TransactionsMobileCard from "./TransactionsMobileCard";
import TransactionsMobileFiltersSheet from "./TransactionsMobileFiltersSheet";

// ... mantenha TODOS os imports/helpers/constantes que você já tem hoje no seu arquivo original
// ... mantenha STATUS_META, getRowShape, getTxnDirection, resolveCategory, AccountChip, CategoryChip etc.

export default function TransactionsGrid({ rows, month, onMonthFilterChange, status }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // ... mantenha TODO o miolo do seu componente atual:
  // estados, filtros, memos, filteredRows, totals, handleDelete, handleEdit, handleDuplicate,
  // handleExportXlsx, columns, dialogs, etc.

  // adicione este estado:
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // substitua o RETURN do trecho principal por esta estrutura:
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.2,
        minHeight: 0,
        width: "100%",
      }}
    >
      {/* Header resumido para mobile */}
      <Stack
        direction={isMobile ? "column" : "row"}
        alignItems={isMobile ? "stretch" : "center"}
        justifyContent="space-between"
        gap={1}
      >
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography sx={{ fontWeight: 950, fontSize: isMobile ? 18 : 20 }}>
            Lançamentos
          </Typography>
          <Chip size="small" label={`Itens: ${filteredRows.length}`} sx={{ fontWeight: 900 }} />
        </Stack>

        <Stack direction="row" gap={1} flexWrap="wrap">
          {isMobile ? (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FilterListRoundedIcon />}
                onClick={() => setMobileFiltersOpen(true)}
                sx={{ fontWeight: 900, borderRadius: 999 }}
              >
                Filtros
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadRoundedIcon />}
                onClick={handleExportXlsx}
                sx={{ fontWeight: 900, borderRadius: 999 }}
              >
                Exportar
              </Button>
            </>
          ) : (
            <>
              {/* mantenha aqui seu toolbar/filtros desktop exatamente como já está hoje */}
            </>
          )}
        </Stack>
      </Stack>

      {/* KPIs compactos */}
      <Stack direction="row" gap={0.8} flexWrap="wrap">
        <Chip
          size="small"
          label={`Entradas: ${formatBRL(totals.income)}`}
          sx={{
            fontWeight: 900,
            color: "success.main",
            bgcolor: (t) => t.palette.success.main + "14",
            border: "1px solid",
            borderColor: "success.main",
          }}
        />
        <Chip
          size="small"
          label={`Saídas: ${formatBRL(totals.expense)}`}
          sx={{
            fontWeight: 900,
            color: "error.main",
            bgcolor: (t) => t.palette.error.main + "14",
            border: "1px solid",
            borderColor: "error.main",
          }}
        />
        <Chip
          size="small"
          label={`Saldo: ${formatBRL(totals.balance)}`}
          sx={{
            fontWeight: 950,
            color: totals.balance >= 0 ? "success.main" : "error.main",
            bgcolor: (t) => (totals.balance >= 0 ? t.palette.success.main + "14" : t.palette.error.main + "14"),
            border: "1px solid",
            borderColor: totals.balance >= 0 ? "success.main" : "error.main",
          }}
        />
      </Stack>

      {status === "loading" ? (
        <SpinnerPage status={status} />
      ) : isMobile ? (
        <Stack spacing={1}>
          {filteredRows.map((row) => (
            <TransactionsMobileCard
              key={row?.id}
              row={row}
              formatBRL={formatBRL}
              formatDateBR={formatDateBR}
              formatMonthBR={formatMonthBR}
              getRowShape={getRowShape}
              getTxnDirection={getTxnDirection}
              resolveInvoiceYM={resolveInvoiceYM}
              resolveAccountIdFast={resolveAccountIdFast}
              resolveCategory={resolveCategory}
              categoriesBySlug={categoriesBySlug}
              categoriesById={categoriesById}
              accountsById={accountsIndex.accountsById}
              STATUS_META={STATUS_META}
              AccountChip={AccountChip}
              CategoryChip={CategoryChip}
              handleEdit={handleEdit}
              handleDuplicate={handleDuplicate}
              handleDelete={handleDelete}
            />
          ))}

          {filteredRows.length === 0 ? (
            <Alert severity="info">Nenhum lançamento encontrado para os filtros atuais.</Alert>
          ) : null}
        </Stack>
      ) : (
        <Box
          sx={{
            flex: 1,
            width: "100%",
            minHeight: 0,
            position: "relative",
            overflow: "hidden",
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
          />
        </Box>
      )}

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

      {/* mantenha seus dialogs/snackbar/edit dialog já existentes aqui embaixo */}
    </Box>
  );
}
