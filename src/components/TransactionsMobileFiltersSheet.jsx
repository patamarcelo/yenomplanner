import React from "react";
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

export default function TransactionsMobileFiltersSheet({
    open,
    onClose,

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
    categoriesBySlug,

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
    return (
        <Dialog fullScreen open={open} onClose={onClose}>
            <AppBar sx={{ position: "relative" }}>
                <Toolbar>
                    <IconButton edge="start" color="inherit" onClick={onClose}>
                        <CloseIcon />
                    </IconButton>

                    <Typography sx={{ ml: 2, flex: 1 }} variant="h6">
                        Filtros
                    </Typography>

                    <Button color="inherit" onClick={handleClearFilters}>
                        Limpar
                    </Button>
                </Toolbar>
            </AppBar>

            <Stack spacing={2} sx={{ p: 2 }}>
                <Stack direction="row" spacing={2}>
                    <TextField
                        label="Compra de"
                        type="date"
                        size="small"
                        fullWidth
                        value={purchaseFrom || ""}
                        onChange={(e) => setPurchaseFrom(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />

                    <TextField
                        label="Até"
                        type="date"
                        size="small"
                        fullWidth
                        value={purchaseTo || ""}
                        onChange={(e) => setPurchaseTo(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />
                </Stack>

                <TextField
                    select
                    label="Conta"
                    size="small"
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                >
                    <MenuItem value="">Todas</MenuItem>

                    {accounts.map((a) => (
                        <MenuItem key={a.id} value={String(a.id)}>
                            {a.name}
                        </MenuItem>
                    ))}
                </TextField>

                <TextField
                    select
                    label="Categoria"
                    size="small"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                >
                    <MenuItem value="">Todas</MenuItem>

                    {categories.map((c) => (
                        <MenuItem key={c.id} value={c.slug}>
                            <CategoryOption category={c} />
                        </MenuItem>
                    ))}
                </TextField>

                <TextField
                    select
                    label="Tipo"
                    size="small"
                    value={kindFilter}
                    onChange={(e) => setKindFilter(e.target.value)}
                >
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="one_off">Avulso</MenuItem>
                    <MenuItem value="recurring">Recorrente</MenuItem>
                    <MenuItem value="installment">Parcelado</MenuItem>
                </TextField>

                <TextField
                    select
                    label="Status"
                    size="small"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <MenuItem value="">Todos</MenuItem>

                    {Object.entries(STATUS_META).map(([k, v]) => (
                        <MenuItem key={k} value={k}>
                            {v.label}
                        </MenuItem>
                    ))}
                </TextField>

                <TextField
                    select
                    label="Direção"
                    size="small"
                    value={tipoFilter}
                    onChange={(e) => setTipoFilter(e.target.value)}
                >
                    <MenuItem value="">Todas</MenuItem>
                    <MenuItem value="income">Entrada</MenuItem>
                    <MenuItem value="expense">Saída</MenuItem>
                </TextField>

                <TextField
                    size="small"
                    label="Loja"
                    value={merchantQuery}
                    onChange={(e) => setMerchantQuery(e.target.value)}
                />

                <TextField
                    size="small"
                    label="Descrição"
                    value={descriptionQuery}
                    onChange={(e) => setDescriptionQuery(e.target.value)}
                />

                <TextField
                    size="small"
                    type="number"
                    label="Parcelas restantes ≤"
                    value={remainingMax}
                    onChange={(e) => setRemainingMax(e.target.value)}
                />

                <Button variant="contained" onClick={onClose}>
                    Aplicar
                </Button>
            </Stack>
        </Dialog>
    );
}