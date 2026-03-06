import React from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Typography,
  Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";

function formatSafeBRL(formatBRL, value) {
  const n = Number(value || 0);
  return formatBRL(Math.abs(n));
}

export default function TransactionsMobileCard({
  row,
  formatBRL,
  formatDateBR,
  formatMonthBR,
  getRowShape,
  getTxnDirection,
  resolveInvoiceYM,
  resolveAccountIdFast,
  resolveCategory,
  categoriesBySlug,
  categoriesById,
  accountsById,
  STATUS_META,
  AccountChip,
  CategoryChip,
  handleEdit,
  handleDuplicate,
  handleDelete,
  onOpenQuickActions,
}) {
  const txn = getRowShape(row);
  const dir = getTxnDirection(txn);
  const isIn = dir === "in";
  const meta = STATUS_META[txn?.status] || STATUS_META.previsto;
  const accountId = resolveAccountIdFast(txn);
  const cat = resolveCategory(txn?.categoryId, categoriesBySlug, categoriesById);
  const invoiceYM = resolveInvoiceYM(txn, accountsById);

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        overflow: "hidden",
        borderColor: "rgba(0,0,0,0.08)",
        boxShadow: "0 4px 18px rgba(15,23,42,0.06)",
      }}
    >
      <CardContent sx={{ p: 1.25 }}>
        <Stack spacing={1}>
          <Stack direction="row" alignItems="flex-start" gap={1}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                bgcolor: isIn ? "rgba(46,125,50,0.12)" : "rgba(211,47,47,0.12)",
                color: isIn ? "#1b5e20" : "#b71c1c",
                flexShrink: 0,
              }}
            >
              {isIn ? <ArrowUpwardRoundedIcon fontSize="small" /> : <ArrowDownwardRoundedIcon fontSize="small" />}
            </Box>

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }} noWrap title={txn?.merchant || "—"}>
                    {txn?.merchant || "—"}
                  </Typography>
                  {!!txn?.description && txn.description !== txn?.merchant ? (
                    <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap title={txn?.description}>
                      {txn?.description}
                    </Typography>
                  ) : null}
                </Box>

                <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                  <Typography
                    sx={{
                      fontWeight: 950,
                      letterSpacing: -0.2,
                      color: isIn ? "success.main" : "error.main",
                    }}
                  >
                    {formatSafeBRL(formatBRL, txn?.amount)}
                  </Typography>
                  <Chip
                    size="small"
                    label={meta.label}
                    sx={{
                      mt: 0.4,
                      fontWeight: 900,
                      bgcolor: meta.sx.bgcolor,
                      color: meta.sx.color,
                      height: 24,
                    }}
                  />
                </Box>
              </Stack>
            </Box>
          </Stack>

          <Stack direction="row" flexWrap="wrap" gap={0.8}>
            <Chip
              size="small"
              variant="outlined"
              label={formatDateBR(txn?.purchaseDate)}
              sx={{ fontWeight: 800, borderRadius: 999 }}
            />

            {invoiceYM ? (
              <Chip
                size="small"
                variant="outlined"
                label={`Fatura ${formatMonthBR(invoiceYM)}`}
                sx={{ fontWeight: 800, borderRadius: 999 }}
              />
            ) : null}

            <AccountChip accountId={accountId} accountsById={accountsById} />
            <CategoryChip cat={cat} />

            {txn?.installment ? (
              <Chip
                size="small"
                variant="outlined"
                label={`${txn.installment.current ?? "—"}/${txn.installment.total ?? "—"}`}
                sx={{ fontWeight: 800, borderRadius: 999 }}
              />
            ) : null}
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
              {txn?.kind || "one_off"}
            </Typography>

            <Stack direction="row" spacing={0.2}>
              <Tooltip title="Editar">
                <IconButton size="small" onClick={() => handleEdit(txn)}>
                  <EditRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Duplicar">
                <IconButton size="small" onClick={() => handleDuplicate(txn)}>
                  <ContentCopyRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Excluir">
                <IconButton size="small" onClick={() => handleDelete(txn)} sx={{ color: "error.main" }}>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {onOpenQuickActions ? (
                <Tooltip title="Mais ações">
                  <IconButton size="small" onClick={() => onOpenQuickActions(txn)}>
                    <MoreHorizRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
