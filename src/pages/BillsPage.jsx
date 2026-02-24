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
    Autocomplete,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

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
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";

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
    reopenBillThunk, // se não existir no slice, remova a import e o botão “Reabrir”
} from "../store/billsSlice";

import { fetchAllTransactionsThunk, selectTransactionsApi } from "../store/transactionsSlice";
import { listAccounts } from "../api/accountsApi";

import { formatBRL } from "../utils/money";

import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

import { selectActiveCategories, fetchCategoriesThunk } from "../store/categoriesSlice";

import Swal from "sweetalert2";
import SpinnerPage from "../components/ui/Spinner";

const pageSx = { maxWidth: 1120, mx: "auto", px: { xs: 2, md: 3 }, py: 2 };

/* =========================
   Helpers
========================= */
function formatBRDate(iso) {
    if (!iso || String(iso).length !== 10) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}
function isoFromYMDay(ym, day) {
    if (!ym) return "";
    const dd = String(Math.max(1, Math.min(28, Number(day || 10)))).padStart(2, "0");
    return `${ym}-${dd}`;
}
function brDateFromISO(iso) {
    if (!iso || String(iso).length < 10) return "—";
    const [y, m, d] = String(iso).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
}
function monthYearLabelFromYM(ym) {
    if (!ym || String(ym).length !== 7) return "—";
    const [y, m] = ym.split("-");
    const dt = new Date(Number(y), Number(m) - 1, 1);
    return dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
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
function computeUiStatus({ baseStatus, dueISO, todayISO }) {
    if (baseStatus === "paid") return "paid";
    if (!dueISO) return "planned";
    if (dueISO < todayISO) return "overdue";
    if (dueISO === todayISO) return "due_today";
    return "planned";
}

/* ====== BR input helpers (robusto) ====== */
function parseBRLInputHandlePay(value) {
    let s = String(value ?? "").trim();
    if (!s) return null;

    s = s.replace(/[^\d,.\-]/g, "");

    const hasComma = s.includes(",");
    const hasDot = s.includes(".");

    if (hasComma) {
        s = s.replace(/\./g, "");
        s = s.replace(",", ".");
    } else if (hasDot) {
        s = s.replace(/,/g, "");
        const lastDot = s.lastIndexOf(".");
        s = s.slice(0, lastDot).replace(/\./g, "") + "." + s.slice(lastDot + 1).replace(/\./g, "");
    }

    if (!s || s === "-" || s === "." || s === "-.") return null;

    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
}
function parseBRLInput(value) {
    const s = String(value ?? "").replace(/[^\d,.-]/g, "").replace(/\.(?=.*\.)/g, "").replace(",", ".");
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

/* ===== Icons for categories ===== */
function MsIcon({ name, size = 18, color = "inherit" }) {
    if (!name) return null;
    const isEmojiLike = /[^\w_]/.test(String(name));
    if (isEmojiLike) return <span style={{ fontSize: size, lineHeight: 1, color }}>{name}</span>;
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
                marginLeft: "10px",
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
    const k = raw.toLowerCase();
    if (ICON_MAP[k]) return ICON_MAP[k];
    if (raw.length <= 2) return raw;
    return raw.slice(0, 1).toUpperCase();
}

/* =========================
   Dialogs
========================= */
function BillsFormDialog({ open, onClose, initial, payeeOptions = [] }) {
    const dispatch = useDispatch();
    const isEdit = !!initial?.id;
    const categories = useSelector(selectActiveCategories);

    const [uiType, setUiType] = useState(initial?.kind === "one_off" ? "one_off" : "recurring");
    const [description, setDescription] = useState(initial?.name || "");
    const [payee, setPayee] = useState(initial?.payee || "");
    const [categoryId, setCategoryId] = useState(initial?.categoryId || "outros");
    const [notes, setNotes] = useState(initial?.notes || "");
    const [dayOfMonth, setDayOfMonth] = useState(String(initial?.dayOfMonth ?? 10));
    const [startMonth, setStartMonth] = useState(initial?.startMonth || "");
    const [endMonth, setEndMonth] = useState(initial?.endMonth || "");

    const [installmentTotal, setInstallmentTotal] = useState("12");
    const [firstInstallmentMonth, setFirstInstallmentMonth] = useState(ymNow());

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
            return "";
        } else if (uiType === "recurring") {
            const d = Number(dayOfMonth);
            if (!Number.isFinite(d) || d < 1 || d > 28) return "Dia do mês deve ser entre 1 e 28.";
            if (startMonth && String(startMonth).length !== 7) return "Início deve ser YYYY-MM.";
            if (endMonth && String(endMonth).length !== 7) return "Fim deve ser YYYY-MM.";
            if (startMonth && endMonth && endMonth < startMonth) return "Fim não pode ser menor que início.";
            return "";
        } else if (uiType === "one_off") {
            if (!paidDate || String(paidDate).length !== 10) return "Selecione a Data do pagamento.";
        }
        return "";
    }

    async function handleSave() {
        setErr("");
        const e = validate();
        if (e) return setErr(e);

        setSaving(true);

        const addMonthsYM = (ym, add) => {
            const [yy, mm] = String(ym || "").split("-").map(Number);
            if (!Number.isFinite(yy) || !Number.isFinite(mm)) return "";
            const base = yy * 12 + (mm - 1) + Number(add || 0);
            const y2 = Math.floor(base / 12);
            const m2 = (base % 12) + 1;
            return `${y2}-${String(m2).padStart(2, "0")}`;
        };

        const parsed = parseBRLInputHandlePay(defaultAmount);

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
            payload = { ...payload, kind: "recurring", dayOfMonth: Number(dayOfMonth), startMonth: startMonth || "", endMonth: endMonth || "" };
        } else if (uiType === "installment") {
            const tot = Number(installmentTotal);
            const startYM = firstInstallmentMonth || "";
            const endYM = startYM ? addMonthsYM(startYM, tot - 1) : "";
            payload = { ...payload, kind: "installment", dayOfMonth: Number(dayOfMonth), startMonth: startYM, endMonth: endYM };
        } else {
            const ym = ymFromISODate(paidDate);
            payload = { ...payload, kind: "one_off", dayOfMonth: dayFromISODate(paidDate), startMonth: ym, endMonth: ym };
        }

        try {
            if (isEdit) await dispatch(updateBillThunk({ id: initial.id, patch: payload })).unwrap();
            else await dispatch(createBillThunk(payload)).unwrap();

            await dispatch(fetchBillsThunk());
            onClose();
        } catch (x) {
            setErr(x?.detail || "Erro ao salvar.");
        } finally {
            setSaving(false);
        }
    }

    const monthFieldProps = { type: "month", InputLabelProps: { shrink: true } };
    const borderColor = "rgba(25,118,210,0.28)";
    const gradientAccent = "rgba(25,118,210,0.16)";
    const tintBg = "rgba(255,255,255,0.92)";

    const fieldSx = {
        "& .MuiInputLabel-root": { color: "rgba(15,23,42,0.82)" },
        "& .MuiInputLabel-root.Mui-focused": { color: "rgba(15,23,42,0.92)" },
        "& .MuiOutlinedInput-root": { backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 2 },
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
            <DialogTitle sx={{ fontWeight: 950, color: "rgba(15,23,42,0.98)" }}>{isEdit ? "Editar despesa" : "Nova despesa"}</DialogTitle>

            <DialogContent>
                <Stack spacing={1.2} sx={{ mt: 2.2 }}>
                    {err ? <Alert severity="error">{err}</Alert> : null}

                    <TextField sx={fieldSx} label="Tipo" select value={uiType} onChange={(e) => setUiType(e.target.value)} fullWidth>
                        <MenuItem value="recurring">Recorrente</MenuItem>
                        <MenuItem value="one_off">Pontual</MenuItem>
                        <MenuItem value="installment">Parcelado</MenuItem>
                    </TextField>

                    <TextField sx={fieldSx} label="Descrição *" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />

                    <Autocomplete
                        freeSolo
                        options={payeeOptions}
                        value={payee ? payee : ""}
                        inputValue={payee}
                        onInputChange={(_, newInputValue) => setPayee(newInputValue)}
                        onChange={(_, newValue) => {
                            if (typeof newValue === "string") setPayee(newValue);
                            else if (newValue && typeof newValue === "object") setPayee(newValue.label || "");
                            else setPayee("");
                        }}
                        getOptionLabel={(opt) => (typeof opt === "string" ? opt : opt?.label || "")}
                        isOptionEqualToValue={(opt, val) => {
                            const o = typeof opt === "string" ? opt : opt?.label;
                            const v = typeof val === "string" ? val : val?.label;
                            return String(o || "").toLowerCase() === String(v || "").toLowerCase();
                        }}
                        renderOption={(props, option) => {
                            const label = typeof option === "string" ? option : option?.label;
                            const count = typeof option === "object" ? option?.count : null;
                            return (
                                <li {...props}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: "100%" }}>
                                        <span style={{ fontWeight: 800 }}>{label}</span>
                                        {count ? <Chip size="small" label={`${count}x`} variant="outlined" sx={{ ml: 1, opacity: 0.85, fontWeight: 900 }} /> : null}
                                    </Stack>
                                </li>
                            );
                        }}
                        renderInput={(params) => (
                            <TextField {...params} sx={fieldSx} label="Favorecido" fullWidth placeholder="Ex: Supermercado, Uber, Claro..." helperText="Sugestões baseadas no histórico." />
                        )}
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
                            InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
                        />
                    </Stack>

                    {uiType === "recurring" ? (
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} pt={1}>
                            <TextField sx={fieldSx} label="Dia do mês (1..28)" type="number" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} inputProps={{ min: 1, max: 28 }} fullWidth />
                            <TextField sx={fieldSx} label="Início (mês)" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} fullWidth type="month" InputLabelProps={{ shrink: true }} />
                            <TextField sx={fieldSx} label="Fim (mês)" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} fullWidth type="month" InputLabelProps={{ shrink: true }} />
                        </Stack>
                    ) : uiType === "one_off" ? (
                        <TextField sx={fieldSx} label="Data do pagamento" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                    ) : (
                        <>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} pt={1}>
                                <TextField sx={fieldSx} label="Qtd. parcelas" type="number" value={installmentTotal} onChange={(e) => setInstallmentTotal(e.target.value)} inputProps={{ min: 2, max: 240 }} fullWidth />
                                <TextField sx={fieldSx} label="1ª parcela (mês)" type="month" value={firstInstallmentMonth} onChange={(e) => setFirstInstallmentMonth(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                            </Stack>
                            <TextField sx={fieldSx} label="Dia do mês (1..28)" type="number" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} inputProps={{ min: 1, max: 28 }} fullWidth />
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

                    {mode === "months" ? <TextField label="Meses" type="number" value={months} onChange={(e) => setMonths(e.target.value)} inputProps={{ min: 1, max: 240 }} fullWidth /> : null}

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
                        if (aIsCC !== bIsCC) return aIsCC ? 1 : -1;
                        return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
                    });

                setAccounts(ordered);
                setAccountId(ordered?.[0]?.id || "");
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
            if (parsed === null || parsed <= 0) return setErr("Valor inválido.");
            amountToSend = formatBRNumber(parsed);
        } else if (bill?.defaultAmount == null) {
            return setErr("Informe o valor (ou defina um valor padrão na despesa).");
        }

        setSaving(true);
        try {
            await dispatch(payBillThunk({ id: bill.id, body: { paid_date: paidDate, account_id: accountId, amount: amountToSend || undefined } })).unwrap();
            dispatch(fetchBillsThunk());
            dispatch(fetchAllTransactionsThunk());
            onClose();
        } catch (e) {
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

                    <TextField label="Data do pagamento" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />

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
                        InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
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

/* =========================
   Page
========================= */
export default function BillsPage() {
    const dispatch = useDispatch();
    const theme = useTheme();

    const bills = useSelector(selectBills);
    const status = useSelector(selectBillsStatus);
    const error = useSelector(selectBillsError);

    const txns = useSelector(selectTransactionsApi);
    const categories = useSelector(selectActiveCategories);

    const [openNew, setOpenNew] = useState(false);
    const [editBill, setEditBill] = useState(null);
    const [genBill, setGenBill] = useState(null);
    const [payBill, setPayBill] = useState(null);

    const now = new Date();
    const currentYear = String(now.getFullYear());
    const currentMonth = String(now.getMonth() + 1).padStart(2, "0");

    const [filterKind, setFilterKind] = useState("all");
    const [filterStatuses, setFilterStatuses] = useState(["planned", "due_today", "overdue"]);
    const [q, setQ] = useState("");

    const [filterMonth, setFilterMonth] = useState(currentMonth);
    const [filterYear, setFilterYear] = useState(currentYear);
    const [filterCategory, setFilterCategory] = useState("all");

    useEffect(() => {
        dispatch(fetchBillsThunk());
        dispatch(fetchAllTransactionsThunk());
        dispatch(fetchCategoriesThunk());
    }, [dispatch]);

    const yearOptions = useMemo(() => {
        const set = new Set();
        (bills || []).forEach((b) => {
            const ym = String(b.startMonth || "").slice(0, 7);
            const y = ym ? ym.slice(0, 4) : "";
            if (y) set.add(y);
        });
        return Array.from(set).sort();
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

    const payeeOptions = useMemo(() => {
        const counts = new Map();
        const bump = (raw) => {
            const s = String(raw || "").trim();
            if (!s) return;
            const key = s.toLowerCase().replace(/\s+/g, " ").trim();
            if (!key) return;
            const cur = counts.get(key);
            if (cur) counts.set(key, { label: cur.label, count: cur.count + 1 });
            else counts.set(key, { label: s, count: 1 });
        };

        (txns || []).forEach((t) => {
            bump(t?.merchant);
            bump(t?.payee);
        });
        (bills || []).forEach((b) => bump(b?.payee));

        return Array.from(counts.values())
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"))
            .slice(0, 80);
    }, [txns, bills]);

    function resolveCategoryFromBill(b) {
        const raw = b?.categoryId ?? b?.category_id ?? b?.category ?? "";
        const key = String(raw);
        return categoriesById.get(key) || categoriesBySlug.get(key) || null;
    }

    const categoryOptions = useMemo(() => {
        return (categories || [])
            .filter((c) => c.active !== false)
            .slice()
            .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
    }, [categories]);

    const activeCount = useMemo(() => (bills || []).filter((b) => b.active !== false).length, [bills]);

    // ===== STATUS MAP (inclui due_today) =====
    const billStatusForMonth = useMemo(() => {
        const map = new Map();
        const today = todayISO();

        const txnMap = new Map();
        (txns || []).forEach((t) => {
            const k = `${String(t?.bill_id || "")}__${String(t?.invoice_month || "").slice(0, 7)}`;
            if (!k || k.startsWith("__")) return;
            const prev = txnMap.get(k);
            if (!prev) txnMap.set(k, t);
            else {
                const ps = String(prev?.status || "");
                const ns = String(t?.status || "");
                if (ps !== "paid" && ns === "paid") txnMap.set(k, t);
            }
        });

        (bills || []).forEach((b) => {
            const ym = b.startMonth || ymNow();
            const dueISO = isoFromYMDay(ym, b.dayOfMonth);

            let st = b.lastPaidTransactionId ? "paid" : "planned";

            const t = txnMap.get(`${String(b.id)}__${ym}`);
            if (t?.status === "paid") st = "paid";

            if (st !== "paid" && dueISO) {
                if (dueISO < today) st = "overdue";
                else if (dueISO === today) st = "due_today";
                else st = "planned";
            }
            map.set(b.id, st);
        });

        return map;
    }, [bills, txns]);

    const filteredBills = useMemo(() => {
        const needle = String(q || "").trim().toLowerCase();

        return (bills || [])
            .filter((b) => {
                if (filterKind !== "all" && String(b.kind) !== String(filterKind)) return false;

                const dueYM = b.startMonth || `${filterYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
                const dueISO = isoFromYMDay(dueYM, b.dayOfMonth);
                if (!dueISO) return false;

                const dueYear = dueISO.slice(0, 4);
                const dueMonth = dueISO.slice(5, 7);

                if (String(dueYear) !== String(filterYear)) return false;
                if (filterMonth !== "all" && String(dueMonth) !== String(filterMonth)) return false;

                const st = billStatusForMonth.get(b.id) || "planned";
                if (filterStatuses?.length && !filterStatuses.includes(st)) return false;

                const cat = resolveCategoryFromBill(b);
                const cid = cat ? String(cat.id) : "";
                if (filterCategory !== "all" && cid !== String(filterCategory)) return false;

                if (!needle) return true;
                const hay = `${b.name || ""} ${b.payee || ""} ${b.categoryId || ""} ${b.notes || ""}`.toLowerCase();
                return hay.includes(needle);
            })
            .sort((a, b) => {
                const aISO = isoFromYMDay(a.startMonth, a.dayOfMonth) || "9999-12-31";
                const bISO = isoFromYMDay(b.startMonth, b.dayOfMonth) || "9999-12-31";
                return aISO.localeCompare(bISO);
            });
    }, [bills, q, filterKind, filterYear, filterMonth, filterStatuses, billStatusForMonth, filterCategory]);

    // ===== UI status meta =====
    const STATUS_META = useMemo(() => {
        const c = theme.palette;
        return {
            paid: {
                label: "Pago",
                dot: c.success.main,
                chipSx: { bgcolor: alpha(c.success.main, 0.16), borderColor: alpha(c.success.main, 0.55), color: c.success.dark },
            },
            due_today: {
                label: "Vence hoje",
                dot: c.warning.main,
                chipSx: { bgcolor: alpha(c.warning.main, 0.20), borderColor: alpha(c.warning.main, 0.65), color: c.warning.dark },
            },
            overdue: {
                label: "Atrasado",
                dot: c.error.main,
                chipSx: { bgcolor: alpha(c.error.main, 0.18), borderColor: alpha(c.error.main, 0.60), color: c.error.dark },
            },
            planned: {
                label: "Previsto",
                dot: c.info.main,
                chipSx: { bgcolor: alpha(c.info.main, 0.14), borderColor: alpha(c.info.main, 0.55), color: c.info.dark },
            },
        };
    }, [theme]);

    function StatusPill({ st, dense = false }) {
        const m = STATUS_META[st] || STATUS_META.planned;
        return (
            <Chip
                size="small"
                variant="outlined"
                icon={<FiberManualRecordRoundedIcon sx={{ fontSize: 14, color: m.dot }} />}
                label={m.label}
                sx={{
                    fontWeight: 950,
                    letterSpacing: -0.2,
                    borderWidth: 1.6,
                    borderRadius: 999,
                    height: dense ? 26 : 28,
                    ...m.chipSx,
                    "& .MuiChip-icon": { ml: 0.45, mr: -0.2 },
                }}
            />
        );
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
                icon={iconTxt ? <MsIcon name={iconTxt} size={18} /> : <span style={{ width: 10, height: 10, borderRadius: 6, background: dot, display: "inline-block" }} />}
                sx={{ fontWeight: 900, borderColor: dot, bgcolor: alpha(dot, 0.10), "& .MuiChip-icon": { marginLeft: 0 } }}
            />
        );
    }

    const today = todayISO();

    // ===== timeline + totais =====
    const timeline = useMemo(() => {
        const buckets = new Map();
        const fallbackYM = `${filterYear}-${String(filterMonth).padStart(2, "0")}`;

        const safeCents = (bill) => {
            const v = bill?.defaultAmount;
            if (v === null || v === undefined) return 0;
            const n = Number(v);
            if (!Number.isFinite(n)) return 0;
            return Math.round(n * 100);
        };

        (filteredBills || []).forEach((b) => {
            const dueYM = b.startMonth || fallbackYM;
            const dueISO = isoFromYMDay(dueYM, b.dayOfMonth);

            const base = billStatusForMonth.get(b.id) || "planned";
            const uiStatus = computeUiStatus({ baseStatus: base, dueISO, todayISO: today });

            const monthKey = dueISO ? dueISO.slice(0, 7) : dueYM;
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

                const totals = items.reduce(
                    (acc, it) => {
                        const cents = safeCents(it.bill);
                        acc.all += cents;
                        acc[it.uiStatus] = (acc[it.uiStatus] || 0) + cents;
                        acc.open += it.uiStatus === "paid" ? 0 : cents;
                        return acc;
                    },
                    { all: 0, open: 0, paid: 0, due_today: 0, overdue: 0, planned: 0 }
                );

                return {
                    dayKey,
                    dayLabel: dayKey === "sem_data" ? "Sem vencimento" : brDateFromISO(dayKey),
                    totals,
                    items,
                };
            });

            const monthTotals = days.reduce(
                (acc, d) => {
                    acc.all += d.totals.all || 0;
                    acc.open += d.totals.open || 0;
                    acc.paid += d.totals.paid || 0;
                    acc.due_today += d.totals.due_today || 0;
                    acc.overdue += d.totals.overdue || 0;
                    acc.planned += d.totals.planned || 0;
                    return acc;
                },
                { all: 0, open: 0, paid: 0, due_today: 0, overdue: 0, planned: 0 }
            );

            return { monthKey, monthLabel: monthYearLabelFromYM(monthKey), monthTotals, days };
        });
    }, [filteredBills, billStatusForMonth, filterMonth, filterYear, today]);

    const monthOptions = [
        { v: "all", label: "Todos" },
        { v: "01", label: "Jan" },
        { v: "02", label: "Fev" },
        { v: "03", label: "Mar" },
        { v: "04", label: "Abr" },
        { v: "05", label: "Mai" },
        { v: "06", label: "Jun" },
        { v: "07", label: "Jul" },
        { v: "08", label: "Ago" },
        { v: "09", label: "Set" },
        { v: "10", label: "Out" },
        { v: "11", label: "Nov" },
        { v: "12", label: "Dez" },
    ];

    const compactFieldSx = {
        "& .MuiInputBase-root": { minHeight: 34, fontSize: 12 },
        "& .MuiInputLabel-root": { fontSize: 12 },
    };

    const handleStatusesChange = (e) => {
        const v = e.target.value;
        setFilterStatuses(Array.isArray(v) ? v : String(v).split(","));
    };

    async function handleDeleteBill(b) {
        const isSeries = !!b.installmentGroupId && (b.kind === "installment" || b.kind === "recurring");

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

                if (res.isDenied) await dispatch(deleteBillThunk(b.id)).unwrap();
                else if (res.isConfirmed) await dispatch(deleteBillSeriesThunk({ installmentGroupId: b.installmentGroupId })).unwrap();
            }

            await dispatch(fetchBillsThunk());
            await dispatch(fetchAllTransactionsThunk());

            Swal.fire({ title: "Pronto!", text: "Despesa removida com sucesso.", icon: "success", timer: 1200, showConfirmButton: false });
        } catch (e) {
            Swal.fire({ title: "Erro ao excluir", text: e?.detail || "Não foi possível excluir.", icon: "error" });
        }
    }

    const clearAllFilters = () => {
        setFilterMonth("all");
        setFilterYear(currentYear);
        setFilterStatuses(["planned", "due_today", "overdue"]);
        setQ("");
        setFilterCategory("all");
        setFilterKind("all");
    };

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

                    <Button variant="contained" startIcon={<AddRoundedIcon />} sx={{ fontWeight: 950 }} onClick={() => setOpenNew(true)}>
                        Nova despesa
                    </Button>
                </Stack>

                <Divider />

                {/* ===== filtros ===== */}
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ py: 1.2 }}>
                        <Stack spacing={1}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                                <Stack direction="row" alignItems="center" gap={1}>
                                    <FilterAltRoundedIcon sx={{ opacity: 0.7 }} />
                                    <Typography sx={{ fontWeight: 900, fontSize: 13 }}>Filtros</Typography>
                                </Stack>

                                <Tooltip title="Limpar filtros">
                                    <IconButton size="small" onClick={clearAllFilters}>
                                        <ClearRoundedIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>

                            <ToggleButtonGroup
                                value={filterMonth}
                                exclusive
                                onChange={(_, v) => v != null && setFilterMonth(v)}
                                sx={(t) => ({
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
                                        border: `1px solid ${t.palette.divider}`,
                                        color: t.palette.text.secondary,
                                        backgroundColor: "transparent",
                                        transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
                                    },
                                    "& .MuiToggleButton-root.Mui-selected": {
                                        color: t.palette.primary.contrastText,
                                        backgroundColor: t.palette.primary.main,
                                        borderColor: t.palette.primary.main,
                                    },
                                    "& .MuiToggleButton-root.Mui-selected:hover": {
                                        backgroundColor: t.palette.primary.dark,
                                        borderColor: t.palette.primary.dark,
                                    },
                                    "& .MuiToggleButton-root:hover": { backgroundColor: t.palette.action.hover },
                                })}
                            >
                                {monthOptions.map((m) => (
                                    <ToggleButton key={m.v} value={m.v} aria-label={m.label}>
                                        {m.label}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>

                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "100px 220px 240px 240px 1fr" },
                                    gap: 1,
                                    alignItems: "center",
                                    mt: 1,
                                }}
                            >
                                <TextField size="small" label="Ano" select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} sx={compactFieldSx} fullWidth>
                                    {yearOptions.map((y) => (
                                        <MenuItem key={y} value={y}>
                                            {y}
                                        </MenuItem>
                                    ))}
                                </TextField>

                                <TextField size="small" label="Tipo" select value={filterKind} onChange={(e) => setFilterKind(e.target.value)} sx={compactFieldSx} fullWidth>
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

                                <TextField size="small" label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} sx={compactFieldSx} fullWidth placeholder="Descrição, favorecido..." />
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
                                            <Button onClick={() => setOpenNew(true)} variant="contained" startIcon={<AddRoundedIcon />} sx={{ fontWeight: 950, mt: 1 }}>
                                                Criar despesa
                                            </Button>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ) : null}

                            {timeline.map((monthBlock) => {
                                const mt = monthBlock.monthTotals || { open: 0, paid: 0, due_today: 0, overdue: 0, planned: 0 };

                                // ✅ chips consolidados do mês só aparecem se tiver MAIS DE 1 item (pra somar “de verdade”)
                                const monthChipCandidates = [
                                    { key: "open", label: "Em aberto", cents: mt.open, bg: alpha(theme.palette.primary.main, 0.10), bd: alpha(theme.palette.primary.main, 0.25) },
                                    { key: "paid", label: "Pago", cents: mt.paid, bg: alpha(theme.palette.success.main, 0.12), bd: alpha(theme.palette.success.main, 0.25) },
                                    { key: "due_today", label: "Vence hoje", cents: mt.due_today, bg: alpha(theme.palette.warning.main, 0.14), bd: alpha(theme.palette.warning.main, 0.32) },
                                    { key: "overdue", label: "Atrasado", cents: mt.overdue, bg: alpha(theme.palette.error.main, 0.12), bd: alpha(theme.palette.error.main, 0.30) },
                                    { key: "planned", label: "Previsto", cents: mt.planned, bg: alpha(theme.palette.info.main, 0.12), bd: alpha(theme.palette.info.main, 0.28) },
                                ].filter((x) => (x.cents || 0) > 0);

                                const showMonthChips = monthChipCandidates.length > 1;

                                return (
                                    <Box key={monthBlock.monthKey}>
                                        <Stack
                                            direction={{ xs: "column", sm: "row" }}
                                            alignItems={{ xs: "flex-start", sm: "baseline" }}
                                            justifyContent="space-between"
                                            sx={{ mt: 1.2, mb: 0.8, marginTop: "40px" }}
                                            gap={1}
                                        >
                                            <Typography variant="h6" sx={{ fontWeight: 950, textTransform: "capitalize" }}>
                                                {monthBlock.monthLabel}
                                            </Typography>

                                            {showMonthChips ? (
                                                <Stack direction="row" gap={0.8} sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                                                    {monthChipCandidates.map((c) => (
                                                        <Chip
                                                            key={c.key}
                                                            size="small"
                                                            label={`${c.label}: ${formatBRL((c.cents || 0) / 100)}`}
                                                            variant="outlined"
                                                            sx={{ fontWeight: 950, borderRadius: 999, bgcolor: c.bg, border: `1px solid ${c.bd}` }}
                                                        />
                                                    ))}
                                                </Stack>
                                            ) : null}
                                        </Stack>

                                        {/* ✅ linhas (dividers) do mês */}
                                        <Divider sx={{ mb: 1.2 }} />

                                        {monthBlock.days.map((dayBlock) => {
                                            const t = dayBlock.totals || { paid: 0, due_today: 0, overdue: 0, planned: 0 };

                                            const dayChips = [
                                                { key: "paid", label: "Pago", cents: t.paid, bg: alpha(theme.palette.success.main, 0.12), bd: alpha(theme.palette.success.main, 0.32) },
                                                { key: "due_today", label: "Vence hoje", cents: t.due_today, bg: alpha(theme.palette.warning.main, 0.14), bd: alpha(theme.palette.warning.main, 0.36) },
                                                { key: "overdue", label: "Atrasado", cents: t.overdue, bg: alpha(theme.palette.error.main, 0.12), bd: alpha(theme.palette.error.main, 0.34) },
                                                { key: "planned", label: "Previsto", cents: t.planned, bg: alpha(theme.palette.info.main, 0.12), bd: alpha(theme.palette.info.main, 0.32) },
                                            ].filter((x) => (x.cents || 0) > 0);

                                            return (
                                                <Box key={dayBlock.dayKey} sx={{ mb: 1.4 }}>
                                                    {/* ✅ header do dia com divider linha (mantém as linhas) */}
                                                    <Stack direction="row" alignItems="center" gap={1} sx={{ my: 1 }}>
                                                        <Divider sx={{ flex: 1 }} />
                                                        <Stack
                                                            direction="row"
                                                            alignItems="center"
                                                            justifyContent="space-between"
                                                            sx={{ px: 0.5, minWidth: { xs: "auto", sm: 520 }, width: "100%" }}
                                                            gap={1}
                                                        >
                                                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 950, whiteSpace: "nowrap" }}>
                                                                {dayBlock.dayLabel}
                                                            </Typography>

                                                            <Stack direction="row" gap={0.8} sx={{ flexWrap: "wrap", justifyContent: "flex-end", ml: "auto" }}>
                                                                {dayChips.map((c) => (
                                                                    <Chip
                                                                        key={c.key}
                                                                        size="small"
                                                                        label={`${c.label}: ${formatBRL((c.cents || 0) / 100)}`}
                                                                        variant="outlined"
                                                                        sx={{ fontWeight: 950, borderRadius: 999, bgcolor: c.bg, border: `1px solid ${c.bd}` }}
                                                                    />
                                                                ))}
                                                            </Stack>
                                                        </Stack>
                                                        <Divider sx={{ flex: 1 }} />
                                                    </Stack>

                                                    <Stack spacing={1.2}>
                                                        {dayBlock.items.map(({ bill: b, dueISO, uiStatus }) => {
                                                            const meta = kindMeta(b.kind);
                                                            const canPay = uiStatus !== "paid";
                                                            const sm = STATUS_META[uiStatus] || STATUS_META.planned;

                                                            return (
                                                                <Card
                                                                    key={b.id}
                                                                    variant="outlined"
                                                                    sx={{
                                                                        borderRadius: 2,
                                                                        position: "relative",
                                                                        overflow: "hidden",
                                                                        borderColor: alpha(sm.dot, 0.35),
                                                                        boxShadow: "0 0 0 rgba(0,0,0,0)",
                                                                        transition: "box-shadow 160ms ease, border-color 160ms ease, transform 160ms ease",
                                                                        "&:hover": {
                                                                            borderColor: alpha(sm.dot, 0.70),
                                                                            boxShadow: `0 10px 30px ${alpha(sm.dot, 0.12)}`,
                                                                            transform: "translateY(-1px)",
                                                                        },
                                                                    }}
                                                                >
                                                                    {/* accent bar */}
                                                                    <Box
                                                                        sx={{
                                                                            position: "absolute",
                                                                            left: 0,
                                                                            top: 0,
                                                                            bottom: 0,
                                                                            width: 6,
                                                                            background: `linear-gradient(180deg, ${alpha(sm.dot, 0.95)}, ${alpha(sm.dot, 0.45)})`,
                                                                        }}
                                                                    />

                                                                    <CardContent sx={{ py: 1.35, pl: 2.2 }}>
                                                                        {/* ✅ topo: chips em cima; botões em baixo à direita */}
                                                                        <Stack spacing={1}>
                                                                            {/* Header: título + chips no canto */}
                                                                            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                                                                                <Stack sx={{ minWidth: 0 }} spacing={0.35}>
                                                                                    <Typography sx={{ fontWeight: 950 }} noWrap>
                                                                                        {b.name}
                                                                                    </Typography>
                                                                                    <Stack direction="row" spacing={0.8} alignItems="center" sx={{ flexWrap: "wrap" }}>
                                                                                        <Chip size="small" label={meta.label} icon={meta.icon} variant="outlined" sx={{ fontWeight: 900 }} />
                                                                                    </Stack>
                                                                                </Stack>

                                                                                <Stack direction="row" alignItems="center" gap={0.8} sx={{ flexShrink: 0 }}>
                                                                                    {b.installmentTotal ? (
                                                                                        <Chip
                                                                                            size="small"
                                                                                            label={`${b.installmentCurrent}/${b.installmentTotal}`}
                                                                                            variant="outlined"
                                                                                            sx={{
                                                                                                fontWeight: 950,
                                                                                                borderRadius: 999,
                                                                                                bgcolor: alpha(theme.palette.secondary.main, 0.10),
                                                                                                borderColor: alpha(theme.palette.secondary.main, 0.28),
                                                                                            }}
                                                                                        />
                                                                                    ) : null}
                                                                                    <StatusPill st={uiStatus} dense />
                                                                                </Stack>
                                                                            </Stack>

                                                                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                                                                Vencimento: <b>{formatBRDate(dueISO)}</b> • Valor: <b>{moneySafe(b.defaultAmount)}</b>
                                                                            </Typography>

                                                                            {(() => {
                                                                                const cat = resolveCategoryFromBill(b);
                                                                                return (
                                                                                    <Stack direction="row" alignItems="center" gap={1} sx={{ flexWrap: "wrap" }}>
                                                                                        <CategoryChip cat={cat} />
                                                                                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                                                                            • Favorecido: <b>{b.payee || "—"}</b>
                                                                                        </Typography>
                                                                                    </Stack>
                                                                                );
                                                                            })()}

                                                                            {b.notes ? (
                                                                                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                                                                    {b.notes}
                                                                                </Typography>
                                                                            ) : null}

                                                                            {/* ✅ divider interno (linhas precisam existir) */}
                                                                            <Divider sx={{ mt: 0.5, mb: 0.5 }} />

                                                                            {/* ✅ botões no rodapé à direita */}
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

                                                                                <Button size="small" color="error" variant="outlined" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => handleDeleteBill(b)}>
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
                                            );
                                        })}
                                    </Box>
                                );
                            })}
                        </Stack>
                    </>
                )}

                {/* dialogs */}
                <BillsFormDialog open={openNew} onClose={() => setOpenNew(false)} initial={null} payeeOptions={payeeOptions} />
                <BillsFormDialog open={!!editBill} onClose={() => setEditBill(null)} initial={editBill} payeeOptions={payeeOptions} />
                <GenerateDialog open={!!genBill} onClose={() => setGenBill(null)} bill={genBill} />
                <PayBillDialog open={!!payBill} onClose={() => setPayBill(null)} bill={payBill} />
            </Stack>
        </Box>
    );
}