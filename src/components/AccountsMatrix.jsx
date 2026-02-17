// src/components/AccountsMatrix.jsx
import React, { useEffect, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import { Box, Card, CardContent, Divider, Stack, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";

import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";

import { formatBRL } from "../utils/money";
import { selectTransactionsUi } from "../store/transactionsSlice";
import { selectBills } from "../store/billsSlice";

// -----------------------------
// Month helpers (pt-BR)
// -----------------------------
const MONTHS = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
];

function ymKey(year, monthIndex0) {
    const m = String(monthIndex0 + 1).padStart(2, "0");
    return `${year}-${m}`;
}

function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function normalizeStatus(s) {
    const v = String(s || "").toLowerCase().trim();
    if (v === "confirmado" || v === "confirmed") return "confirmed";
    if (v === "previsto" || v === "planned") return "planned";
    if (v === "pago" || v === "paid") return "paid";
    if (v === "faturado" || v === "invoiced") return "invoiced";
    if (v === "atrasado" || v === "overdue") return "overdue";
    return v || "";
}

function normalizeISODate(d) {
    if (!d) return "";
    if (d instanceof Date && !isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${dd}`;
    }
    const s = String(d);
    if (s.includes("T")) return s.slice(0, 10);
    if (s.includes("/")) {
        const [dd, mm, yy] = s.split("/");
        if (yy && mm && dd) return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
    return s.slice(0, 10);
}

function addMonthsYM(ym, add = 1) {
    const [yy, mm] = String(ym || "").split("-").map(Number);
    if (!Number.isFinite(yy) || !Number.isFinite(mm)) return "";
    const base = yy * 12 + (mm - 1) + Number(add || 0);
    const y2 = Math.floor(base / 12);
    const m2 = (base % 12) + 1;
    return `${y2}-${String(m2).padStart(2, "0")}`;
}

function ymCompare(a, b) {
    return String(a || "").localeCompare(String(b || ""));
}

function centsFromTxn(t) {
    if (t?.amount_cents != null) return Math.abs(Number(t.amount_cents) || 0);
    if (t?.amountCents != null) return Math.abs(Number(t.amountCents) || 0);

    const raw = t?.amount ?? t?.value ?? 0;
    const n = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(n)) return 0;
    return Math.round(Math.abs(n) * 100);
}

function hasInvoiceLink(t) {
    return !!(t?.invoice || t?.invoiceId || t?.invoice_id);
}

function getCutoffDayFromAccount(acc) {
    const v =
        acc?.statement?.cutoffDay ??
        acc?.statement?.cutoff_day ??
        acc?.cutoffDay ??
        acc?.cutoff_day ??
        acc?.statementDay ??
        acc?.statement_day;

    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeDirectionFromTxn(t) {
    const d = String(t?.direction || "").toLowerCase();
    if (d === "income" || d === "receita" || d === "entrada") return "income";
    if (d === "expense" || d === "despesa" || d === "saida" || d === "saída") return "expense";
    return "expense";
}

function signedAmountNormalized(t) {
    const v = Number(t?.amount ?? t?.value ?? 0);
    const abs = Math.abs(v);
    if (v < 0) return v;
    return normalizeDirectionFromTxn(t) === "income" ? abs : -abs;
}

function resolvedDirection(t) {
    const d = String(t?.direction || "").toLowerCase();
    if (d === "income" || d === "expense") return d;
    return signedAmountNormalized(t) < 0 ? "expense" : "income";
}

function isLikelyInvoicePayment(t) {
    const k = String(t?.kind || "").toLowerCase();
    if (k.includes("bill_payment") || k.includes("invoice_payment") || k === "payment") return true;

    const desc = String(t?.description || t?.memo || t?.title || "").toLowerCase();
    if (desc.includes("pagamento de fatura") || desc.includes("pgto fatura") || desc.includes("fatura paga")) return true;

    return false;
}

// cutoff rule: day<=cutoff => same ym, else next ym
function billingYMForCardPurchase(purchaseISO, cutoffDay) {
    const iso = normalizeISODate(purchaseISO);
    if (!iso) return "";
    const ym = iso.slice(0, 7);
    const day = Number(iso.slice(8, 10));
    if (!Number.isFinite(day)) return "";

    const cd = Number(cutoffDay);
    if (!Number.isFinite(cd) || cd <= 0) return "";

    return day <= cd ? ym : addMonthsYM(ym, 1);
}

function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
    return Math.abs(h);
}

function pickFallbackColor(theme, key) {
    const palette = [
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.info.main,
        theme.palette.success.main,
        theme.palette.warning.main,
        theme.palette.error.main,
    ];
    return palette[hashCode(String(key)) % palette.length];
}

// -----------------------------
// Bills helpers (consolidar)
// -----------------------------
function moneyToNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function billIsInvoice(b) {
    const kind = String(b?.kind || b?.type || b?.bill_type || "").toLowerCase();
    if (b?.isInvoice === true || b?.is_invoice === true) return true;
    if (kind.includes("invoice") || kind.includes("fatura")) return true;

    const name = String(b?.name || b?.title || b?.label || "").toLowerCase();
    if (name.includes("fatura") || name.includes("invoice")) return true;

    return false;
}

function normalizeTextKey(s) {
    return String(s || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^\p{L}\p{N}\s./-]+/gu, "");
}

// remove marcações tipo "1/12", "(01/12)", "parcela 3 de 12", "#3", " - 03/12"
function normalizeBillNameForGroup(name) {
    let s = normalizeTextKey(name);

    s = s.replace(/\(\s*\d+\s*\/\s*\d+\s*\)/g, " ");
    s = s.replace(/\b\d+\s*\/\s*\d+\b/g, " ");
    s = s.replace(/\bparcela\s*\d+\s*(de|\/)\s*\d+\b/g, " ");
    s = s.replace(/\binstallment\s*\d+\s*(of|\/)\s*\d+\b/g, " ");
    s = s.replace(/\b#\s*\d+\b/g, " ");
    s = s.replace(/\s+-\s+\d+\s*\/\s*\d+\b/g, " ");
    s = s.replace(/\s+/g, " ").trim();

    return s;
}

function billGroupKey(b) {
    // ✅ prioridade: série real (parcelas)
    const gid = String(b?.installmentGroupId || b?.installment_group_id || "").trim();
    if (gid) return `series:${gid}`;

    // ✅ fallback: fingerprint estável (sem o "1/12" etc)
    const name = normalizeBillNameForGroup(b?.name);
    const payee = normalizeTextKey(b?.payee);
    const cat = String(b?.categoryId || b?.category_id || "outros").trim();
    const kind = String(b?.kind || "").trim().toLowerCase();
    const amt = Number(b?.defaultAmount || 0).toFixed(2);
    const day = String(b?.dayOfMonth ?? b?.day_of_month ?? "");

    return `fp:${name}|${payee}|${cat}|${kind}|${amt}|${day}`;
}

function billLabelForRow(b) {
    // pra UI, tenta manter o nome “limpo” (sem 1/12), mas sem perder sentido
    const raw = String(b?.name || "Bill").trim() || "Bill";
    const cleaned = normalizeBillNameForGroup(raw);
    return cleaned || raw;
}

// -----------------------------
// Main component
// -----------------------------
export default function AccountsMatrix() {
    const theme = useTheme();
    const scrollRef = useRef(null);

    // ✅ Redux
    const txns = useSelector(selectTransactionsUi) || [];
    const accounts = useSelector((s) => s.accounts.accounts) || [];
    const bills = useSelector(selectBills) || [];

    // focus sempre no mês/ano atual
    const now = new Date();
    const focusYear = now.getFullYear();
    const focusMonthIndex0 = now.getMonth();

    // Layout tokens
    const COL_MONTH_W = 112;
    const COL_YEAR_TOTAL_W = 130;
    const COL_TOTAL_W = 140;

    const COL_LABEL_MIN = 160;
    const COL_LABEL_MAX_VW = "10vw";

    const ROW_H = 36;
    const ROW_H_SECTION = Math.round(ROW_H * 0.82);

    // cor estrutural (mais forte)
    const strongLine = theme.palette.primary.main;
    const strongBg = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.30 : 0.20);
    const strongBgSoft = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.24 : 0.16);

    const borderC = alpha(theme.palette.divider, 0.9);
    const bgSticky = alpha(theme.palette.background.paper, 0.98);

    const focusBorder = `2px solid ${alpha(theme.palette.primary.main, 0.95)}`;
    const focusBg = alpha(theme.palette.primary.main, 0.07);

    // -----------------------------
    // 🔥 CARTÕES (mesma regra do Dashboard)
    // -----------------------------
    const cardsData = useMemo(() => {
        const creditCards = (accounts || []).filter((a) => a?.active && a?.type === "credit_card");

        const accountsById = new Map();
        for (const a of accounts || []) accountsById.set(a.id, a);

        const norm = (s) =>
            String(s || "")
                .toLowerCase()
                .replace(/\s+/g, "")
                .replace(/[\W_]+/g, "");

        const byName = new Map();
        for (const a of creditCards) byName.set(norm(a.name), a.id);

        const resolveAccountIdFromTxn = (t) => {
            if (t?.accountId && accountsById.get(t.accountId)) return t.accountId;

            const cid = norm(t?.cardId);
            if (!cid) return null;

            if (byName.has(cid)) return byName.get(cid);

            for (const [k, id] of byName.entries()) {
                if (k.includes(cid) || cid.includes(k)) return id;
            }
            return null;
        };

        const isCardTxn = (t) => {
            const rid = resolveAccountIdFromTxn(t);
            if (!rid) return false;
            const acc = accountsById.get(rid);
            return acc?.type === "credit_card";
        };

        const normDesc = (t) =>
            String(t?.merchant || t?.description || t?.title || "")
                .trim()
                .toLowerCase()
                .replace(/\s+/g, " ")
                .slice(0, 32);

        const centsKey = (n) => Math.round(Math.abs(Number(n || 0)) * 100);

        const keyFor = (t) => {
            const accId = resolveAccountIdFromTxn(t) || "";
            const pd = normalizeISODate(t?.purchaseDate ?? t?.purchase_date) || "";
            const amt = centsKey(signedAmountNormalized(t));
            const desc = normDesc(t);
            const cat = String(t?.categoryId ?? t?.category_id ?? t?.category ?? "");
            return `${accId}|${pd}|${amt}|${cat}|${desc}`;
        };

        const best = new Map();
        const rank = (s) => {
            const st = normalizeStatus(s);
            if (st === "paid") return 3;
            if (st === "invoiced") return 2;
            if (st === "confirmed") return 1;
            return 0;
        };

        for (const t of txns || []) {
            if (isLikelyInvoicePayment(t)) continue;
            if (!isCardTxn(t)) continue;
            if (resolvedDirection(t) !== "expense") continue;

            const k = keyFor(t);
            const prev = best.get(k);
            if (!prev) {
                best.set(k, t);
                continue;
            }

            if (rank(t?.status) > rank(prev?.status)) best.set(k, t);
            else {
                const prevHasId = !!(prev?.id || prev?.uuid);
                const curHasId = !!(t?.id || t?.uuid);
                if (!prevHasId && curHasId) best.set(k, t);
            }
        }

        const txnsDeduped = Array.from(best.values());

        const yms = new Set();
        for (const t of txnsDeduped) {
            const rid = resolveAccountIdFromTxn(t);
            const acc = rid ? accountsById.get(rid) : null;
            const cutoff = getCutoffDayFromAccount(acc) || 1;
            const pd = normalizeISODate(t?.purchaseDate ?? t?.purchase_date);
            if (!pd) continue;
            const billYM = billingYMForCardPurchase(pd, cutoff);
            if (billYM) yms.add(billYM);
        }

        for (let mi = 0; mi < 12; mi++) yms.add(ymKey(focusYear, mi));

        const ymSorted = Array.from(yms).sort();
        const minYM = ymSorted[0] || ymKey(focusYear, 0);
        const maxYM = ymSorted[ymSorted.length - 1] || ymKey(focusYear, 11);

        const [minY] = minYM.split("-").map(Number);
        const [maxY] = maxYM.split("-").map(Number);

        const years = [];
        for (let y = minY; y <= maxY; y++) years.push(y);

        const months = years.flatMap((y) => MONTHS.map((_, i) => ({ year: y, monthIndex0: i })));

        const bucketsByCardYM = new Map(); // cardId|YYYY-MM => {confirmedOpen, invoiced, paid}

        const ensure = (cardId, ym) => {
            const k = `${cardId}|${ym}`;
            let v = bucketsByCardYM.get(k);
            if (!v) {
                v = { confirmedOpen: 0, invoiced: 0, paid: 0 };
                bucketsByCardYM.set(k, v);
            }
            return v;
        };

        for (const t of txnsDeduped) {
            const rid = resolveAccountIdFromTxn(t);
            if (!rid) continue;

            const acc = accountsById.get(rid);
            if (!acc || acc.type !== "credit_card") continue;

            const st = normalizeStatus(t?.status);
            if (st !== "confirmed" && st !== "invoiced" && st !== "paid") continue;

            const pd = normalizeISODate(t?.purchaseDate ?? t?.purchase_date);
            if (!pd) continue;

            const cutoff = getCutoffDayFromAccount(acc) || 1;
            const billYM = billingYMForCardPurchase(pd, cutoff);
            if (!billYM) continue;

            const cts = centsFromTxn(t);
            const b = ensure(String(rid), billYM);

            if (st === "confirmed") {
                if (hasInvoiceLink(t)) continue;
                b.confirmedOpen += cts;
            } else if (st === "paid") b.paid += cts;
            else if (st === "invoiced") b.invoiced += cts;
        }

        const cardRows = creditCards.map((c) => {
            const cardId = String(c.id);
            const values = {};

            for (const m of months) {
                const ym = ymKey(m.year, m.monthIndex0);
                const b = bucketsByCardYM.get(`${cardId}|${ym}`) || { confirmedOpen: 0, invoiced: 0, paid: 0 };

                const billed = Math.max(Number(b.invoiced || 0), Number(b.paid || 0));
                const displayCents = billed > 0 ? billed : Number(b.confirmedOpen || 0);

                values[ym] = Number((displayCents / 100).toFixed(2));
            }

            return {
                id: cardId,
                label: c.name,
                color: String(c.color || "").trim() || pickFallbackColor(theme, cardId),
                values,
            };
        });

        const cardsTotalValues = {};
        for (const m of months) {
            const ym = ymKey(m.year, m.monthIndex0);
            let sum = 0;
            for (const r of cardRows) sum += safeNum(r.values[ym]);
            cardsTotalValues[ym] = Number(sum.toFixed(2));
        }

        return { months, years, cardRows, cardsTotalValues };
    }, [accounts, txns, theme, focusYear]);

    // -----------------------------
    // ✅ BILLS (consolidado por "grupo", não por id)
    // - Se você tem “Seguro 1/12, 2/12...” vira UMA linha (“Seguro”) e soma por mês.
    // - Se tem installmentGroupId, usa isso como chave estável.
    // - Se não tem, faz fingerprint limpando o nome.
    // -----------------------------
    const billsData = useMemo(() => {
        const list = (bills || [])
            .filter((b) => b?.active !== false)
            .filter((b) => !billIsInvoice(b));

        const months = (cardsData.months || []).map((m) => ymKey(m.year, m.monthIndex0));
        const monthsSet = new Set(months);

        const now = new Date();
        const fallbackStart = `${now.getFullYear()}-01`;
        const fallbackEnd = `${now.getFullYear()}-12`;

        const monthMin = months[0] || fallbackStart;
        const monthMax = months[months.length - 1] || fallbackEnd;

        const byGroup = new Map();

        for (const b of list) {
            const key = billGroupKey(b);

            const amount = moneyToNumber(b?.defaultAmount);
            if (!amount) continue;

            // start/end (vêm do mapBillFromApi: startMonth/endMonth já são "YYYY-MM")
            const start = String(b?.startMonth || monthMin).slice(0, 7);
            const endRaw = String(b?.endMonth || "").slice(0, 7);

            // se não tiver endMonth: limita ao range da matriz
            const end = endRaw ? endRaw : monthMax;

            // garante linha do grupo
            const row =
                byGroup.get(key) || {
                    id: key,
                    label: billLabelForRow(b),
                    values: {}, // ym -> number
                };

            // label mais “bonito”
            const labelNow = billLabelForRow(b);
            if (labelNow && labelNow.length > String(row.label || "").length) row.label = labelNow;

            // preenche meses dentro do range, mas SOMENTE se forem meses da matriz
            let cur = start;
            let guard = 0;

            while (cur && ymCompare(cur, end) <= 0) {
                if (monthsSet.has(cur)) {
                    row.values[cur] = Number((safeNum(row.values[cur]) + amount).toFixed(2));
                }

                cur = addMonthsYM(cur, 1);
                guard += 1;
                if (guard > 240) break;
            }

            byGroup.set(key, row);
        }

        const rows = Array.from(byGroup.values()).sort((a, b) => a.label.localeCompare(b.label));

        const totalByMonth = {};
        for (const ym of months) totalByMonth[ym] = 0;

        for (const r of rows) {
            for (const [ym, v] of Object.entries(r.values || {})) {
                totalByMonth[ym] = safeNum(totalByMonth[ym]) + safeNum(v);
            }
        }

        for (const k of Object.keys(totalByMonth)) totalByMonth[k] = Number(totalByMonth[k].toFixed(2));

        return { rows, totalByMonth };
    }, [bills, cardsData.months]);

    // -----------------------------
    // data
    // -----------------------------
    const data = useMemo(() => {
        const months = cardsData.months || [];
        const emptyValues = {};
        for (const m of months) emptyValues[ymKey(m.year, m.monthIndex0)] = 0;

        return {
            months,
            sections: [
                {
                    id: "income",
                    kind: "section",
                    label: "Receitas",
                    icon: <PaymentsRoundedIcon fontSize="small" />,
                    headerRow: {
                        id: "income_total",
                        label: "Receitas (TOTAL)",
                        values: emptyValues,
                        tone: "income",
                    },
                    rows: [],
                },
                {
                    id: "cards",
                    kind: "section",
                    label: "Cartões",
                    icon: <CreditCardRoundedIcon fontSize="small" />,
                    headerRow: {
                        id: "cards_total",
                        label: "Cartões (TOTAL)",
                        values: cardsData.cardsTotalValues || emptyValues,
                        tone: "cards",
                    },
                    rows: (cardsData.cardRows || []).map((c) => ({
                        id: `card_${c.id}`,
                        label: c.label,
                        values: c.values,
                        tone: "cardItem",
                    })),
                },
                {
                    id: "bills",
                    kind: "section",
                    label: "Bills",
                    icon: <ReceiptLongRoundedIcon fontSize="small" />,
                    headerRow: {
                        id: "bills_total",
                        label: "Bills (TOTAL)",
                        values: billsData.totalByMonth || emptyValues,
                        tone: "bills",
                    },
                    rows: (billsData.rows || []).map((b) => ({
                        id: `bill_${b.id}`,
                        label: b.label,
                        values: b.values,
                        tone: "billItem",
                    })),
                },
            ],
        };
    }, [cardsData, billsData]);

    const months = data.months;

    const years = useMemo(() => {
        const set = new Set((months || []).map((m) => m.year));
        return Array.from(set).sort((a, b) => a - b);
    }, [months]);

    const columns = useMemo(() => {
        const cols = [];
        for (const y of years) {
            for (let mi = 0; mi < 12; mi++) cols.push({ kind: "month", year: y, monthIndex0: mi });
            cols.push({ kind: "yearTotal", year: y });
        }
        cols.push({ kind: "allTotal" });
        return cols;
    }, [years]);

    const focusColIndex = useMemo(() => {
        return columns.findIndex(
            (c) => c.kind === "month" && c.year === focusYear && c.monthIndex0 === focusMonthIndex0
        );
    }, [columns, focusYear, focusMonthIndex0]);

    useEffect(() => {
        if (!scrollRef.current) return;
        if (focusColIndex < 0) return;
        const x = focusColIndex * COL_MONTH_W;
        scrollRef.current.scrollLeft = Math.max(0, x - COL_MONTH_W * 1.5);
    }, [focusColIndex]);

    const sumYear = (values, year) => {
        let total = 0;
        for (let mi = 0; mi < 12; mi++) total += safeNum(values[ymKey(year, mi)]);
        return total;
    };

    const sumAll = (values) => {
        let total = 0;
        for (const y of years) total += sumYear(values, y);
        return total;
    };

    const grandTotalByMonth = useMemo(() => {
        const out = {};
        const incomeValues = data.sections.find((s) => s.id === "income")?.headerRow?.values || {};
        const cardsValues = data.sections.find((s) => s.id === "cards")?.headerRow?.values || {};
        const billsValues = data.sections.find((s) => s.id === "bills")?.headerRow?.values || {};

        for (const m of months) {
            const key = ymKey(m.year, m.monthIndex0);
            const entradas = safeNum(incomeValues[key]);
            const saidas = safeNum(cardsValues[key]) + safeNum(billsValues[key]);
            out[key] = entradas - saidas;
        }
        return out;
    }, [data.sections, months]);

    const cellBase = {
        height: ROW_H,
        display: "flex",
        alignItems: "center",
        borderBottom: `1px solid ${borderC}`,
        borderRight: `1px solid ${borderC}`,
        px: 1,
        fontSize: 13,
        whiteSpace: "nowrap",
    };

    const formatMoneySigned = (value) => {
        const v = safeNum(value);
        if (!v) return "-";
        const abs = Math.abs(v);
        const str = formatBRL(abs);
        return v < 0 ? `- ${str}` : str;
    };

    const colWidth = (c) => {
        if (c.kind === "yearTotal") return COL_YEAR_TOTAL_W;
        if (c.kind === "allTotal") return COL_TOTAL_W;
        return COL_MONTH_W;
    };

    const colLabel = (c) => {
        if (c.kind === "yearTotal") return "total ano";
        if (c.kind === "allTotal") return "total";
        return MONTHS[c.monthIndex0];
    };

    const colValue = (values, c) => {
        if (c.kind === "month") return values[ymKey(c.year, c.monthIndex0)];
        if (c.kind === "yearTotal") return sumYear(values, c.year);
        if (c.kind === "allTotal") return sumAll(values);
        return 0;
    };

    const getToneBg = (tone) => {
        if (tone === "income") return alpha(theme.palette.success.light, 0.12);
        if (tone === "cards") return alpha(theme.palette.info.light, 0.12);
        if (tone === "bills") return alpha(theme.palette.warning.light, 0.12);
        return "transparent";
    };

    const renderRow = ({ label, values, tone, isHeaderRow, allowNegative }) => {
        const toneBg = getToneBg(tone);

        return (
            <Box
                key={label}
                sx={{
                    display: "flex",
                    minWidth: "max-content",
                    background: isHeaderRow ? toneBg : "transparent",
                }}
            >
                <Box
                    sx={{
                        ...cellBase,
                        minWidth: COL_LABEL_MIN,
                        width: `minmax(${COL_LABEL_MIN}px, ${COL_LABEL_MAX_VW})`,
                        maxWidth: COL_LABEL_MAX_VW,
                        position: "sticky",
                        left: 0,
                        zIndex: 3,
                        background: bgSticky,
                        fontWeight: isHeaderRow ? 800 : 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    {label}
                </Box>

                {columns.map((c, idx) => {
                    const isFocusMonth = c.kind === "month" && idx === focusColIndex;
                    const isYearTotal = c.kind === "yearTotal";
                    const isAllTotal = c.kind === "allTotal";

                    const w = colWidth(c);
                    const v = safeNum(colValue(values, c));
                    const isNeg = allowNegative && v < 0;

                    return (
                        <Box
                            key={`${label}_${c.kind}_${c.year ?? ""}_${c.monthIndex0 ?? ""}`}
                            sx={{
                                ...cellBase,
                                width: w,
                                minWidth: w,
                                justifyContent: "flex-end",
                                fontWeight: isHeaderRow || isYearTotal || isAllTotal ? 800 : 500,
                                color: isNeg ? theme.palette.error.main : theme.palette.text.primary,

                                ...(isFocusMonth
                                    ? {
                                        background: focusBg,
                                        borderLeft: focusBorder,
                                        borderRight: focusBorder,
                                    }
                                    : null),

                                ...(isYearTotal || isAllTotal ? { background: alpha(theme.palette.action.hover, 0.35) } : null),
                            }}
                        >
                            {allowNegative ? formatMoneySigned(v) : v ? formatBRL(Math.abs(v)) : "-"}
                        </Box>
                    );
                })}
            </Box>
        );
    };

    const totalMatrixWidth = "max-content";

    return (
        <Card variant="outlined" sx={{ overflow: "hidden" }}>
            <CardContent sx={{ pb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Stack spacing={0.2}>
                        <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                            Contas (matriz)
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                            cartões (cutoff) + bills consolidadas por série/fingerprint
                        </Typography>
                    </Stack>
                </Stack>

                <Divider sx={{ mb: 1.2 }} />

                <Box
                    ref={scrollRef}
                    sx={{
                        overflowX: "auto",
                        overflowY: "hidden",
                        border: `1px solid ${borderC}`,
                        borderRadius: 0.75,
                    }}
                >
                    <Box sx={{ minWidth: totalMatrixWidth }}>
                        {/* Header row 1: Years */}
                        <Box sx={{ display: "flex", position: "sticky", top: 0, zIndex: 5, background: bgSticky }}>
                            <Box
                                sx={{
                                    ...cellBase,
                                    minWidth: COL_LABEL_MIN,
                                    maxWidth: COL_LABEL_MAX_VW,
                                    position: "sticky",
                                    left: 0,
                                    zIndex: 6,
                                    background: bgSticky,
                                    fontWeight: 900,
                                }}
                            >
                                Referência
                            </Box>

                            {years.map((y) => {
                                const spanW = 12 * COL_MONTH_W + COL_YEAR_TOTAL_W;
                                return (
                                    <Box
                                        key={`year_${y}`}
                                        sx={{
                                            ...cellBase,
                                            width: spanW,
                                            minWidth: spanW,
                                            justifyContent: "center",
                                            fontWeight: 900,
                                            background: strongBg,
                                            borderBottom: `3px solid ${strongLine}`,
                                            borderRight: `2px solid ${strongLine}`,
                                        }}
                                    >
                                        {y}
                                    </Box>
                                );
                            })}

                            <Box
                                sx={{
                                    ...cellBase,
                                    width: COL_TOTAL_W,
                                    minWidth: COL_TOTAL_W,
                                    justifyContent: "center",
                                    fontWeight: 900,
                                    background: strongBg,
                                    borderBottom: `3px solid ${strongLine}`,
                                    borderRight: `2px solid ${strongLine}`,
                                }}
                            >
                                TOTAL
                            </Box>
                        </Box>

                        {/* Header row 2: Months + Totals */}
                        <Box sx={{ display: "flex", position: "sticky", top: ROW_H, zIndex: 4, background: bgSticky }}>
                            <Box
                                sx={{
                                    ...cellBase,
                                    minWidth: COL_LABEL_MIN,
                                    maxWidth: COL_LABEL_MAX_VW,
                                    position: "sticky",
                                    left: 0,
                                    zIndex: 6,
                                    background: bgSticky,
                                    fontWeight: 800,
                                }}
                            />

                            {columns.map((c, idx) => {
                                const isFocus = c.kind === "month" && idx === focusColIndex;
                                const w = colWidth(c);

                                return (
                                    <Box
                                        key={`col_${c.kind}_${c.year ?? ""}_${c.monthIndex0 ?? ""}`}
                                        sx={{
                                            ...cellBase,
                                            width: w,
                                            minWidth: w,
                                            justifyContent: "center",
                                            fontWeight: 900,
                                            textTransform: "lowercase",
                                            background: c.kind === "yearTotal" || c.kind === "allTotal" ? strongBg : strongBgSoft,
                                            borderBottom: `2px solid ${strongLine}`,
                                            ...(isFocus
                                                ? {
                                                    background: alpha(theme.palette.primary.main, 0.14),
                                                    borderLeft: focusBorder,
                                                    borderRight: focusBorder,
                                                }
                                                : null),
                                        }}
                                    >
                                        {colLabel(c)}
                                    </Box>
                                );
                            })}
                        </Box>

                        {/* Sections */}
                        {data.sections.map((sec) => (
                            <Box key={sec.id}>
                                {/* Section divider row */}
                                <Box sx={{ display: "flex", background: strongBg }}>
                                    <Box
                                        sx={{
                                            ...cellBase,
                                            height: ROW_H_SECTION,
                                            minWidth: COL_LABEL_MIN,
                                            maxWidth: COL_LABEL_MAX_VW,
                                            position: "sticky",
                                            left: 0,
                                            zIndex: 3,
                                            background: bgSticky,
                                            fontWeight: 900,
                                            borderBottom: `3px solid ${strongLine}`,
                                        }}
                                    >
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ opacity: 0.95 }}>
                                            {sec.icon}
                                            <span style={{ fontSize: 12 }}>{sec.label}</span>
                                        </Stack>
                                    </Box>

                                    <Box sx={{ height: ROW_H_SECTION, width: "100%", borderBottom: `3px solid ${strongLine}` }} />
                                </Box>

                                {renderRow({
                                    label: sec.headerRow.label,
                                    values: sec.headerRow.values,
                                    tone: sec.headerRow.tone,
                                    isHeaderRow: true,
                                    allowNegative: false,
                                })}

                                {sec.rows.map((r) =>
                                    renderRow({
                                        label: r.label,
                                        values: r.values,
                                        tone: r.tone,
                                        isHeaderRow: false,
                                        allowNegative: false,
                                    })
                                )}
                            </Box>
                        ))}

                        {/* RESULTADO */}
                        <Box sx={{ mt: 0.3 }}>
                            {renderRow({
                                label: "RESULTADO",
                                values: grandTotalByMonth,
                                tone: "totals",
                                isHeaderRow: true,
                                allowNegative: true,
                            })}
                        </Box>
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
