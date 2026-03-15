import React, { useMemo } from "react";
import {
    Dialog,
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    Stack,
    TextField,
    Button,
    MenuItem,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import CategoryOption from "./categories/CategoryOption";

function formatMonthLabel(ym) {
    if (!ym) return "";
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1, 1);

    return d.toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
    });
}

export default function TransactionsMobileFiltersSheet({
    open,
    onClose,

    rows,

    monthFilter,
    setMonthFilter,

    purchaseFrom,
    setPurchaseFrom,
    purchaseTo,
    setPurchaseTo,

    accountFilter,
    setAccountFilter,
    accounts,

    categoryFilter,
    setCategoryFilter,
    categories,

    kindFilter,
    setKindFilter,

    statusFilter,
    setStatusFilter,
    STATUS_META,

    tipoFilter,
    setTipoFilter,

    merchantQuery,
    setMerchantQuery,

    descriptionQuery,
    setDescriptionQuery,

    remainingMax,
    setRemainingMax,

    handleClearFilters,
}) {
    /* gera lista única de meses */
    const months = useMemo(() => {
        const set = new Set();

        rows.forEach((r) => {
            const ym =
                r.invoiceMonth ||
                r.invoice_month ||
                (r.chargeDate ? r.chargeDate.slice(0, 7) : null);

            if (ym) set.add(ym);
        });

        return Array.from(set).sort().reverse();
    }, [rows]);

    return (
        <Dialog fullScreen open={open} onClose={onClose}>
            <AppBar sx={{ position: "relative", borderRadius: 0 }}>
                <Toolbar>
                    <IconButton edge="start" color="inherit" onClick={onClose}>
                        <CloseIcon />
                    </IconButton>

                    <Typography sx={{ ml: 2, flex: 1, fontWeight: 900 }} variant="h6">
                        Filtros
                    </Typography>

                    <Button
                        color="inherit"
                        onClick={handleClearFilters}
                        sx={{ borderRadius: 1.4, fontWeight: 800 }}
                    >
                        Limpar
                    </Button>
                </Toolbar>
            </AppBar>

            <Stack spacing={2} sx={{ p: 2 }}>
                {/* mês da fatura */}
                <TextField
                    select
                    label="Mês da fatura"
                    size="small"
                    value={monthFilter || ""}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    sx={{
                        "& .MuiOutlinedInput-root": {
                            borderRadius: 1.4,
                        },
                    }}
                >
                    <MenuItem value="">Todos</MenuItem>

                    {months.map((m) => (
                        <MenuItem key={m} value={m}>
                            {formatMonthLabel(m)}
                        </MenuItem>
                    ))}
                </TextField>

                {/* período compra */}
                <Stack direction="row" spacing={2}>
                    <TextField
                        label="Compra de"
                        type="date"
                        size="small"
                        fullWidth
                        value={purchaseFrom || ""}
                        onChange={(e) => setPurchaseFrom(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                borderRadius: 1.4,
                            },
                        }}
                    />

                    <TextField
                        label="Até"
                        type="date"
                        size="small"
                        fullWidth
                        value={purchaseTo || ""}
                        onChange={(e) => setPurchaseTo(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                borderRadius: 1.4,
                            },
                        }}
                    />
                </Stack>

                {/* conta */}
                <TextField
                    select
                    label="Conta"
                    size="small"
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.4 } }}
                >
                    <MenuItem value="">Todas</MenuItem>

                    {accounts.map((a) => (
                        <MenuItem key={a.id} value={String(a.id)}>
                            {a.name}
                        </MenuItem>
                    ))}
                </TextField>

                {/* categoria */}
                <TextField
                    select
                    label="Categoria"
                    size="small"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.4 } }}
                >
                    <MenuItem value="">Todas</MenuItem>

                    {categories.map((c) => (
                        <MenuItem key={c.id} value={c.slug}>
                            <CategoryOption category={c} />
                        </MenuItem>
                    ))}
                </TextField>

                {/* tipo */}
                <TextField
                    select
                    label="Tipo"
                    size="small"
                    value={kindFilter}
                    onChange={(e) => setKindFilter(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.4 } }}
                >
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="one_off">Avulso</MenuItem>
                    <MenuItem value="recurring">Recorrente</MenuItem>
                    <MenuItem value="installment">Parcelado</MenuItem>
                </TextField>

                {/* status */}
                <TextField
                    select
                    label="Status"
                    size="small"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.4 } }}
                >
                    <MenuItem value="">Todos</MenuItem>

                    {Object.entries(STATUS_META).map(([k, v]) => (
                        <MenuItem key={k} value={k}>
                            {v.label}
                        </MenuItem>
                    ))}
                </TextField>

                {/* direção */}
                <TextField
                    select
                    label="Direção"
                    size="small"
                    value={tipoFilter}
                    onChange={(e) => setTipoFilter(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.4 } }}
                >
                    <MenuItem value="">Todas</MenuItem>
                    <MenuItem value="income">Entrada</MenuItem>
                    <MenuItem value="expense">Saída</MenuItem>
                </TextField>

                {/* busca */}
                <TextField
                    size="small"
                    label="Loja"
                    value={merchantQuery}
                    onChange={(e) => setMerchantQuery(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.4 } }}
                />

                <TextField
                    size="small"
                    label="Descrição"
                    value={descriptionQuery}
                    onChange={(e) => setDescriptionQuery(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.4 } }}
                />

                <TextField
                    size="small"
                    type="number"
                    label="Parcelas restantes ≤"
                    value={remainingMax}
                    onChange={(e) => setRemainingMax(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.4 } }}
                />

                <Button
                    variant="contained"
                    onClick={onClose}
                    sx={{
                        borderRadius: 1.4,
                        fontWeight: 900,
                    }}
                >
                    Aplicar
                </Button>
            </Stack>
        </Dialog>
    );
}