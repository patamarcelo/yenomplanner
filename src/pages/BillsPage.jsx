// src/pages/BillsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    Box,
    Stack,
    Typography,
    Card,
    CardContent,
    Button,
    Divider,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    InputAdornment,
    MenuItem,
    Alert,
    CircularProgress,
    IconButton,
    Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";


import AddRoundedIcon from "@mui/icons-material/AddRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";

import { useDispatch, useSelector } from "react-redux";
import {
    fetchBillsThunk,
    createBillThunk,
    updateBillThunk,
    deleteBillThunk,
    generateBillThunk,
    clearGenerateResult,
    selectBills,
    selectBillsStatus,
    selectBillsError,
    selectBillsGenerating,
    selectBillsLastGenerateResult,
    payBillThunk,
    deleteBillSeriesThunk,
    reopenBillThunk, // ✅ se você já criou no slice; se não existir, remova e mantenha só o botão escondido
} from "../store/billsSlice";

import { fetchAllTransactionsThunk, selectTransactionsApi } from "../store/transactionsSlice";
import { listAccounts } from "../api/accountsApi";

// import { categories } from "../data/mockCategories";
import { formatBRL } from "../utils/money";

import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

import { selectCategories } from "../store/categoriesSlice";
import { selectActiveCategories, selectCategoryById, fetchCategoriesThunk } from "../store/categoriesSlice";

import Swal from "sweetalert2";
import SpinnerPage from "../components/ui/Spinner";


const pageSx = { maxWidth: 1120, mx: "auto", px: { xs: 2, md: 3 }, py: 2 };

function formatBRDate(iso) {
    if (!iso || String(iso).length !== 10) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}

function isoFromYMDay(ym, day) {
    if (!ym) return "";
    const dd = String(Math.max(1, Math.min(28, Number(day || 10)))).padStart(2, "0");
    return `${ym}-${dd}`; // "YYYY-MM-DD"
}

function isBeforeISO(a, b) { return a && b && a < b; }
function isSameISO(a, b) { return a && b && a === b; }

function computeBillDueISO(b, filterYM) {
    // se bill é one_off/parcelado “explodido”, o mês vem do próprio b.startMonth
    const ym = b.startMonth || filterYM;
    return isoFromYMDay(ym, b.dayOfMonth);
}

function computeBillStatus({ bill, todayISO, dueISO }) {
    // pago ganha sempre
    if (bill.lastPaidTransactionId) return "paid";
    if (isSameISO(dueISO, todayISO)) return "due_today";
    if (isBeforeISO(dueISO, todayISO)) return "overdue";
    return "planned";
}

function brDateFromISO(iso) {
    // "YYYY-MM-DD" -> "DD/MM/YYYY"
    if (!iso || String(iso).length < 10) return "—";
    const [y, m, d] = String(iso).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
}

function monthYearLabelFromYM(ym) {
    // "YYYY-MM" -> "Fev 2026"
    if (!ym || String(ym).length !== 7) return "—";
    const [y, m] = ym.split("-");
    const dt = new Date(Number(y), Number(m) - 1, 1);
    return dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

// status visual final do card (pedido):
// - pago -> "paid"
// - se vencimento < hoje e não pago -> "overdue"
// - se vencimento == hoje e não pago -> "due_today"
// - senão -> "planned"
function computeUiStatus({ baseStatus, dueISO, todayISO }) {
    if (baseStatus === "paid") return "paid";
    if (!dueISO) return "planned";
    if (dueISO < todayISO) return "overdue";
    if (dueISO === todayISO) return "due_today";
    return "planned";
}
function parseInstallmentFromName(name) {
    // "Algo • 3/12"
    const m = String(name || "").match(/(?:•|\(|\s)(\d{1,3})\/(\d{1,3})\)?\s*$/);
    if (!m) return null;
    const cur = Number(m[1]);
    const tot = Number(m[2]);
    if (!Number.isFinite(cur) || !Number.isFinite(tot) || tot < 2) return null;
    return { cur, tot };
}
// ====== BR input helpers (robusto p/ "3.599,90", "3599,90", "3599.90", "R$ 3.599,90") ======
function parseBRLInputHandlePay(value) {
    let s = String(value ?? "").trim();
    if (!s) return null;

    // mantém apenas dígitos, separadores e sinal
    s = s.replace(/[^\d,.\-]/g, "");

    const hasComma = s.includes(",");
    const hasDot = s.includes(".");

    if (hasComma) {
        // padrão BR: "." é milhar e "," é decimal
        s = s.replace(/\./g, "");     // remove milhares
        s = s.replace(",", ".");      // decimal -> ponto
    } else if (hasDot) {
        // padrão EN: "," pode ser milhar (opcional)
        s = s.replace(/,/g, "");
        // mantém o ÚLTIMO ponto como decimal, remove os demais (milhar)
        const lastDot = s.lastIndexOf(".");
        s =
            s.slice(0, lastDot).replace(/\./g, "") +
            "." +
            s.slice(lastDot + 1).replace(/\./g, "");
    } else {
        // só dígitos (ex: "129")
        // ok
    }

    if (!s || s === "-" || s === "." || s === "-.") return null;

    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
}

function MsIcon({ name, size = 18, color = "inherit" }) {
    if (!name) return null;

    // se for emoji (ou qualquer char não-“word”), renderiza como texto
    const isEmojiLike = /[^\w_]/.test(String(name));
    if (isEmojiLike) {
        return <span style={{ fontSize: size, lineHeight: 1, color }}>{name}</span>;
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
                marginLeft: '10px',
            }}
            aria-hidden="true"
        >
            {name}
        </span>
    );
}

const ICON_MAP = {
    home: "🏠",
    shopping_cart: "🛒",
    subscriptions: "🔁",
    directions_car: "🚗",
    sports_esports: "🎉",
    favorite: "🩺",
    more_horiz: "•",
};

function pickCategoryIcon(cat) {
    const raw = String(cat?.icon || "").trim();
    if (!raw) return ICON_MAP[cat?.slug] || "•";

    // se vier "home", "saude", etc
    const k = raw.toLowerCase();
    if (ICON_MAP[k]) return ICON_MAP[k];

    // se vier emoji (ou um char curto), usa direto
    if (raw.length <= 2) return raw;

    // fallback: primeira letra
    return raw.slice(0, 1).toUpperCase();
}

function ymNow() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}
function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}



function kindMeta(kind) {
    const isInst = kind === "installment";
    const isOneOff = kind === "one_off";
    return {
        label: isOneOff ? "Pontual" : isInst ? "Parcelado" : "Recorrente",
        icon: isInst ? <LayersRoundedIcon /> : <EventRepeatRoundedIcon />,
    };
}

