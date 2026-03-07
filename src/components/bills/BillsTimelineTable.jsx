// src/components/bills/BillsTimelineTable.jsx
import React from "react";
import {
    Box,
    Card,
    CardContent,
    Chip,
    Divider,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";

function formatBRL(v) {
    const n = Number(v || 0);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatBRDate(iso) {
    if (!iso || String(iso).length !== 10) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}

function moneySafe(v) {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return formatBRL(n);
}

function kindLabel(kind) {
    if (kind === "one_off") return "Pontual";
    if (kind === "installment") return "Parcelado";
    return "Recorrente";
}

function StatusChip({ uiStatus, STATUS_META }) {
    const meta = STATUS_META?.[uiStatus] || STATUS_META?.planned;

    return (
        <Chip
            size="small"
            label={meta?.label || "Previsto"}
            variant="outlined"
            sx={{
                height: 24,
                fontWeight: 900,
                borderRadius: 999,
                bgcolor: alpha(meta?.dot || "#1976d2", 0.1),
                borderColor: alpha(meta?.dot || "#1976d2", 0.35),
                color: meta?.chipSx?.color || "text.primary",
            }}
        />
    );
}

function CategoryBadge({ cat }) {
    if (!cat) {
        return (
            <Chip
                size="small"
                label="—"
                variant="outlined"
                sx={{ height: 24, fontWeight: 800, borderRadius: 999 }}
            />
        );
    }

    return (
        <Chip
            size="small"
            label={cat.name}
            variant="outlined"
            sx={{
                height: 24,
                fontWeight: 900,
                borderRadius: 999,
                bgcolor: alpha(cat.color || "#64748b", 0.10),
                borderColor: alpha(cat.color || "#64748b", 0.30),
            }}
        />
    );
}

export default function BillsTimelineTable({
    timeline = [],
    theme,
    STATUS_META,
    resolveCategoryFromBill,
    onPay,
    onEdit,
    onDelete,
    onGenerate,
    onReopen,
}) {
    if (!timeline.length) return null;

    return (
        <Stack spacing={1.4}>
            {timeline.map((monthBlock) => {
                const mt = monthBlock.monthTotals || {
                    all: 0,
                    open: 0,
                    paid: 0,
                    due_today: 0,
                    overdue: 0,
                    planned: 0,
                };

                return (
                    <Card
                        key={monthBlock.monthKey}
                        variant="outlined"
                        sx={{
                            borderRadius: 1,
                            overflow: "hidden",
                        }}
                    >
                        <Box
                            sx={{
                                px: 1.5,
                                py: 1.1,
                                borderBottom: `1px solid ${theme.palette.divider}`,
                                bgcolor: alpha(theme.palette.primary.main, 0.01),
                            }}
                        >
                            <Stack
                                direction={{ xs: "column", md: "row" }}
                                alignItems={{ xs: "flex-start", md: "center" }}
                                justifyContent="space-between"
                                gap={1}
                            >
                                <Typography
                                    sx={{
                                        fontWeight: 950,
                                        fontSize: 17,
                                        textTransform: "capitalize",
                                    }}
                                >
                                    {monthBlock.monthLabel}
                                </Typography>

                                <Stack direction="row" gap={0.8} sx={{ flexWrap: "wrap" }}>
                                    <Chip
                                        size="small"
                                        label={`Em aberto: ${formatBRL((mt.open || 0) / 100)}`}
                                        variant="outlined"
                                        sx={{
                                            fontWeight: 950,
                                            borderRadius: 999,
                                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                                        }}
                                    />
                                    <Chip
                                        size="small"
                                        label={`Pago: ${formatBRL((mt.paid || 0) / 100)}`}
                                        variant="outlined"
                                        sx={{
                                            fontWeight: 950,
                                            borderRadius: 999,
                                            bgcolor: alpha(theme.palette.success.main, 0.08),
                                        }}
                                    />
                                    <Chip
                                        size="small"
                                        label={`Total: ${formatBRL((mt.all || 0) / 100)}`}
                                        variant="outlined"
                                        sx={{
                                            fontWeight: 950,
                                            borderRadius: 999,
                                            bgcolor: alpha(theme.palette.text.primary, 0.04),
                                        }}
                                    />
                                </Stack>
                            </Stack>
                        </Box>

                        <CardContent sx={{ p: 0 }}>
                            <Box sx={{ overflowX: "auto" }}>
                                <Table
                                    size="small"
                                    sx={{
                                        minWidth: 980,
                                        "& .MuiTableCell-root": {
                                            borderBottomColor: alpha(theme.palette.divider, 0.8),
                                        },
                                    }}
                                >
                                    <TableHead>
                                        <TableRow
                                            sx={{
                                                bgcolor: alpha(theme.palette.info.main, 0.9),
                                                color: 'whitesmoke'
                                            }}
                                        >
                                            <TableCell sx={{ fontWeight: 950, color: 'whitesmoke' }}>Vencimento</TableCell>
                                            <TableCell sx={{ fontWeight: 950, color: 'whitesmoke' }}>Descrição</TableCell>
                                            <TableCell sx={{ fontWeight: 950, color: 'whitesmoke' }}>Favorecido</TableCell>
                                            <TableCell sx={{ fontWeight: 950, color: 'whitesmoke' }}>Categoria</TableCell>
                                            <TableCell sx={{ fontWeight: 950, color: 'whitesmoke' }}>Tipo</TableCell>
                                            <TableCell sx={{ fontWeight: 950, color: 'whitesmoke' }}>Parcela</TableCell>
                                            <TableCell sx={{ fontWeight: 950, color: 'whitesmoke' }}>Status</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 950, color: 'whitesmoke' }}>Valor</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 950, color: 'whitesmoke' }}>Ações</TableCell>
                                        </TableRow>
                                    </TableHead>

                                    <TableBody>
                                        {monthBlock.days.map((dayBlock) => (
                                            <React.Fragment key={dayBlock.dayKey}>
                                                <TableRow
                                                    sx={{
                                                        // bgcolor: alpha(theme.palette.primary.main, 0.025),
                                                        bgcolor: alpha(theme.palette.secondary.main, 0.75),
                                                    }}
                                                >
                                                    <TableCell colSpan={9} sx={{ py: 1 }}>
                                                        <Stack
                                                            direction={{ xs: "column", md: "row" }}
                                                            alignItems={{ xs: "flex-start", md: "center" }}
                                                            justifyContent="space-between"
                                                            gap={1}
                                                        >
                                                            <Typography
                                                                sx={{
                                                                    fontWeight: 950,
                                                                    fontSize: 13,
                                                                    color: "whitesmoke",
                                                                }}
                                                            >
                                                                {dayBlock.dayLabel}
                                                            </Typography>

                                                            <Stack direction="row" gap={0.7} sx={{ flexWrap: "wrap" }}>
                                                                {(dayBlock.totals?.paid || 0) > 0 ? (
                                                                    <Chip
                                                                        size="small"
                                                                        label={`Pago: ${formatBRL((dayBlock.totals.paid || 0) / 100)}`}
                                                                        variant="outlined"
                                                                        sx={{ fontWeight: 900, borderRadius: 999, color: 'white' , bgcolor: alpha(theme.palette.success.main, 0.98),}}
                                                                    />
                                                                ) : null}

                                                                {(dayBlock.totals?.overdue || 0) > 0 ? (
                                                                    <Chip
                                                                        size="small"
                                                                        label={`Atrasado: ${formatBRL((dayBlock.totals.overdue || 0) / 100)}`}
                                                                        variant="outlined"
                                                                        sx={{
                                                                            fontWeight: 900,
                                                                            borderRadius: 999,
                                                                            bgcolor: alpha(theme.palette.error.main, 0.78),
                                                                            color: 'whitesmoke'
                                                                        }}
                                                                    />
                                                                ) : null}

                                                                {(dayBlock.totals?.planned || 0) > 0 ? (
                                                                    <Chip
                                                                        size="small"
                                                                        label={`Previsto: ${formatBRL((dayBlock.totals.planned || 0) / 100)}`}
                                                                        variant="outlined"
                                                                        sx={{
                                                                            fontWeight: 900,
                                                                            borderRadius: 999,
                                                                            bgcolor: alpha(theme.palette.info.main, 0.78),
                                                                            color: 'whitesmoke'
                                                                        }}
                                                                    />
                                                                ) : null}

                                                                {(dayBlock.totals?.due_today || 0) > 0 ? (
                                                                    <Chip
                                                                        size="small"
                                                                        label={`Vence hoje: ${formatBRL((dayBlock.totals.due_today || 0) / 100)}`}
                                                                        variant="outlined"
                                                                        sx={{
                                                                            fontWeight: 900,
                                                                            borderRadius: 999,
                                                                            bgcolor: alpha(theme.palette.warning.main, 0.50),
                                                                        }}
                                                                    />
                                                                ) : null}
                                                            </Stack>
                                                        </Stack>
                                                    </TableCell>
                                                </TableRow>

                                                {dayBlock.items.map(({ bill: b, dueISO, uiStatus }) => {
                                                    const cat = resolveCategoryFromBill ? resolveCategoryFromBill(b) : null;

                                                    return (
                                                        <TableRow
                                                            key={b.id}
                                                            hover
                                                            sx={{
                                                                "&:hover": {
                                                                    bgcolor: alpha(theme.palette.primary.main, 0.025),
                                                                },
                                                            }}
                                                        >
                                                            <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 900 }}>
                                                                {formatBRDate(dueISO)}
                                                            </TableCell>

                                                            <TableCell sx={{ minWidth: 220 }}>
                                                                <Typography sx={{ fontWeight: 900 }}>
                                                                    {b.name || "—"}
                                                                </Typography>
                                                                {b.notes ? (
                                                                    <Typography
                                                                        variant="caption"
                                                                        sx={{
                                                                            color: "text.secondary",
                                                                            display: "block",
                                                                            mt: 0.2,
                                                                        }}
                                                                    >
                                                                        {b.notes}
                                                                    </Typography>
                                                                ) : null}
                                                            </TableCell>

                                                            <TableCell sx={{ color: "text.secondary", fontWeight: 700 }}>
                                                                {b.payee || "—"}
                                                            </TableCell>

                                                            <TableCell>
                                                                <CategoryBadge cat={cat} />
                                                            </TableCell>

                                                            <TableCell sx={{ fontWeight: 800 }}>
                                                                {kindLabel(b.kind)}
                                                            </TableCell>

                                                            <TableCell sx={{ fontWeight: 800 }}>
                                                                {b.installmentTotal
                                                                    ? `${b.installmentCurrent}/${b.installmentTotal}`
                                                                    : "—"}
                                                            </TableCell>

                                                            <TableCell>
                                                                <StatusChip
                                                                    uiStatus={uiStatus}
                                                                    STATUS_META={STATUS_META}
                                                                />
                                                            </TableCell>

                                                            <TableCell
                                                                align="right"
                                                                sx={{
                                                                    whiteSpace: "nowrap",
                                                                    fontWeight: 950,
                                                                    fontSize: 14,
                                                                }}
                                                            >
                                                                {moneySafe(b.defaultAmount)}
                                                            </TableCell>

                                                            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                                                <Stack
                                                                    direction="row"
                                                                    spacing={0.25}
                                                                    justifyContent="flex-end"
                                                                >
                                                                    {uiStatus !== "paid" ? (
                                                                        <Tooltip title="Pagar">
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={() => onPay?.(b)}
                                                                            >
                                                                                <PaidRoundedIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    ) : (
                                                                        <Tooltip title="Reabrir">
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={() => onReopen?.(b)}
                                                                            >
                                                                                <ReplayRoundedIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    )}

                                                                    <Tooltip title="Editar">
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={() => onEdit?.(b)}
                                                                        >
                                                                            <EditRoundedIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>

                                                                    <Tooltip title="Gerar">
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={() => onGenerate?.(b)}
                                                                        >
                                                                            <PlayArrowRoundedIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>

                                                                    <Tooltip title="Excluir">
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={() => onDelete?.(b)}
                                                                            sx={{ color: theme.palette.error.main }}
                                                                        >
                                                                            <DeleteOutlineRoundedIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                </Stack>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </React.Fragment>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Box>
                        </CardContent>
                    </Card>
                );
            })}
        </Stack>
    );
}