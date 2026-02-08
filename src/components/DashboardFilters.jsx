// src/components/DashboardFilters.jsx
import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Box,
    Chip,
    IconButton,
    Popover,
    Stack,
    Typography,
    Checkbox,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import ViewWeekRoundedIcon from "@mui/icons-material/ViewWeekRounded";
import SwapVertRoundedIcon from "@mui/icons-material/SwapVertRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";


import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";



import { categories } from "../data/mockCategories";
import { setFilters, resetFilters } from "../store/financeSlice";

// helpers
function toggleInArray(arr, value) {
    const a = Array.isArray(arr) ? arr : [];
    return a.includes(value) ? a.filter((x) => x !== value) : [...a, value];
}

function labelKind(k) {
    const v = String(k || "");
    if (v === "one_off") return "Avulso";
    if (v === "recurring") return "Mensal";
    if (v === "installment") return "Parcelado";
    return v || "—";
}

function labelDirection(d) {
    const v = String(d || "");
    if (v === "expense") return "Despesa";
    if (v === "income") return "Receita";
    return v || "—";
}

export default function DashboardFilters() {
    const dispatch = useDispatch();
    const accounts = useSelector((s) => s.accounts.accounts) || [];
    const f = useSelector((s) => s.finance.filters) || {};

    const [anchor, setAnchor] = useState(null);
    const [tab, setTab] = useState("account"); // account | category | kind | direction

    const activeAccounts = useMemo(() => accounts.filter((a) => a.active), [accounts]);

    const catById = useMemo(() => {
        const m = new Map();
        for (const c of categories || []) m.set(String(c.id), c);
        return m;
    }, []);

    const accountById = useMemo(() => {
        const m = new Map();
        for (const a of accounts || []) m.set(String(a.id), a);
        return m;
    }, [accounts]);

    const kinds = useMemo(() => ["one_off", "recurring", "installment"], []);
    const directions = useMemo(() => ["expense", "income"], []);

    const open = Boolean(anchor);

    function openPopover(ev, nextTab) {
        setAnchor(ev.currentTarget);
        setTab(nextTab);
    }

    function closePopover() {
        setAnchor(null);
    }

    function setMulti(key, id) {
        dispatch(setFilters({ [key]: toggleInArray(f?.[key], id) }));
    }

    // chips (resumo)
    const chips = useMemo(() => {
        const out = [];

        for (const id of f.accountIds || []) {
            const a = accountById.get(String(id));
            out.push({
                key: `acc:${id}`,
                label: a ? a.name : String(id),
                onDelete: () =>
                    dispatch(setFilters({ accountIds: (f.accountIds || []).filter((x) => x !== id) })),
            });
        }

        for (const id of f.categoryIds || []) {
            const c = catById.get(String(id));
            out.push({
                key: `cat:${id}`,
                label: c ? c.name : String(id),
                onDelete: () =>
                    dispatch(setFilters({ categoryIds: (f.categoryIds || []).filter((x) => x !== id) })),
            });
        }

        for (const k of f.kinds || []) {
            out.push({
                key: `kind:${k}`,
                label: labelKind(k),
                onDelete: () => dispatch(setFilters({ kinds: (f.kinds || []).filter((x) => x !== k) })),
            });
        }

        for (const d of f.directions || []) {
            out.push({
                key: `dir:${d}`,
                label: labelDirection(d),
                onDelete: () =>
                    dispatch(setFilters({ directions: (f.directions || []).filter((x) => x !== d) })),
            });
        }

        return out;
    }, [f, accountById, catById, dispatch]);

    return (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            {/* Botões */}
            <Tooltip title="Conta / Cartão (multi)">
                <IconButton
                    size="small"
                    onClick={(e) => openPopover(e, "account")}
                    sx={(theme) => ({
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                        background: alpha(theme.palette.background.paper, 0.7),
                    })}
                >
                    <AccountBalanceWalletRoundedIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Categoria (multi)">
                <IconButton
                    size="small"
                    onClick={(e) => openPopover(e, "category")}
                    sx={(theme) => ({
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                        background: alpha(theme.palette.background.paper, 0.7),
                    })}
                >
                    <CategoryRoundedIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Tipo (multi)">
                <IconButton
                    size="small"
                    onClick={(e) => openPopover(e, "kind")}
                    sx={(theme) => ({
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                        background: alpha(theme.palette.background.paper, 0.7),
                    })}
                >
                    <ViewWeekRoundedIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Receita / Despesa (multi)">
                <IconButton
                    size="small"
                    onClick={(e) => openPopover(e, "direction")}
                    sx={(theme) => ({
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                        background: alpha(theme.palette.background.paper, 0.7),
                    })}
                >
                    <SwapVertRoundedIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Limpar filtros">
                <IconButton
                    size="small"
                    onClick={() => dispatch(resetFilters())}
                    sx={(theme) => ({
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                        background: alpha(theme.palette.background.paper, 0.7),
                    })}
                >
                    <RestartAltRoundedIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            {/* Chips resumo */}
            <Box
                sx={{
                    display: "flex",
                    gap: 1,
                    flexWrap: "wrap",
                    minWidth: 0,
                    alignItems: "center",
                }}
            >
                {chips.slice(0, 8).map((c) => (
                    <Chip key={c.key} label={c.label} onDelete={c.onDelete} size="small" />
                ))}
                {chips.length > 8 ? (
                    <Chip label={`+${chips.length - 8}`} size="small" variant="outlined" />
                ) : null}
            </Box>

            {/* Popover */}
            <Popover
                open={open}
                anchorEl={anchor}
                onClose={closePopover}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                PaperProps={{
                    sx: (theme) => ({
                        width: 320,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
                        overflow: "hidden",
                    }),
                }}
            >
                <Box sx={{ p: 1.25 }}>
                    <Typography sx={{ fontWeight: 950 }}>
                        {tab === "account"
                            ? "Contas / Cartões"
                            : tab === "category"
                                ? "Categorias"
                                : tab === "kind"
                                    ? "Tipos"
                                    : "Receita / Despesa"}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        Multi-select (pode marcar vários)
                    </Typography>
                </Box>

                <List dense sx={{ p: 0 }}>
                    {/* CONTAS */}
                    {tab === "account" &&
                        activeAccounts.map((a) => {
                            const checked = (f.accountIds || []).includes(a.id);
                            const isCard = a.type === "credit_card";

                            return (
                                <ListItemButton key={a.id} onClick={() => setMulti("accountIds", a.id)}>
                                    <ListItemIcon sx={{ minWidth: 34 }}>
                                        <Checkbox checked={checked} tabIndex={-1} disableRipple />
                                    </ListItemIcon>

                                    <ListItemIcon sx={{ minWidth: 30, color: "text.secondary" }}>
                                        {isCard ? (
                                            <CreditCardRoundedIcon fontSize="small" />
                                        ) : (
                                            <AccountBalanceRoundedIcon fontSize="small" />
                                        )}
                                    </ListItemIcon>

                                    <ListItemText
                                        primary={a.name}
                                        secondary={isCard ? "Cartão de crédito" : "Conta"}
                                    />
                                </ListItemButton>
                            );
                        })}

                    {/* CATEGORIAS */}
                    {tab === "category" &&
                        (categories || []).map((c) => {
                            const checked = (f.categoryIds || []).includes(String(c.id));

                            return (
                                <ListItemButton
                                    key={c.id}
                                    onClick={() => setMulti("categoryIds", String(c.id))}
                                >
                                    <ListItemIcon sx={{ minWidth: 34 }}>
                                        <Checkbox checked={checked} tabIndex={-1} disableRipple />
                                    </ListItemIcon>

                                    <ListItemIcon sx={{ minWidth: 30, color: c.tint || "text.secondary" }}>
                                        <CategoryRoundedIcon fontSize="small" />
                                    </ListItemIcon>

                                    <ListItemText primary={c.name} />
                                </ListItemButton>
                            );
                        })}

                    {/* TIPOS */}
                    {tab === "kind" &&
                        kinds.map((k) => {
                            const checked = (f.kinds || []).includes(k);

                            const icon =
                                k === "one_off" ? (
                                    <BoltRoundedIcon fontSize="small" />
                                ) : k === "recurring" ? (
                                    <ReplayRoundedIcon fontSize="small" />
                                ) : (
                                    <ViewWeekRoundedIcon fontSize="small" />
                                );

                            return (
                                <ListItemButton key={k} onClick={() => setMulti("kinds", k)}>
                                    <ListItemIcon sx={{ minWidth: 34 }}>
                                        <Checkbox checked={checked} tabIndex={-1} disableRipple />
                                    </ListItemIcon>

                                    <ListItemIcon sx={{ minWidth: 30, color: "text.secondary" }}>
                                        {icon}
                                    </ListItemIcon>

                                    <ListItemText primary={labelKind(k)} />
                                </ListItemButton>
                            );
                        })}

                    {/* DIREÇÃO */}
                    {tab === "direction" &&
                        directions.map((d) => {
                            const checked = (f.directions || []).includes(d);

                            return (
                                <ListItemButton key={d} onClick={() => setMulti("directions", d)}>
                                    <ListItemIcon sx={{ minWidth: 34 }}>
                                        <Checkbox checked={checked} tabIndex={-1} disableRipple />
                                    </ListItemIcon>

                                    <ListItemIcon
                                        sx={{
                                            minWidth: 30,
                                            color: d === "expense" ? "error.main" : "success.main",
                                        }}
                                    >
                                        {d === "expense" ? (
                                            <TrendingDownRoundedIcon fontSize="small" />
                                        ) : (
                                            <TrendingUpRoundedIcon fontSize="small" />
                                        )}
                                    </ListItemIcon>

                                    <ListItemText primary={labelDirection(d)} />
                                </ListItemButton>
                            );
                        })}
                </List>
            </Popover>
        </Stack>
    );

}