function moneySafe(v) {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return formatBRL(n);
}

// ====== BR input helpers (sem "R$" no value; o símbolo vem do InputAdornment) ======
function parseBRLInput(value) {
    const s = String(value ?? "")
        .replace(/[^\d,.-]/g, "")
        .replace(/\.(?=.*\.)/g, "") // remove pontos extras
        .replace(",", "."); // vírgula -> ponto
    if (!s || s === "-" || s === "." || s === "-.") return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
}
function formatBRNumber(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function formatBRLFromCents(cents) {
    const c = Number(cents);
    if (!Number.isFinite(c)) return "";
    return formatBRNumber(c / 100);
}

function BillsFormDialog({ open, onClose, initial }) {
    const dispatch = useDispatch();
    const isEdit = !!initial?.id;
    const categories = useSelector(selectActiveCategories);
    const getCategory = (id) => useSelector(selectCategoryById(id)); // (se preferir, use useMemo + map)

    const [uiType, setUiType] = useState(initial?.kind === "one_off" ? "one_off" : "recurring");
    const [description, setDescription] = useState(initial?.name || "");
    const [payee, setPayee] = useState(initial?.payee || "");
    const [categoryId, setCategoryId] = useState(initial?.categoryId || "outros");
    const [notes, setNotes] = useState(initial?.notes || "");
    const [dayOfMonth, setDayOfMonth] = useState(String(initial?.dayOfMonth ?? 10));
    const [startMonth, setStartMonth] = useState(initial?.startMonth || "");
    const [endMonth, setEndMonth] = useState(initial?.endMonth || "");

    const [installmentTotal, setInstallmentTotal] = useState("12");
    const [firstInstallmentMonth, setFirstInstallmentMonth] = useState(ymNow()); // YYYY-MM

    const [paidDate, setPaidDate] = useState(() => {
        if (initial?.kind === "one_off" && initial?.startMonth) {
            const ym = initial.startMonth;
            const dd = String(initial?.dayOfMonth ?? 10).padStart(2, "0");
            return `${ym}-${dd}`;
        }
        return "";
    });

    const [defaultAmount, setDefaultAmount] = useState(
        initial?.defaultAmount === null || initial?.defaultAmount === undefined ? "" : formatBRNumber(Number(initial.defaultAmount))
    );


    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        const x = initial || {};
        setUiType(x.kind === "one_off" ? "one_off" : "recurring");
        setDescription(x.name || "");
        setPayee(x.payee || "");
        setCategoryId(x.categoryId || "outros");
        setNotes(x.notes || "");
        setDayOfMonth(String(x.dayOfMonth ?? 10));
        setStartMonth(x.startMonth || "");
        setEndMonth(x.endMonth || "");
        setDefaultAmount(x.defaultAmount === null || x.defaultAmount === undefined ? "" : formatBRNumber(Number(x.defaultAmount)));
        setInstallmentTotal("12");
        setFirstInstallmentMonth(x.startMonth || ymNow());

        if (x.kind === "one_off" && x.startMonth) {
            const dd = String(x?.dayOfMonth ?? 10).padStart(2, "0");
            setPaidDate(`${x.startMonth}-${dd}`);
        } else {
            setPaidDate("");
        }

        setErr("");
        setSaving(false);
    }, [initial, open]);

    function ymFromISODate(iso) {
        if (!iso) return "";
        return String(iso).slice(0, 7);
    }
    function dayFromISODate(iso) {
        if (!iso || String(iso).length < 10) return 10;
        const d = Number(String(iso).slice(8, 10));
        if (!Number.isFinite(d)) return 10;
        return Math.max(1, Math.min(28, d));
    }

    function validate() {
        if (!String(description || "").trim()) return "Informe a Descrição.";

        if (defaultAmount !== "") {
            const v = parseBRLInputHandlePay(defaultAmount);
            if (v === null || v < 0) return "Valor padrão inválido.";
        }

        if (uiType === "installment") {
            const d = Number(dayOfMonth);
            const tot = Number(installmentTotal);

            if (!Number.isFinite(d) || d < 1 || d > 28) return "Dia do mês deve ser entre 1 e 28.";
            if (!Number.isFinite(tot) || tot < 2 || tot > 240) return "Qtd. parcelas deve ser entre 2 e 240.";
            if (!firstInstallmentMonth || String(firstInstallmentMonth).length !== 7) return "1ª parcela deve ser YYYY-MM.";

            return ""; // ✅ importante: não deixa cair em validações de outro tipo
        }

        else if (uiType === "recurring") {
            const d = Number(dayOfMonth);
            if (!Number.isFinite(d) || d < 1 || d > 28) return "Dia do mês deve ser entre 1 e 28.";
            if (startMonth && String(startMonth).length !== 7) return "Início deve ser YYYY-MM.";
            if (endMonth && String(endMonth).length !== 7) return "Fim deve ser YYYY-MM.";
            if (startMonth && endMonth && endMonth < startMonth) return "Fim não pode ser menor que início.";

            return "";
        }

        // ✅ somente pontual exige data completa
        else if (uiType === "one_off") {
            if (!paidDate || String(paidDate).length !== 10) return "Selecione a Data do pagamento.";
        }

        return "";
    }

    async function handleSave() {
        setErr("");
        const e = validate();
        if (e) return setErr(e);

        setSaving(true);
        const parsed = parseBRLInputHandlePay(defaultAmount);


        // YYYY-MM + N meses -> YYYY-MM
        const addMonthsYM = (ym, add) => {
            const [yy, mm] = String(ym || "").split("-").map(Number);
            if (!Number.isFinite(yy) || !Number.isFinite(mm)) return "";
            const base = yy * 12 + (mm - 1) + Number(add || 0);
            const y2 = Math.floor(base / 12);
            const m2 = (base % 12) + 1;
            return `${y2}-${String(m2).padStart(2, "0")}`;
        };

        if (String(defaultAmount || "").trim()) {
            const parsed = parseBRLInputHandlePay(defaultAmount);
            if (parsed === null || parsed < 0) {
                setSaving(false);
                return setErr("Valor padrão inválido.");
            }
        }
        let payload = {
            name: String(description).trim(),
            payee: String(payee || "").trim(),
            categoryId,
            notes: notes || "",
            currency: "BRL",
            active: true,
            defaultAmount: defaultAmount === "" ? null : parsed,
        };

        if (uiType === "recurring") {
            payload = {
                ...payload,
                kind: "recurring",
                dayOfMonth: Number(dayOfMonth),
                startMonth: startMonth || "",
                endMonth: endMonth || "",
            };
        } else if (uiType === "installment") {
            const tot = Number(installmentTotal);
            const startYM = firstInstallmentMonth || ""; // "YYYY-MM"
            const endYM = startYM ? addMonthsYM(startYM, tot - 1) : "";

            payload = {
                ...payload,
                kind: "installment",
                dayOfMonth: Number(dayOfMonth),
                startMonth: startYM,
                endMonth: endYM, // ✅ IMPORTANTÍSSIMO pro back criar todas
                // se você quiser manter no front também (opcional):
                // installmentTotal: tot,
            };
        } else {
            // one_off
            const ym = ymFromISODate(paidDate);
            payload = {
                ...payload,
                kind: "one_off",
                dayOfMonth: dayFromISODate(paidDate),
                startMonth: ym,
                endMonth: ym,
            };
        }

        try {
            if (isEdit) {
                await dispatch(updateBillThunk({ id: initial.id, patch: payload })).unwrap();
            } else {
                await dispatch(createBillThunk(payload)).unwrap();
            }

            await dispatch(fetchBillsThunk());
            onClose();
        } catch (x) {
            setErr(x?.detail || "Erro ao salvar.");
        } finally {
            setSaving(false);
        }
    }

    const monthFieldProps = { type: "month", InputLabelProps: { shrink: true } };

    // Dialog visual: fundo claro + labels escuros
    const borderColor = "rgba(25,118,210,0.28)";
    const gradientAccent = "rgba(25,118,210,0.16)";
    const tintBg = "rgba(255,255,255,0.92)";

    const fieldSx = {
        "& .MuiInputLabel-root": { color: "rgba(15,23,42,0.82)" },
        "& .MuiInputLabel-root.Mui-focused": { color: "rgba(15,23,42,0.92)" },
        "& .MuiOutlinedInput-root": {
            backgroundColor: "rgba(255,255,255,0.96)",
            borderRadius: 2,
        },
        "& .MuiFormHelperText-root": { color: "rgba(15,23,42,0.62)" },
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            PaperProps={{
                sx: {
                    color: "rgba(15,23,42,0.98)",
                    borderRadius: 2,
                    border: `1.5px solid ${borderColor}`,
                    background: `linear-gradient(-180deg, ${gradientAccent} 10%, ${tintBg} 36px, rgba(255,255,255,0.98) 84%)`,
                    boxShadow: "0 14px 40px rgba(2,6,23,0.10)",
                },
            }}
        >
            <DialogTitle sx={{ fontWeight: 950, color: "rgba(15,23,42,0.98)" }}>
                {isEdit ? "Editar despesa" : "Nova despesa"}
            </DialogTitle>

            <DialogContent>
                <Stack spacing={1.2} sx={{ mt: 2.2 /* ✅ mais respiro no topo */ }}>
                    {err ? <Alert severity="error">{err}</Alert> : null}

                    <TextField sx={fieldSx} label="Tipo" select value={uiType} onChange={(e) => setUiType(e.target.value)} fullWidth>
                        <MenuItem value="recurring">Recorrente</MenuItem>
                        <MenuItem value="one_off">Pontual</MenuItem>
                        <MenuItem value="installment">Parcelado</MenuItem>
                    </TextField>

                    <TextField sx={fieldSx} label="Descrição *" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />

                    <TextField
                        sx={fieldSx}
                        label="Favorecido"
                        value={payee}
                        onChange={(e) => setPayee(e.target.value)}
                        fullWidth
                        helperText="Depois a gente troca por Autocomplete com histórico do usuário."
                    />

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                        <TextField sx={fieldSx} label="Categoria" select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} fullWidth>
                            {(categories || []).map((c) => (
                                <MenuItem key={c.id} value={c.slug}>
                                    <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
                                        <MsIcon name={(c.icon || "").trim() || "tag"} size={18} />
                                        <span style={{ fontWeight: 900, whiteSpace: "nowrap" }}>{c.name}</span>
                                    </Stack>
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            sx={fieldSx}
                            label="Valor padrão (opcional)"
                            value={defaultAmount}
                            onChange={(e) => setDefaultAmount(e.target.value)}
                            onBlur={() => {
                                const parsed = parseBRLInput(defaultAmount);
                                setDefaultAmount(parsed != null ? formatBRNumber(parsed) : "");
                            }}
                            placeholder="0,00"
                            inputMode="decimal"
                            fullWidth
                            InputProps={{
                                startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                            }}
                        />
                    </Stack>

                    {uiType === "recurring" ? (
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} pt={1}>
                            <TextField
                                sx={fieldSx}
                                label="Dia do mês (1..28)"
                                type="number"
                                value={dayOfMonth}
                                onChange={(e) => setDayOfMonth(e.target.value)}
                                inputProps={{ min: 1, max: 28 }}
                                fullWidth
                            />

                            <TextField sx={fieldSx} label="Início (mês)" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} fullWidth {...monthFieldProps} />
                            <TextField sx={fieldSx} label="Fim (mês)" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} fullWidth {...monthFieldProps} />
                        </Stack>
                    ) : uiType === 'one_off' ? (
                        <TextField
                            sx={fieldSx}
                            label="Data do pagamento"
                            type="date"
                            value={paidDate}
                            onChange={(e) => setPaidDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                        />
                    ) : (
                        <>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} pt={1}>
                                <TextField
                                    sx={fieldSx}
                                    label="Qtd. parcelas"
                                    type="number"
                                    value={installmentTotal}
                                    onChange={(e) => setInstallmentTotal(e.target.value)}
                                    inputProps={{ min: 2, max: 240 }}
                                    fullWidth
                                />

                                <TextField
                                    sx={fieldSx}
                                    label="1ª parcela (mês)"
                                    type="month"
                                    value={firstInstallmentMonth}
                                    onChange={(e) => setFirstInstallmentMonth(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    fullWidth
                                />
                            </Stack>

                            <TextField
                                sx={fieldSx}
                                label="Dia do mês (1..28)"
                                type="number"
                                value={dayOfMonth}
                                onChange={(e) => setDayOfMonth(e.target.value)}
                                inputProps={{ min: 1, max: 28 }}
                                fullWidth
                            />
                        </>
                    )}

                    <TextField sx={fieldSx} label="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={3} />
                </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button onClick={onClose} variant="outlined" disabled={saving}>
                    Cancelar
                </Button>
                <Button onClick={handleSave} variant="contained" disabled={saving} sx={{ fontWeight: 950, minWidth: 140 }}>
                    {saving ? <CircularProgress size={18} /> : "Salvar"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

function GenerateDialog({ open, onClose, bill }) {
    const dispatch = useDispatch();
    const generating = useSelector(selectBillsGenerating);
    const result = useSelector(selectBillsLastGenerateResult);

    const [mode, setMode] = useState("months");
    const [months, setMonths] = useState("12");
    const [count, setCount] = useState("6");
    const [startMonth, setStartMonth] = useState(ymNow());
    const [endMonth, setEndMonth] = useState(ymNow());
    const [err, setErr] = useState("");

    useEffect(() => {
        setErr("");
        dispatch(clearGenerateResult());
        setMode("months");
        setMonths("12");
        setCount("6");
        setStartMonth(bill?.startMonth || ymNow());
        setEndMonth(bill?.endMonth || ymNow());
    }, [open, bill, dispatch]);

    async function handleGenerate() {
        setErr("");
        if (!bill?.id) return;

        let body = {};
        if (mode === "months") body = { months: Number(months) };
        else if (mode === "count") body = { start_month: startMonth, count: Number(count) };
        else body = { start_month: startMonth, end_month: endMonth };

        try {
            await dispatch(generateBillThunk({ id: bill.id, body })).unwrap();
            dispatch(fetchBillsThunk());
            dispatch(fetchAllTransactionsThunk());
        } catch (e) {
            setErr(e?.detail || "Erro ao gerar.");
        }
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ fontWeight: 950 }}>Gerar — {bill?.name || "—"}</DialogTitle>
            <DialogContent>
                <Stack spacing={1.2} sx={{ mt: 1 }}>
                    {err ? <Alert severity="error">{err}</Alert> : null}

                    {result ? (
                        <Alert severity="success">
                            Criados: <b>{result.created}</b> • Atualizados: <b>{result.updated}</b> • Pagos ignorados: <b>{result.skipped_paid}</b>
                        </Alert>
                    ) : null}

                    <TextField label="Modo" select value={mode} onChange={(e) => setMode(e.target.value)} fullWidth>
                        <MenuItem value="months">Próximos N meses</MenuItem>
                        <MenuItem value="count">A partir de um mês + quantidade</MenuItem>
                        <MenuItem value="range">Intervalo (start/end)</MenuItem>
                    </TextField>

                    {mode === "months" ? (
                        <TextField label="Meses" type="number" value={months} onChange={(e) => setMonths(e.target.value)} inputProps={{ min: 1, max: 240 }} fullWidth />
                    ) : null}

                    {mode === "count" ? (
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                            <TextField label="Start (YYYY-MM)" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} fullWidth />
                            <TextField label="Count" type="number" value={count} onChange={(e) => setCount(e.target.value)} inputProps={{ min: 1, max: 240 }} fullWidth />
                        </Stack>
                    ) : null}

                    {mode === "range" ? (
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                            <TextField label="Start (YYYY-MM)" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} fullWidth />
                            <TextField label="End (YYYY-MM)" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} fullWidth />
                        </Stack>
                    ) : null}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button onClick={onClose} variant="outlined" disabled={generating}>
                    Fechar
                </Button>
                <Button
                    onClick={handleGenerate}
                    variant="contained"
                    disabled={generating}
                    sx={{ fontWeight: 950, minWidth: 160 }}
                    startIcon={generating ? <CircularProgress size={16} /> : <PlayArrowRoundedIcon />}
                >
                    {generating ? "Gerando..." : "Gerar"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

function PayBillDialog({ open, onClose, bill }) {
    const dispatch = useDispatch();

    const [accounts, setAccounts] = useState([]);
    const [accountId, setAccountId] = useState("");
    const [paidDate, setPaidDate] = useState(todayISO());
    const [amountInput, setAmountInput] = useState("");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const accs = await listAccounts();
                if (!mounted) return;

                const ordered = (accs || [])
                    .filter((a) => a.active !== false)
                    .sort((a, b) => {
                        const aIsCC = a.type === "credit_card";
                        const bIsCC = b.type === "credit_card";
                        if (aIsCC !== bIsCC) return aIsCC ? 1 : -1; // ✅ contas primeiro, cartões depois
                        return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
                    });

                setAccounts(ordered);

                const first = ordered?.[0]?.id || "";
                setAccountId(first);
            } catch {
                setAccounts([]);
                setAccountId("");
            }
        })();
        return () => {
            mounted = false;
        };
    }, [open]);

    useEffect(() => {
        setErr("");
        setSaving(false);
        setPaidDate(todayISO());

        if (bill?.defaultAmount != null) {
            const cents = Math.round(Number(bill.defaultAmount) * 100);
            setAmountInput(formatBRLFromCents(cents));
        } else {
            setAmountInput("");
        }
    }, [open, bill]);

    const canPay = !!bill?.id;

    async function handlePay() {
        setErr("");
        if (!canPay) return;

        if (!accountId) return setErr("Selecione a conta que pagou.");
        if (!paidDate) return setErr("Selecione a data de pagamento.");

        let amountToSend;
        if (String(amountInput || "").trim()) {
            const parsed = parseBRLInputHandlePay(amountInput);
            console.log('parsedd value: ', parsed, amountInput)
            if (parsed === null || parsed <= 0) return setErr("Valor inválido.");
            amountToSend = formatBRNumber(parsed); // manda no padrão BR (backend aceita)
        } else if (bill?.defaultAmount == null) {
            return setErr("Informe o valor (ou defina um valor padrão na despesa).");
        }

        setSaving(true);
        try {
            await dispatch(
                payBillThunk({
                    id: bill.id,
                    body: { paid_date: paidDate, account_id: accountId, amount: amountToSend || undefined },
                })
            ).unwrap();

            dispatch(fetchBillsThunk());
            dispatch(fetchAllTransactionsThunk());
            onClose();
        } catch (e) {
            console.log('error ao pagar: ', e)
            setErr(e?.detail || "Erro ao pagar.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ fontWeight: 950 }}>Pagar — {bill?.name || "—"}</DialogTitle>
            <DialogContent>
                <Stack spacing={1.2} sx={{ mt: 1 }}>
                    {err ? <Alert severity="error">{err}</Alert> : null}

                    <TextField
                        label="Data do pagamento"
                        type="date"
                        value={paidDate}
                        onChange={(e) => setPaidDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                    />

                    <TextField label="Conta que pagou" select value={accountId} onChange={(e) => setAccountId(e.target.value)} fullWidth>
                        {(accounts || [])
                            .filter((a) => a.active !== false)
                            .sort((a, b) => {
                                const ra = a.type === "checking" ? 0 : 1;
                                const rb = b.type === "checking" ? 0 : 1;
                                if (ra !== rb) return ra - rb;
                                return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
                            })
                            .map((a) => (
                                <MenuItem key={a.id} value={a.id}>
                                    {a.type === "credit_card" ? `💳 ${a.name}` : `🏦 ${a.name}`}
                                </MenuItem>
                            ))}
                    </TextField>

                    <TextField
                        label="Valor"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        onBlur={() => {
                            const parsed = parseBRLInput(amountInput);
                            setAmountInput(parsed != null ? formatBRNumber(parsed) : "");
                        }}
                        inputMode="decimal"
                        placeholder="0,00"
                        fullWidth
                        InputProps={{
                            startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                        }}
                        helperText={bill?.defaultAmount != null ? "Se vazio, usa o valor padrão da despesa." : "Obrigatório (não há valor padrão)."}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button onClick={onClose} variant="outlined" disabled={saving}>
                    Cancelar
                </Button>
                <Button onClick={handlePay} variant="contained" disabled={saving} sx={{ fontWeight: 950, minWidth: 140 }} startIcon={<PaidRoundedIcon />}>
                    {saving ? <CircularProgress size={18} /> : "Pagar"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default function BillsPage() {
    const dispatch = useDispatch();
    const bills = useSelector(selectBills);
    const status = useSelector(selectBillsStatus);
    const error = useSelector(selectBillsError);

    const txns = useSelector(selectTransactionsApi);
    const categories = useSelector(selectActiveCategories);
    console.log('categgg: ', categories)

    const [openNew, setOpenNew] = useState(false);
    const [editBill, setEditBill] = useState(null);
    const [genBill, setGenBill] = useState(null);
    const [payBill, setPayBill] = useState(null);

    // ===== filtros =====
    const nowYM = ymNow();
    const [filterKind, setFilterKind] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterActive, setFilterActive] = useState("all");
    const [q, setQ] = useState("");


    // mês: "all" = Todos
    const [filterMonth, setFilterMonth] = useState("all");
    // ano: vazio => todos os anos (ou setar default pelo ano atual)
    const now = new Date();
    const currentYear = String(now.getFullYear());

    const [filterYear, setFilterYear] = useState(currentYear); // ✅ default ano atual
    const [filterCategory, setFilterCategory] = useState("all"); // ✅ novo filtro

    // multi-status
    const [filterStatuses, setFilterStatuses] = useState(["planned", "due_today", "overdue"]); // default: tudo que NÃO é pago
    // tipo (pode ser multi também; se quiser manter single, deixa string)
    const [filterKinds, setFilterKinds] = useState(["recurring", "installment", "one_off"]);

    // range
    const [rangeStart, setRangeStart] = useState(""); // "YYYY-MM-DD"
    const [rangeEnd, setRangeEnd] = useState("");     // "YYYY-MM-DD"

    useEffect(() => {
        dispatch(fetchBillsThunk());
        dispatch(fetchAllTransactionsThunk());
        dispatch(fetchCategoriesThunk());
    }, [dispatch]);







    const yearOptions = useMemo(() => {
        const set = new Set();
        (bills || []).forEach((b) => {
            const ym = String(b.startMonth || "").slice(0, 7); // "YYYY-MM"
            const y = ym ? ym.slice(0, 4) : "";
            if (y) set.add(y);
        });
        return Array.from(set).sort(); // ["2025","2026",...]
    }, [bills]);




    const categoriesById = useMemo(() => {
        const m = new Map();
        (categories || []).forEach((c) => m.set(String(c.id), c));
        return m;
    }, [categories]);

    const categoriesBySlug = useMemo(() => {
        const m = new Map();
        (categories || []).forEach((c) => m.set(String(c.slug), c));
        return m;
    }, [categories]);


    function resolveCategoryFromBill(b) {
        const raw = b?.categoryId ?? b?.category_id ?? b?.category ?? "";
        const key = String(raw);

        return (
            categoriesById.get(key) ||
            categoriesBySlug.get(key) ||
            null
        );
    }

    const categoryOptions = useMemo(() => {
        return (categories || [])
            .filter((c) => c.active !== false)
            .slice()
            .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
    }, [categories]);

    const activeCount = useMemo(() => (bills || []).filter((b) => b.active !== false).length, [bills]);

    // ===== regra de status (pedido):
    // - padrão: "planned" (Previsto)
    // - se pagou: "paid"
    // - se vencimento < hoje e não pago: "overdue"
    const billStatusForMonth = useMemo(() => {
        const map = new Map();
        const today = todayISO();

        (bills || []).forEach((b) => {
            const ym = b.startMonth || ymNow();               // mês correto da bill
            const dueISO = isoFromYMDay(ym, b.dayOfMonth);    // vencimento correto

            // base: previsto
            let st = "planned";

            // pago se bill marcou (one_off) ou se tiver txn paid
            if (b.lastPaidTransactionId) st = "paid";

            const match = (txns || []).find((t) => {
                if (String(t.bill_id) !== String(b.id)) return false;
                return String(t.invoice_month || "").slice(0, 7) === ym;
            });

            if (match?.status === "paid") st = "paid";
            else if (match?.status === "confirmed") st = "confirmed";

            // atraso (só se não estiver pago)
            if (st !== "paid" && dueISO && isBeforeISO(dueISO, today)) st = "overdue";
            // (opcional) vencendo hoje:
            // if (st !== "paid" && dueISO === today) st = "due_today";

            map.set(b.id, st);
        });

        return map;
    }, [bills, txns]);

    const filteredBills = useMemo(() => {
        const needle = String(q || "").trim().toLowerCase();

        return (bills || [])
            .filter((b) => {
                // kind
                if (filterKind !== "all" && String(b.kind) !== String(filterKind)) return false;

                // mês/ano: baseado no vencimento real (startMonth + dayOfMonth)
                // - se filterMonth === "all": filtra só por ano
                const dueYM = b.startMonth || `${filterYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
                const dueISO = isoFromYMDay(dueYM, b.dayOfMonth); // "YYYY-MM-DD"
                if (!dueISO) return false;

                const dueYear = dueISO.slice(0, 4);
                const dueMonth = dueISO.slice(5, 7);

                if (String(dueYear) !== String(filterYear)) return false;
                if (filterMonth !== "all" && String(dueMonth) !== String(filterMonth)) return false;

                // status (multi)
                const st = billStatusForMonth.get(b.id) || "planned";
                if (filterStatuses?.length && !filterStatuses.includes(st)) return false;

                const cat = resolveCategoryFromBill(b);
                const cid = cat ? String(cat.id) : "";
                if (filterCategory !== "all" && cid !== String(filterCategory)) return false;

                // search
                if (!needle) return true;
                const hay = `${b.name || ""} ${b.payee || ""} ${b.categoryId || ""} ${b.notes || ""}`.toLowerCase();
                return hay.includes(needle);
            })
            // ordena por vencimento (cronológico)
            .sort((a, b) => {
                const aISO = isoFromYMDay(a.startMonth, a.dayOfMonth) || "9999-12-31";
                const bISO = isoFromYMDay(b.startMonth, b.dayOfMonth) || "9999-12-31";
                return aISO.localeCompare(bISO);
            });
    }, [bills, q, filterKind, filterYear, filterMonth, filterStatuses, billStatusForMonth, filterCategory, resolveCategoryFromBill]);

    function statusChip(st) {
        if (st === "paid") return <Chip size="small" label="Pago" color="success" variant="outlined" />;
        if (st === "overdue") return <Chip size="small" label="Atrasado" color="error" variant="filled" />;
        if (st === "due_today") return <Chip size="small" label="Vence hoje" color="warning" variant="filled" />;
        return <Chip size="small" label="Previsto" variant="outlined" />;
    }




    function CategoryChip({ cat, size = "small" }) {
        if (!cat) return <Chip size={size} label="—" variant="outlined" />;

        const dot = cat.color || "rgba(2,6,23,0.22)";
        const iconTxt = (cat.icon || "").trim();

        return (
            <Chip
                size={size}
                variant="outlined"
                label={cat.name}
                icon={
                    iconTxt
                        ? <MsIcon name={iconTxt} size={18} />
                        : <span style={{ width: 10, height: 10, borderRadius: 6, background: dot, display: "inline-block" }} />
                }
                sx={{
                    fontWeight: 900,
                    borderColor: dot,
                    bgcolor: alpha(dot, 0.10),
                    "& .MuiChip-icon": { marginLeft: 0 },
                }}
            />
        );
    }


    const today = todayISO();

    const timeline = useMemo(() => {
        const buckets = new Map();
        const fallbackYM = `${filterYear}-${String(filterMonth).padStart(2, "0")}`;

        (filteredBills || []).forEach((b) => {
            // ✅ cada parcela/janela já tem seu startMonth; usa ele como "mês do vencimento"
            const dueYM = b.startMonth || fallbackYM;
            const dueISO = isoFromYMDay(dueYM, b.dayOfMonth); // "YYYY-MM-DD" ou null

            const base = billStatusForMonth.get(b.id) || "planned";
            const uiStatus = computeUiStatus({ baseStatus: base, dueISO, todayISO: today });

            const monthKey = (dueISO ? dueISO.slice(0, 7) : dueYM); // "YYYY-MM"
            if (!buckets.has(monthKey)) buckets.set(monthKey, new Map());

            const dayKey = dueISO || "sem_data";
            const byDay = buckets.get(monthKey);

            if (!byDay.has(dayKey)) byDay.set(dayKey, []);
            byDay.get(dayKey).push({ bill: b, dueISO, uiStatus });
        });

        const monthKeys = Array.from(buckets.keys()).sort();

        return monthKeys.map((monthKey) => {
            const byDay = buckets.get(monthKey);
            const dayKeys = Array.from(byDay.keys()).sort();

            const days = dayKeys.map((dayKey) => {
                const items = (byDay.get(dayKey) || [])
                    .slice()
                    .sort((a, b) => {
                        const ad = a.dueISO || "9999-99-99";
                        const bd = b.dueISO || "9999-99-99";
                        if (ad !== bd) return ad.localeCompare(bd);
                        return String(a.bill?.name || "").localeCompare(String(b.bill?.name || ""), "pt-BR");
                    });

                // ✅ soma do dia (somente não-pago)
                const dayTotalCents = items.reduce((acc, it) => {
                    if (it.uiStatus === "paid") return acc;
                    const v = it.bill?.defaultAmount; // number em reais
                    if (v === null || v === undefined) return acc;
                    const n = Number(v);
                    if (!Number.isFinite(n)) return acc;
                    return acc + Math.round(n * 100);
                }, 0);

                return {
                    dayKey,
                    dayLabel: dayKey === "sem_data" ? "Sem vencimento" : brDateFromISO(dayKey),
                    dayTotalCents,
                    items,
                };
            });

            // ✅ soma do mês (somente não-pago)
            const monthTotalCents = days.reduce((acc, d) => acc + (d.dayTotalCents || 0), 0);

            return {
                monthKey,
                monthLabel: monthYearLabelFromYM(monthKey),
                monthTotalCents,
                days,
            };
        });
    }, [filteredBills, billStatusForMonth, filterMonth, filterYear, today]);


    const monthOptions = [
        { v: "all", label: "Todos" },
        { v: "01", label: "Jan" }, { v: "02", label: "Fev" }, { v: "03", label: "Mar" },
        { v: "04", label: "Abr" }, { v: "05", label: "Mai" }, { v: "06", label: "Jun" },
        { v: "07", label: "Jul" }, { v: "08", label: "Ago" }, { v: "09", label: "Set" },
        { v: "10", label: "Out" }, { v: "11", label: "Nov" }, { v: "12", label: "Dez" },
    ];

    const compactFieldSx = {
        "& .MuiInputBase-root": { minHeight: 34, fontSize: 12 },
        "& .MuiInputLabel-root": { fontSize: 12 },
    };


    const filterFieldSx = {
        "& .MuiOutlinedInput-root": {
            borderRadius: 2,
            height: 36,
            fontSize: 13,
        },
        "& .MuiInputLabel-root": { fontSize: 12 },
        "& .MuiSelect-select": { py: 0.6 },
    };

    const handleStatusesChange = (e) => {
        const v = e.target.value;
        setFilterStatuses(Array.isArray(v) ? v : String(v).split(","));
    };



    async function handleDeleteBill(b) {
        const isSeries =
            !!b.installmentGroupId &&
            (b.kind === "installment" || b.kind === "recurring");

        try {
            if (!isSeries) {
                const res = await Swal.fire({
                    title: "Excluir despesa?",
                    html: `<b>${b.name}</b><br/>Essa ação não pode ser desfeita.`,
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "Excluir",
                    cancelButtonText: "Cancelar",
                    confirmButtonColor: "#d33",
                    reverseButtons: true,
                });

                if (!res.isConfirmed) return;

                await dispatch(deleteBillThunk(b.id)).unwrap();
            } else {
                const res = await Swal.fire({
                    title: "Excluir parcelamento/recorrência?",
                    html: `<b>${b.name}</b><br/>Você quer excluir só este item ou toda a série?`,
                    icon: "warning",
                    showCancelButton: true,
                    showDenyButton: true,
                    confirmButtonText: "Excluir TODAS",
                    denyButtonText: "Excluir só esta",
                    cancelButtonText: "Cancelar",
                    confirmButtonColor: "#d33",
                    denyButtonColor: "#111827",
                    reverseButtons: true,
                });

                if (res.isDismissed) return;

                if (res.isDenied) {
                    await dispatch(deleteBillThunk(b.id)).unwrap();
                } else if (res.isConfirmed) {
                    // ✅ NÃO chama http direto: use thunk/API
                    await dispatch(deleteBillSeriesThunk({ installmentGroupId: b.installmentGroupId })).unwrap();
                }
            }

            await dispatch(fetchBillsThunk());
            await dispatch(fetchAllTransactionsThunk());

            Swal.fire({
                title: "Pronto!",
                text: "Despesa removida com sucesso.",
                icon: "success",
                timer: 1200,
                showConfirmButton: false,
            });
        } catch (e) {
            Swal.fire({
                title: "Erro ao excluir",
                text: e?.detail || "Não foi possível excluir.",
                icon: "error",
            });
        }
    }
    return (
        <Box sx={pageSx}>
            <Stack spacing={1.2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 950 }}>
                            Despesas (Bills)
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            Total: <b>{bills.length}</b> • Ativas: <b>{activeCount}</b>
                        </Typography>
                    </Box>

                    <Button
                        variant="contained"
                        startIcon={<AddRoundedIcon />}
                        sx={{ fontWeight: 950 }}
                        onClick={() => setOpenNew(true)}
                    >
                        Nova despesa
                    </Button>
                </Stack>

                <Divider />

                {/* ===== filtros (grid minimalista) ===== */}
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ py: 1.2 }}>
                        <Stack spacing={1}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                                <Stack direction="row" alignItems="center" gap={1}>
                                    <FilterAltRoundedIcon sx={{ opacity: 0.7 }} />
                                    <Typography sx={{ fontWeight: 900, fontSize: 13 }}>Filtros</Typography>
                                </Stack>

                                <Tooltip title="Limpar filtros">
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            setFilterMonth("all");
                                            setFilterYear(currentYear); // ✅ mantém ano atual
                                            setFilterStatuses(["planned", "due_today", "overdue"]);
                                            setFilterKinds(["recurring", "installment", "one_off"]);
                                            setRangeStart("");
                                            setRangeEnd("");
                                            setQ("");
                                            setFilterCategory("all");
                                        }}
                                    >
                                        <ClearRoundedIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>

                            <ToggleButtonGroup
                                value={filterMonth} // "all" ou "01".."12"
                                exclusive
                                onChange={(_, v) => v != null && setFilterMonth(v)}
                                sx={{
                                    width: "100%",
                                    display: "grid",
                                    gridTemplateColumns: "repeat(13, 1fr)",
                                    gap: 0.6,
                                    "& .MuiToggleButton-root": {
                                        m: 0,
                                        borderRadius: 1.2,
                                        minHeight: 34,
                                        px: 0.5,
                                        py: 0.25,
                                        fontSize: 11.5,
                                        fontWeight: 900,
                                        textTransform: "none",
                                        border: "1px solid rgba(0,0,0,0.12)",
                                    },
                                }}
                            >
                                {monthOptions.map((m) => (
                                    <ToggleButton key={m.v} value={m.v} aria-label={m.label}>
                                        {m.label}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>

                            {/* Grid fino */}
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "100px 220px 200px 200px 1fr" },
                                    gap: 1,
                                    alignItems: "center",
                                    mt: 1,
                                }}
                            >
                                <TextField
                                    size="small"
                                    label="Ano"
                                    select
                                    value={filterYear}
                                    onChange={(e) => setFilterYear(e.target.value)}
                                    sx={compactFieldSx}
                                    fullWidth
                                >
                                    {yearOptions.map((y) => (
                                        <MenuItem key={y} value={y}>{y}</MenuItem>
                                    ))}
                                </TextField>

                                <TextField
                                    size="small"
                                    label="Tipo"
                                    select
                                    value={filterKind}
                                    onChange={(e) => setFilterKind(e.target.value)}
                                    sx={compactFieldSx}
                                    fullWidth
                                >
                                    <MenuItem value="all">Todos</MenuItem>
                                    <MenuItem value="recurring">Recorrente</MenuItem>
                                    <MenuItem value="installment">Parcelado</MenuItem>
                                    <MenuItem value="one_off">Pontual</MenuItem>
                                </TextField>

                                <TextField
                                    size="small"
                                    label="Status"
                                    select
                                    SelectProps={{
                                        multiple: true,
                                        value: filterStatuses,
                                        onChange: handleStatusesChange,
                                        renderValue: (selected) =>
                                            selected
                                                .map(
                                                    (s) =>
                                                    ({
                                                        planned: "Previsto",
                                                        due_today: "Vencendo hoje",
                                                        overdue: "Atrasado",
                                                        paid: "Pago",
                                                    }[s] || s)
                                                )
                                                .join(" • "),
                                    }}
                                    sx={compactFieldSx}
                                    fullWidth
                                >
                                    <MenuItem value="planned">Previsto</MenuItem>
                                    <MenuItem value="due_today">Vencendo hoje</MenuItem>
                                    <MenuItem value="overdue">Atrasado</MenuItem>
                                    <MenuItem value="paid">Pago</MenuItem>
                                </TextField>

                                <TextField
                                    size="small"
                                    label="Categoria"
                                    select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    fullWidth
                                    SelectProps={{
                                        renderValue: (val) => {
                                            if (val === "all") return "Todas";
                                            const cat = categoriesById.get(String(val));
                                            if (!cat) return String(val);
                                            return `${pickCategoryIcon(cat)} ${cat.name}`;
                                        },
                                    }}
                                >
                                    <MenuItem value="all">Todas</MenuItem>

                                    {categoryOptions.map((c) => (
                                        <MenuItem key={c.id} value={String(c.id)}>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, width: "100%" }}>
                                                <MsIcon name={(c.icon || "").trim() || "tag"} size={18} />
                                                <Typography noWrap sx={{ fontWeight: 900, flex: 1, minWidth: 0, marginLeft: "10px" }}>
                                                    {c.name}
                                                </Typography>
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </TextField>

                                <TextField
                                    size="small"
                                    label="Buscar"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    sx={compactFieldSx}
                                    fullWidth
                                    placeholder="Descrição, favorecido..."
                                />
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>

                {/* ✅ CONTEÚDO */}
                {status === "loading" ? (
                    <SpinnerPage status={status} />
                ) : (
                    <>
                        {error ? <Alert severity="error">{String(error)}</Alert> : null}

                        <Stack spacing={1.2}>
                            {filteredBills.length === 0 ? (
                                <Card variant="outlined" sx={{ borderRadius: 2, borderStyle: "dashed" }}>
                                    <CardContent sx={{ py: 3 }}>
                                        <Stack spacing={0.6} alignItems="center">
                                            <PaymentsRoundedIcon sx={{ opacity: 0.6 }} />
                                            <Typography sx={{ fontWeight: 950 }}>Nenhuma despesa encontrada</Typography>
                                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                                Ajuste os filtros ou crie uma nova Bill.
                                            </Typography>
                                            <Button
                                                onClick={() => setOpenNew(true)}
                                                variant="contained"
                                                startIcon={<AddRoundedIcon />}
                                                sx={{ fontWeight: 950, mt: 1 }}
                                            >
                                                Criar despesa
                                            </Button>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ) : null}

                            {timeline.map((monthBlock) => (
                                <Box key={monthBlock.monthKey}>
                                    <Stack
                                        direction="row"
                                        alignItems="baseline"
                                        justifyContent="flex-start"
                                        sx={{ mt: 1.2, mb: "-10px", marginTop: "40px" }}
                                    >
                                        <Typography variant="h6" sx={{ fontWeight: 950, textTransform: "capitalize" }}>
                                            {monthBlock.monthLabel}
                                        </Typography>
                                        <Typography variant="subtitle1" sx={{ color: "text.secondary", marginLeft: "10px" }}>
                                            • <b>{formatBRL((monthBlock.monthTotalCents || 0) / 100)}</b>
                                        </Typography>
                                    </Stack>

                                    {monthBlock.days.map((dayBlock) => (
                                        <Box key={dayBlock.dayKey} sx={{ mb: 1.2 }}>
                                            <Stack direction="row" alignItems="center" gap={1} sx={{ my: 1 }}>
                                                <Divider sx={{ flex: 1 }} />
                                                <Stack direction="row" alignItems="center" gap={1}>
                                                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>
                                                        {dayBlock.dayLabel}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                                        • <b>{formatBRL((dayBlock.dayTotalCents || 0) / 100)}</b>
                                                    </Typography>
                                                </Stack>
                                                <Divider sx={{ flex: 1 }} />
                                            </Stack>

                                            <Stack spacing={1.2}>
                                                {dayBlock.items.map(({ bill: b, dueISO, uiStatus }) => {
                                                    const meta = kindMeta(b.kind);
                                                    const canPay = uiStatus !== "paid";

                                                    return (
                                                        <Card
                                                            key={b.id}
                                                            variant="outlined"
                                                            sx={{
                                                                borderRadius: 2,
                                                                transition: "box-shadow 0.15s ease, border-color 0.15s ease",
                                                                "&:hover": { borderColor: "rgba(0,0,0,0.18)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
                                                            }}
                                                        >
                                                            <CardContent sx={{ py: 1.4 }}>
                                                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between">
                                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                                                                            <Typography sx={{ fontWeight: 950 }} noWrap>
                                                                                {b.name}
                                                                            </Typography>

                                                                            <Chip size="small" label={meta.label} icon={meta.icon} variant="outlined" sx={{ fontWeight: 850 }} />

                                                                            {statusChip(uiStatus)}

                                                                            {b.installmentTotal ? (
                                                                                <Chip
                                                                                    size="small"
                                                                                    label={`Parcela ${b.installmentCurrent} de ${b.installmentTotal}`}
                                                                                    variant="filled"
                                                                                    color="secondary"
                                                                                />
                                                                            ) : null}
                                                                        </Stack>

                                                                        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                                                                            Vencimento: <b>{formatBRDate(dueISO)}</b> • Valor: <b>{moneySafe(b.defaultAmount)}</b>
                                                                        </Typography>

                                                                        {(() => {
                                                                            const cat = resolveCategoryFromBill(b);
                                                                            return (
                                                                                <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 0.6, flexWrap: "wrap", p: 1 }}>
                                                                                    <CategoryChip cat={cat} />
                                                                                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                                                                                        • Favorecido: <b>{b.payee || "—"}</b>
                                                                                    </Typography>
                                                                                </Stack>
                                                                            );
                                                                        })()}

                                                                        {b.notes ? (
                                                                            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.6 }}>
                                                                                {b.notes}
                                                                            </Typography>
                                                                        ) : null}
                                                                    </Box>

                                                                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" sx={{ flexWrap: "wrap" }}>
                                                                        {canPay ? (
                                                                            <Button size="small" variant="contained" startIcon={<PaidRoundedIcon />} onClick={() => setPayBill(b)}>
                                                                                Pagar
                                                                            </Button>
                                                                        ) : (
                                                                            <Button
                                                                                size="small"
                                                                                variant="outlined"
                                                                                startIcon={<ReplayRoundedIcon />}
                                                                                onClick={async () => {
                                                                                    const ok = window.confirm(`Reabrir "${b.name}"? Isso remove a transação de pagamento.`);
                                                                                    if (!ok) return;
                                                                                    try {
                                                                                        if (reopenBillThunk) await dispatch(reopenBillThunk({ id: b.id })).unwrap();
                                                                                        await dispatch(fetchBillsThunk());
                                                                                        await dispatch(fetchAllTransactionsThunk());
                                                                                    } catch { }
                                                                                }}
                                                                            >
                                                                                Reabrir
                                                                            </Button>
                                                                        )}

                                                                        <Button size="small" variant="outlined" startIcon={<EditRoundedIcon />} onClick={() => setEditBill(b)}>
                                                                            Editar
                                                                        </Button>

                                                                        <Button
                                                                            size="small"
                                                                            color="error"
                                                                            variant="outlined"
                                                                            startIcon={<DeleteOutlineRoundedIcon />}
                                                                            onClick={() => handleDeleteBill(b)}
                                                                        >
                                                                            Remover
                                                                        </Button>
                                                                    </Stack>
                                                                </Stack>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </Stack>
                                        </Box>
                                    ))}
                                </Box>
                            ))}
                        </Stack>
                    </>
                )}

                {/* ✅ dialogs sempre fora do loading */}
                <BillsFormDialog open={openNew} onClose={() => setOpenNew(false)} initial={null} />
                <BillsFormDialog open={!!editBill} onClose={() => setEditBill(null)} initial={editBill} />
                <GenerateDialog open={!!genBill} onClose={() => setGenBill(null)} bill={genBill} />
                <PayBillDialog open={!!payBill} onClose={() => setPayBill(null)} bill={payBill} />
            </Stack>
        </Box>
    );
}