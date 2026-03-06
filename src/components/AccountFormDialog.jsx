import React, { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stack,
    TextField,
    MenuItem,
    Typography,
    Box,
    Divider,
    ToggleButton,
    ToggleButtonGroup,
    Autocomplete,
    CircularProgress,
    Slider,
} from "@mui/material";

import {
    BRAZIL_BANKS,
    buildBankShareText,
    formatCPF,
    formatCNPJ,
    onlyDigits,
} from "../utils/accountBankShare";

function emptyCheckingBankDetails() {
    return {
        bankCode: "",
        bankName: "",
        branch: "",
        accountNumber: "",
        accountDigit: "",
        accountKind: "checking",
        holderName: "",
        documentType: "cpf",
        documentNumber: "",
        pixKeyType: "",
        pixKey: "",
    };
}

const ACCOUNT_COLOR_PRESETS = [
    "#3B82F6",
    "#6366F1",
    "#8B5CF6",
    "#A855F7",
    "#EC4899",
    "#EF4444",
    "#F97316",
    "#F59E0B",
    "#22C55E",
    "#10B981",
    "#06B6D4",
    "#64748B",
];

function clampAlpha(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0.16;
    return Math.min(0.6, Math.max(0.08, n));
}

function normalizeHex(value) {
    let raw = String(value || "").trim().replace(/[^0-9a-fA-F#]/g, "");
    raw = raw.replace(/#/g, "");

    if (raw.length > 6) raw = raw.slice(0, 6);

    if (raw.length === 3) {
        raw = raw
            .split("")
            .map((c) => c + c)
            .join("");
    }

    return `#${raw}`.toUpperCase();
}

function isFullHex(v) {
    return /^#[0-9A-F]{6}$/i.test(String(v || ""));
}

function hexToRgbParts(hex) {
    const normalized = normalizeHex(hex);
    if (!isFullHex(normalized)) {
        return { r: 100, g: 116, b: 139 };
    }

    return {
        r: parseInt(normalized.slice(1, 3), 16),
        g: parseInt(normalized.slice(3, 5), 16),
        b: parseInt(normalized.slice(5, 7), 16),
    };
}

function hexToRgba(hex, alpha = 0.16) {
    const { r, g, b } = hexToRgbParts(hex);
    return `rgba(${r}, ${g}, ${b}, ${clampAlpha(alpha)})`;
}

function rgbaToHex(rgba) {
    const m = String(rgba || "").match(
        /rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)/
    );
    if (!m) return "#64748B";

    const r = Number(m[1]).toString(16).padStart(2, "0");
    const g = Number(m[2]).toString(16).padStart(2, "0");
    const b = Number(m[3]).toString(16).padStart(2, "0");

    return `#${r}${g}${b}`.toUpperCase();
}

function rgbaToAlpha(rgba) {
    const m = String(rgba || "").match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
    return clampAlpha(m ? Number(m[1]) : 0.16);
}

export default function AccountFormDialog({
    open,
    onClose,
    onSubmit,
    initial = null,
    saving = false,
}) {
    const isEdit = !!initial;

    const [type, setType] = useState("checking");
    const [name, setName] = useState("");
    const [externalId, setExternalId] = useState("");
    const [active, setActive] = useState(true);
    const [openingBalance, setOpeningBalance] = useState("");

    const [limit, setLimit] = useState("");
    const [cutoffDay, setCutoffDay] = useState("");
    const [dueDay, setDueDay] = useState("");

    const [bankDetails, setBankDetails] = useState(emptyCheckingBankDetails());

    const [savedColorHex, setSavedColorHex] = useState("#64748B");
    const [savedAlpha, setSavedAlpha] = useState(0.16);

    const [draftColorHex, setDraftColorHex] = useState("#64748B");
    const [draftAlpha, setDraftAlpha] = useState(0.16);

    const [editingColor, setEditingColor] = useState(false);

    useEffect(() => {
        if (!open) return;

        const initColor = initial?.color || "rgba(100, 116, 139, 0.16)";
        const initHex = rgbaToHex(initColor);
        const initAlpha = rgbaToAlpha(initColor);

        setType(initial?.type || "checking");
        setName(initial?.name || "");
        setExternalId(initial?.externalId || initial?.external_id || "");
        setActive(initial?.active ?? true);

        setOpeningBalance(
            initial?.openingBalance !== null && initial?.openingBalance !== undefined
                ? String(initial.openingBalance)
                : ""
        );

        setLimit(
            initial?.limit !== null && initial?.limit !== undefined
                ? String(initial.limit)
                : ""
        );

        setCutoffDay(
            initial?.statement?.cutoffDay !== null &&
                initial?.statement?.cutoffDay !== undefined
                ? String(initial.statement.cutoffDay)
                : ""
        );

        setDueDay(
            initial?.statement?.dueDay !== null &&
                initial?.statement?.dueDay !== undefined
                ? String(initial.statement.dueDay)
                : ""
        );

        setBankDetails({
            ...emptyCheckingBankDetails(),
            ...(initial?.bankDetails || {}),
        });

        setSavedColorHex(initHex);
        setSavedAlpha(initAlpha);
        setDraftColorHex(initHex);
        setDraftAlpha(initAlpha);
        setEditingColor(false);
    }, [open, initial]);

    const color = useMemo(() => {
        return hexToRgba(savedColorHex, savedAlpha);
    }, [savedColorHex, savedAlpha]);

    const draftPreviewColor = useMemo(() => {
        return hexToRgba(draftColorHex, draftAlpha);
    }, [draftColorHex, draftAlpha]);

    const draftRgbaText = useMemo(() => {
        return hexToRgba(draftColorHex, draftAlpha);
    }, [draftColorHex, draftAlpha]);

    const sharePreview = useMemo(() => {
        return buildBankShareText({ bankDetails });
    }, [bankDetails]);

    const selectedBank =
        BRAZIL_BANKS.find((b) => b.code === bankDetails.bankCode) || null;

    function setBankField(field, value) {
        setBankDetails((prev) => ({ ...prev, [field]: value }));
    }

    function handleStartColorEdit() {
        setDraftColorHex(savedColorHex);
        setDraftAlpha(savedAlpha);
        setEditingColor(true);
    }

    function handleCancelColorEdit() {
        setDraftColorHex(savedColorHex);
        setDraftAlpha(savedAlpha);
        setEditingColor(false);
    }

    function handleConfirmColor() {
        const finalHex = isFullHex(draftColorHex)
            ? normalizeHex(draftColorHex)
            : savedColorHex;

        setSavedColorHex(finalHex);
        setSavedAlpha(clampAlpha(draftAlpha));
        setEditingColor(false);
    }

    function handlePresetPick(hex) {
        setDraftColorHex(normalizeHex(hex));
        if (!editingColor) setEditingColor(true);
    }

    function handleSubmit() {
        const payload = {
            externalId: externalId.trim(),
            type,
            name: name.trim(),
            color,
            active,
            openingBalance,
        };

        if (type === "credit_card") {
            payload.limit = limit;
            payload.statement = {
                cutoffDay: cutoffDay ? Number(cutoffDay) : null,
                dueDay: dueDay ? Number(dueDay) : null,
            };
        } else {
            payload.bankDetails = {
                ...bankDetails,
                bankCode: onlyDigits(bankDetails.bankCode),
                branch: onlyDigits(bankDetails.branch),
                accountNumber: onlyDigits(bankDetails.accountNumber),
                accountDigit: onlyDigits(bankDetails.accountDigit),
                documentNumber: onlyDigits(bankDetails.documentNumber),
                holderName: String(bankDetails.holderName || "").toUpperCase(),
            };
        }

        onSubmit?.(payload);
    }

    return (
        <Dialog
            open={open}
            onClose={saving ? undefined : onClose}
            fullWidth
            maxWidth="sm"
        >
            <DialogTitle sx={{ pb: 1 }}>
                {isEdit ? "Editar conta" : "Nova conta"}
            </DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2}>
                    <Box>
                        <Typography sx={{ fontWeight: 800, mb: 1 }}>
                            Tipo de conta
                        </Typography>

                        <ToggleButtonGroup
                            value={type}
                            exclusive
                            onChange={(_, v) => v && setType(v)}
                            fullWidth
                            size="small"
                        >
                            <ToggleButton value="checking">Conta corrente</ToggleButton>
                            <ToggleButton value="credit_card">Cartão</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    <Divider />

                    <Box
                        sx={{
                            p: 2,
                            borderRadius: 2,
                            border: (t) => `1px solid ${t.palette.divider}`,
                        }}
                    >
                        <Typography sx={{ fontWeight: 800, mb: 1.25 }}>
                            Identificação
                        </Typography>

                        <Stack spacing={1.2}>
                            <TextField
                                label="Nome"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                fullWidth
                            />

                            <TextField
                                label="ID externo"
                                value={externalId}
                                onChange={(e) => setExternalId(e.target.value)}
                                fullWidth
                                helperText="Ex: acc_cc_c6 ou acc_card_nubank"
                            />

                            <TextField
                                label="Saldo inicial"
                                value={openingBalance}
                                onChange={(e) => setOpeningBalance(e.target.value)}
                                inputMode="decimal"
                                fullWidth
                            />

                            <Box
                                sx={{
                                    p: 1.5,
                                    borderRadius: 2,
                                    border: (t) => `1px solid ${t.palette.divider}`,
                                    bgcolor: (t) =>
                                        t.palette.mode === "dark"
                                            ? "rgba(255,255,255,0.02)"
                                            : "rgba(0,0,0,0.015)",
                                }}
                            >
                                <Stack spacing={1.25}>
                                    <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="center"
                                        spacing={1}
                                        flexWrap="wrap"
                                    >
                                        <Typography sx={{ fontWeight: 800 }}>
                                            Cor da conta
                                        </Typography>

                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Box
                                                sx={{
                                                    width: 22,
                                                    height: 22,
                                                    borderRadius: "50%",
                                                    bgcolor: color,
                                                    border: "1px solid rgba(0,0,0,0.12)",
                                                }}
                                            />
                                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                                Atual: {savedColorHex}
                                            </Typography>
                                        </Stack>
                                    </Stack>

                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        {ACCOUNT_COLOR_PRESETS.map((preset) => {
                                            const selected =
                                                normalizeHex(preset) ===
                                                normalizeHex(editingColor ? draftColorHex : savedColorHex);

                                            return (
                                                <Box
                                                    key={preset}
                                                    onClick={() => handlePresetPick(preset)}
                                                    sx={{
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: "50%",
                                                        bgcolor: preset,
                                                        cursor: "pointer",
                                                        border: selected
                                                            ? "2px solid rgba(0,0,0,0.75)"
                                                            : "1px solid rgba(0,0,0,0.15)",
                                                        boxShadow: selected
                                                            ? "0 0 0 3px rgba(0,0,0,0.08)"
                                                            : "none",
                                                        transition: "all 0.15s ease",
                                                    }}
                                                />
                                            );
                                        })}

                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={handleStartColorEdit}
                                            sx={{ borderRadius: 999, fontWeight: 700 }}
                                        >
                                            Personalizar
                                        </Button>
                                    </Stack>


                                    <Box
                                        sx={{
                                            p: 1.5,
                                            borderRadius: 2,
                                            border: (t) => `1px solid ${t.palette.divider}`,
                                            bgcolor: (t) =>
                                                t.palette.mode === "dark"
                                                    ? "rgba(255,255,255,0.02)"
                                                    : "rgba(0,0,0,0.015)",
                                        }}
                                    >
                                        <Stack spacing={1.25}>
                                            <Stack
                                                direction="row"
                                                justifyContent="space-between"
                                                alignItems="center"
                                                spacing={1}
                                                flexWrap="wrap"
                                            >
                                                <Typography sx={{ fontWeight: 800 }}>Cor da conta</Typography>

                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Box
                                                        sx={{
                                                            width: 22,
                                                            height: 22,
                                                            borderRadius: "50%",
                                                            bgcolor: color,
                                                            border: "1px solid rgba(0,0,0,0.12)",
                                                        }}
                                                    />
                                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                                        Atual: {savedColorHex}
                                                    </Typography>
                                                </Stack>
                                            </Stack>

                                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                                {ACCOUNT_COLOR_PRESETS.map((preset) => {
                                                    const selected =
                                                        normalizeHex(preset) === normalizeHex(draftColorHex);

                                                    return (
                                                        <Box
                                                            key={preset}
                                                            onClick={() => setDraftColorHex(normalizeHex(preset))}
                                                            sx={{
                                                                width: 28,
                                                                height: 28,
                                                                borderRadius: "50%",
                                                                bgcolor: preset,
                                                                cursor: "pointer",
                                                                border: selected
                                                                    ? "2px solid rgba(0,0,0,0.75)"
                                                                    : "1px solid rgba(0,0,0,0.15)",
                                                                boxShadow: selected
                                                                    ? "0 0 0 3px rgba(0,0,0,0.08)"
                                                                    : "none",
                                                                transition: "all 0.15s ease",
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </Stack>

                                            <Stack
                                                direction={{ xs: "column", sm: "row" }}
                                                spacing={1.2}
                                                alignItems={{ xs: "stretch", sm: "center" }}
                                            >
                                                <Button
                                                    component="label"
                                                    variant="outlined"
                                                    sx={{ borderRadius: 999, fontWeight: 700 }}
                                                >
                                                    Escolher cor
                                                    <input
                                                        type="color"
                                                        hidden
                                                        value={isFullHex(draftColorHex) ? draftColorHex : "#64748B"}
                                                        onChange={(e) => {
                                                            setDraftColorHex(normalizeHex(e.target.value));
                                                        }}
                                                    />
                                                </Button>

                                                <TextField
                                                    label="HEX"
                                                    value={draftColorHex}
                                                    onChange={(e) => {
                                                        setDraftColorHex(normalizeHex(e.target.value));
                                                    }}
                                                    helperText="Ex: #3B82F6"
                                                    sx={{ maxWidth: { xs: "100%", sm: 150 } }}
                                                />

                                                <Box sx={{ flex: 1 }} />

                                                <Box
                                                    sx={{
                                                        minWidth: 180,
                                                        px: 1.25,
                                                        py: 1,
                                                        borderRadius: 2,
                                                        border: "1px solid rgba(0,0,0,0.08)",
                                                        bgcolor: draftPreviewColor,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontWeight: 800,
                                                            whiteSpace: "nowrap",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        }}
                                                    >
                                                        Prévia da conta
                                                    </Typography>
                                                </Box>
                                            </Stack>

                                            <TextField
                                                label="RGBA"
                                                value={draftRgbaText}
                                                fullWidth
                                                InputProps={{ readOnly: true }}
                                                helperText="Gerado automaticamente conforme a cor escolhida"
                                            />

                                            <Stack direction="row" spacing={1.2} alignItems="center">
                                                <Typography
                                                    variant="caption"
                                                    sx={{ minWidth: 72, color: "text.secondary" }}
                                                >
                                                    Opacidade
                                                </Typography>

                                                <Slider
                                                    value={draftAlpha}
                                                    min={0.08}
                                                    max={0.6}
                                                    step={0.02}
                                                    onChange={(_, value) => {
                                                        setDraftAlpha(Array.isArray(value) ? value[0] : value);
                                                    }}
                                                    sx={{ flex: 1 }}
                                                />

                                                <Typography
                                                    variant="caption"
                                                    sx={{ width: 40, textAlign: "right", color: "text.secondary" }}
                                                >
                                                    {Number(draftAlpha).toFixed(2)}
                                                </Typography>
                                            </Stack>

                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <Button
                                                    onClick={() => {
                                                        setDraftColorHex(savedColorHex);
                                                        setDraftAlpha(savedAlpha);
                                                    }}
                                                    disabled={saving}
                                                >
                                                    Cancelar
                                                </Button>

                                                <Button
                                                    variant="contained"
                                                    onClick={() => {
                                                        const finalHex = isFullHex(draftColorHex)
                                                            ? normalizeHex(draftColorHex)
                                                            : savedColorHex;

                                                        setSavedColorHex(finalHex);
                                                        setSavedAlpha(clampAlpha(draftAlpha));
                                                    }}
                                                    disabled={saving || !isFullHex(draftColorHex)}
                                                >
                                                    Confirmar cor
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    </Box>

                                </Stack>
                            </Box>

                            <TextField
                                select
                                label="Status"
                                value={active ? "active" : "inactive"}
                                onChange={(e) => setActive(e.target.value === "active")}
                                fullWidth
                            >
                                <MenuItem value="active">Ativa</MenuItem>
                                <MenuItem value="inactive">Inativa</MenuItem>
                            </TextField>
                        </Stack>
                    </Box>

                    {type === "credit_card" ? (
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: 2,
                                border: (t) => `1px solid ${t.palette.divider}`,
                            }}
                        >
                            <Typography sx={{ fontWeight: 800, mb: 1.25 }}>
                                Dados do cartão
                            </Typography>

                            <Stack spacing={1.2}>
                                <TextField
                                    label="Limite"
                                    value={limit}
                                    onChange={(e) => setLimit(e.target.value)}
                                    inputMode="decimal"
                                    fullWidth
                                />

                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                                    <TextField
                                        label="Dia de fechamento"
                                        value={cutoffDay}
                                        onChange={(e) =>
                                            setCutoffDay(onlyDigits(e.target.value).slice(0, 2))
                                        }
                                        fullWidth
                                    />

                                    <TextField
                                        label="Dia de vencimento"
                                        value={dueDay}
                                        onChange={(e) =>
                                            setDueDay(onlyDigits(e.target.value).slice(0, 2))
                                        }
                                        fullWidth
                                    />
                                </Stack>
                            </Stack>
                        </Box>
                    ) : (
                        <>
                            <Box
                                sx={{
                                    p: 2,
                                    borderRadius: 2,
                                    border: (t) => `1px solid ${t.palette.divider}`,
                                }}
                            >
                                <Typography sx={{ fontWeight: 800, mb: 1.25 }}>
                                    Dados bancários
                                </Typography>

                                <Stack spacing={1.2}>
                                    <TextField
                                        select
                                        label="Tipo da conta"
                                        value={bankDetails.accountKind}
                                        onChange={(e) => setBankField("accountKind", e.target.value)}
                                        fullWidth
                                    >
                                        <MenuItem value="checking">Conta corrente</MenuItem>
                                        <MenuItem value="payment">Conta pagamento</MenuItem>
                                        <MenuItem value="savings">Conta poupança</MenuItem>
                                    </TextField>

                                    <Autocomplete
                                        options={BRAZIL_BANKS}
                                        value={selectedBank}
                                        onChange={(_, option) => {
                                            setBankField("bankCode", option?.code || "");
                                            setBankField("bankName", option?.name || "");
                                        }}
                                        getOptionLabel={(option) =>
                                            option ? `${option.code} - ${option.name}` : ""
                                        }
                                        renderInput={(params) => (
                                            <TextField {...params} label="Banco" fullWidth />
                                        )}
                                    />

                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                                        <TextField
                                            label="Código do banco"
                                            value={bankDetails.bankCode}
                                            onChange={(e) =>
                                                setBankField("bankCode", onlyDigits(e.target.value).slice(0, 10))
                                            }
                                            fullWidth
                                        />

                                        <TextField
                                            label="Nome do banco"
                                            value={bankDetails.bankName}
                                            onChange={(e) => setBankField("bankName", e.target.value)}
                                            fullWidth
                                        />
                                    </Stack>

                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                                        <TextField
                                            label="Agência"
                                            value={bankDetails.branch}
                                            onChange={(e) =>
                                                setBankField("branch", onlyDigits(e.target.value).slice(0, 20))
                                            }
                                            fullWidth
                                        />

                                        <TextField
                                            label="Conta"
                                            value={bankDetails.accountNumber}
                                            onChange={(e) =>
                                                setBankField(
                                                    "accountNumber",
                                                    onlyDigits(e.target.value).slice(0, 30)
                                                )
                                            }
                                            fullWidth
                                        />

                                        <TextField
                                            label="Dígito"
                                            value={bankDetails.accountDigit}
                                            onChange={(e) =>
                                                setBankField(
                                                    "accountDigit",
                                                    onlyDigits(e.target.value).slice(0, 10)
                                                )
                                            }
                                            sx={{ minWidth: 110 }}
                                        />
                                    </Stack>

                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                                        <TextField
                                            select
                                            label="Documento"
                                            value={bankDetails.documentType}
                                            onChange={(e) => setBankField("documentType", e.target.value)}
                                            fullWidth
                                        >
                                            <MenuItem value="cpf">CPF</MenuItem>
                                            <MenuItem value="cnpj">CNPJ</MenuItem>
                                        </TextField>

                                        <TextField
                                            label={bankDetails.documentType === "cnpj" ? "CNPJ" : "CPF"}
                                            value={
                                                bankDetails.documentType === "cnpj"
                                                    ? formatCNPJ(bankDetails.documentNumber)
                                                    : formatCPF(bankDetails.documentNumber)
                                            }
                                            onChange={(e) =>
                                                setBankField("documentNumber", onlyDigits(e.target.value))
                                            }
                                            fullWidth
                                        />
                                    </Stack>

                                    <TextField
                                        label="Nome do titular"
                                        value={bankDetails.holderName}
                                        onChange={(e) =>
                                            setBankField("holderName", e.target.value.toUpperCase())
                                        }
                                        fullWidth
                                    />

                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                                        <TextField
                                            select
                                            label="Tipo da chave PIX"
                                            value={bankDetails.pixKeyType}
                                            onChange={(e) => setBankField("pixKeyType", e.target.value)}
                                            fullWidth
                                        >
                                            <MenuItem value="">Sem PIX</MenuItem>
                                            <MenuItem value="cpf">CPF</MenuItem>
                                            <MenuItem value="cnpj">CNPJ</MenuItem>
                                            <MenuItem value="email">E-mail</MenuItem>
                                            <MenuItem value="phone">Telefone</MenuItem>
                                            <MenuItem value="random">Aleatória</MenuItem>
                                        </TextField>

                                        <TextField
                                            label="Chave PIX"
                                            value={bankDetails.pixKey}
                                            onChange={(e) => setBankField("pixKey", e.target.value)}
                                            fullWidth
                                        />
                                    </Stack>
                                </Stack>
                            </Box>

                            <Box
                                sx={{
                                    p: 2,
                                    borderRadius: 2,
                                    border: (t) => `1px solid ${t.palette.divider}`,
                                    bgcolor: (t) =>
                                        t.palette.mode === "dark"
                                            ? "rgba(255,255,255,0.02)"
                                            : "rgba(0,0,0,0.015)",
                                }}
                            >
                                <Typography sx={{ fontWeight: 800, mb: 1.25 }}>
                                    Prévia para compartilhar
                                </Typography>

                                <Box
                                    sx={{
                                        whiteSpace: "pre-line",
                                        fontFamily: "monospace",
                                        fontSize: 13,
                                        p: 1.5,
                                        borderRadius: 2,
                                        border: (t) => `1px dashed ${t.palette.divider}`,
                                    }}
                                >
                                    {sharePreview}
                                </Box>
                            </Box>
                        </>
                    )}
                </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} disabled={saving}>
                    Cancelar
                </Button>

                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={saving || !name.trim()}
                    startIcon={saving ? <CircularProgress size={16} /> : null}
                >
                    {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar conta"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}