// src/components/AccountsMatrix.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import {
    Box,
    Card,
    CardContent,
    Divider,
    Stack,
    Typography,
    useTheme,
    IconButton,
    Collapse,
    Button,
    Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import UnfoldMoreRoundedIcon from "@mui/icons-material/UnfoldMoreRounded";
import UnfoldLessRoundedIcon from "@mui/icons-material/UnfoldLessRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

import { formatBRL } from "../utils/money";
import { selectTransactionsUi } from "../store/transactionsSlice";
import { selectBills } from "../store/billsSlice";
import { selectHideValues } from "../store/uiSlice";






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

function clamp01(x) {
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
}

function parseColorToRgb(color) {
    const s = String(color || "").trim();

    // #RGB / #RRGGBB
    if (s.startsWith("#")) {
        const hex = s.slice(1);
        if (hex.length === 3) {
            const r = parseInt(hex[0] + hex[0], 16);
            const g = parseInt(hex[1] + hex[1], 16);
            const b = parseInt(hex[2] + hex[2], 16);
            return { r, g, b };
        }
        if (hex.length === 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return { r, g, b };
        }
    }

    // rgb(...) / rgba(...)
    const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (m) {
        return { r: Number(m[1]) || 0, g: Number(m[2]) || 0, b: Number(m[3]) || 0 };
    }

    // fallback: preto
    return { r: 0, g: 0, b: 0 };
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpRgb(c1, c2, t) {
    const a = parseColorToRgb(c1);
    const b = parseColorToRgb(c2);
    const tt = clamp01(t);
    const r = Math.round(lerp(a.r, b.r, tt));
    const g = Math.round(lerp(a.g, b.g, tt));
    const b2 = Math.round(lerp(a.b, b.b, tt));
    return `rgb(${r},${g},${b2})`;
}

// 3 cores: verde (baixo) -> amarelo (meio) -> vermelho (alto)
function heatColor3(theme, t01) {
    const t = clamp01(t01);

    const green = theme.palette.success.main;
    const yellow = theme.palette.warning.main;
    const red = theme.palette.error.main;

    if (t <= 0.5) {
        return lerpRgb(green, yellow, t / 0.5);
    }
    return lerpRgb(yellow, red, (t - 0.5) / 0.5);
}

function computeHeatMeta(values, last12MonthKeys) {
    let min = null;
    let max = null;

    for (const k of last12MonthKeys || []) {
        const v = Number(values?.[k]);
        if (!Number.isFinite(v)) continue;
        if (min === null || v < min) min = v;
        if (max === null || v > max) max = v;
    }

    // se não tem range (tudo igual / vazio), não aplica heat
    if (min === null || max === null) return null;
    if (min === max) return null;

    return { min, max };
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

function resolveBillPayeeRaw(b) {
    return (
        b?.payee ??
        b?.payeeName ??
        b?.favorecido ??
        b?.merchant ??
        b?.merchantName ??
        b?.counterparty ??
        b?.counterpartyName ??
        b?.vendor ??
        ""
    );
}

function normalizePayeeForGroup(b) {
    const raw = String(resolveBillPayeeRaw(b) || "").trim();
    return normalizeTextKey(raw);
}

function billLabelForRow(b) {
    const payeeRaw = String(resolveBillPayeeRaw(b) || "").trim();
    if (payeeRaw) return payeeRaw;

    const raw = String(b?.name || "Bill").trim() || "Bill";
    const cleaned = normalizeBillNameForGroup(raw);
    return cleaned || raw;
}

// -----------------------------
// localStorage keys (UI prefs)
// -----------------------------
const LS_BILLS_OPEN = "ym_openBillsCats_v1"; // map catId -> boolean (true=open)
const LS_BILLS_MODE = "ym_openBillsMode_v1"; // "open" | "closed"

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
    const hideValues = useSelector(selectHideValues);


    // ✅ UI: expand/collapse de categorias (bills) + persistência
    const [openBillCats, setOpenBillCats] = useState(() => {
        try {
            const raw = localStorage.getItem(LS_BILLS_OPEN);
            const obj = raw ? JSON.parse(raw) : {};
            return obj && typeof obj === "object" ? obj : {};
        } catch {
            return {};
        }
    });

    const [billsMode, setBillsMode] = useState(() => {
        try {
            const raw = localStorage.getItem(LS_BILLS_MODE);
            return raw === "open" || raw === "closed" ? raw : "open";
        } catch {
            return "open";
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(LS_BILLS_OPEN, JSON.stringify(openBillCats || {}));
        } catch { }
    }, [openBillCats]);

    useEffect(() => {
        try {
            localStorage.setItem(LS_BILLS_MODE, billsMode);
        } catch { }
    }, [billsMode]);

    const toggleBillCat = useCallback((catId) => {
        const k = String(catId || "outros");
        setOpenBillCats((prev) => ({ ...(prev || {}), [k]: !prev?.[k] }));
    }, []);

    // ✅ Soma por clique: seleção de células
    // - guarda valores (numéricos) escolhidos
    // - destaca célula selecionada
    const [selectedCells, setSelectedCells] = useState(() => new Map()); // key -> { value, label }
    const selectedSum = useMemo(() => {
        let s = 0;
        for (const it of selectedCells.values()) s += safeNum(it?.value);
        return Number(s.toFixed(2));
    }, [selectedCells]);

    const clearSelection = useCallback(() => {
        setSelectedCells(new Map());
    }, []);

    const toggleSelectCell = useCallback((cellKey, value, labelForHover) => {
        setSelectedCells((prev) => {
            const next = new Map(prev);
            if (next.has(cellKey)) next.delete(cellKey);
            else next.set(cellKey, { value: safeNum(value), label: labelForHover || "" });
            return next;
        });
    }, []);

    const isSelectedCell = useCallback((cellKey) => selectedCells.has(cellKey), [selectedCells]);

    // focus sempre no mês/ano atual
    const now = new Date();
    const focusYear = now.getFullYear();
    const focusMonthIndex0 = now.getMonth();

    // Layout tokens
    const COL_MONTH_W = 112;
    const COL_YEAR_TOTAL_W = 130;
    const COL_TOTAL_W = 140;

    const COL_LABEL_MIN = 150; // 👈 um pouco maior, mas com ellipsis não estoura
    const COL_LABEL_MAX = 120; // 👈 limite real para não “quebrar” o quadro

    const ROW_H = 36;
    const ROW_H_SECTION = Math.round(ROW_H * 0.82);

    // cor estrutural (mais forte)
    const strongLine = theme.palette.primary.main;
    const strongBg = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.3 : 0.2);
    const strongBgSoft = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.24 : 0.16);

    const borderC = alpha(theme.palette.divider, 0.9);
    const bgSticky = alpha(theme.palette.background.paper, 0.98);

    const focusBorder = `2px solid ${alpha(theme.palette.primary.main, 0.95)}`;
    const focusBg = alpha(theme.palette.primary.main, 0.07);

    const selectedBg = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.25 : 0.16);
    const selectedBorder = `1px solid ${alpha(theme.palette.primary.main, 0.7)}`;

    // -----------------------------
    // ✅ Resolver de conta (reutilizável)
    // -----------------------------
    const accountResolver = useMemo(() => {
        const accountsById = new Map();
        for (const a of accounts || []) accountsById.set(String(a.id), a);

        const norm = (s) =>
            String(s || "")
                .toLowerCase()
                .replace(/\s+/g, "")
                .replace(/[\W_]+/g, "");

        const byNameAny = new Map();
        for (const a of accounts || []) {
            if (!a?.id) continue;
            byNameAny.set(norm(a.name), String(a.id));
        }

        const resolveAccountIdFromTxn = (t) => {
            const direct =
                t?.accountId ??
                t?.account_id ??
                t?.account?.id ??
                (typeof t?.account === "string" || typeof t?.account === "number" ? t.account : null);

            if (direct != null && accountsById.get(String(direct))) return String(direct);

            const cid = norm(t?.cardId);
            if (cid && byNameAny.has(cid)) return byNameAny.get(cid);

            if (cid) {
                for (const [k, id] of byNameAny.entries()) {
                    if (k.includes(cid) || cid.includes(k)) return id;
                }
            }

            return direct != null ? String(direct) : null;
        };

        return { accountsById, resolveAccountIdFromTxn };
    }, [accounts]);

    // -----------------------------
    // 🔥 CARTÕES
    // -----------------------------
    const cardsData = useMemo(() => {
        const creditCards = (accounts || []).filter((a) => a?.active && a?.type === "credit_card");
        const accountsById = accountResolver.accountsById;
        const resolveAccountIdFromTxn = accountResolver.resolveAccountIdFromTxn;

        const isCardTxn = (t) => {
            const rid = resolveAccountIdFromTxn(t);
            if (!rid) return false;
            const acc = accountsById.get(String(rid));
            return acc?.type === "credit_card";
        };

        const seenId = new Set();
        const txnsDeduped = [];

        for (const t of txns || []) {
            if (!t) continue;
            if (isLikelyInvoicePayment(t)) continue;
            if (!isCardTxn(t)) continue;
            if (resolvedDirection(t) !== "expense") continue;

            const id = String(t?.id || "");
            if (!id) {
                txnsDeduped.push(t);
                continue;
            }
            if (seenId.has(id)) continue;
            seenId.add(id);
            txnsDeduped.push(t);
        }

        const bucketsByCardYM = new Map();
        const addBucket = (cardId, ym, cents) => {
            const k = `${String(cardId)}|${String(ym)}`;
            bucketsByCardYM.set(k, (bucketsByCardYM.get(k) || 0) + (Number(cents) || 0));
        };

        const yms = new Set();

        for (const t of txnsDeduped) {
            const rid = resolveAccountIdFromTxn(t);
            if (!rid) continue;

            const acc = accountsById.get(String(rid));
            if (!acc || acc.type !== "credit_card") continue;

            const invRaw = String(t?.invoiceMonth ?? t?.invoice_month ?? "").trim();
            const invYM = invRaw.slice(0, 7);
            if (!/^\d{4}-\d{2}$/.test(invYM)) continue;

            const colYM = invYM;
            if (!/^\d{4}-\d{2}$/.test(colYM)) continue;

            yms.add(colYM);
            addBucket(String(rid), colYM, centsFromTxn(t));
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

        const cardRows = creditCards.map((c) => {
            const cardId = String(c.id);
            const values = {};

            for (const m of months) {
                const ym = ymKey(m.year, m.monthIndex0);
                const cents = bucketsByCardYM.get(`${cardId}|${ym}`) || 0;
                values[ym] = Number((Number(cents) / 100).toFixed(2));
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
    }, [accounts, txns, theme, focusYear, accountResolver]);

    // -----------------------------
    // ✅ RECEITAS (income)
    // -----------------------------
    const everIncomeByAccId = useMemo(() => {
        const accountsById = accountResolver.accountsById;
        const resolveAccountIdFromTxn = accountResolver.resolveAccountIdFromTxn;

        const isIncomeLikeGrid = (t) => {
            const d = String(t?.direction || t?.flow || t?.type || t?.movement || "").trim().toLowerCase();

            if (["in", "entrada", "income", "receita", "credit"].includes(d)) return true;
            if (["out", "saida", "saída", "expense", "despesa", "debit"].includes(d)) return false;

            const amt = Number(t?.amount ?? t?.value ?? 0);
            return Number.isFinite(amt) ? amt > 0 : false;
        };

        const map = new Map();

        for (const t of txns || []) {
            if (!t) continue;
            if (isLikelyInvoicePayment(t)) continue;
            if (!isIncomeLikeGrid(t)) continue;

            const accId = resolveAccountIdFromTxn(t) || t?.accountId || null;
            if (!accId) continue;

            if (accountsById.has(String(accId))) map.set(String(accId), true);
        }

        return map;
    }, [txns, accountResolver]);

    const incomeData = useMemo(() => {
        const months = (cardsData.months || []).map((m) => ymKey(m.year, m.monthIndex0));
        const monthsSet = new Set(months);

        const now = new Date();
        const fallbackStart = `${now.getFullYear()}-01`;
        const fallbackEnd = `${now.getFullYear()}-12`;

        const monthMin = months[0] || fallbackStart;
        const monthMax = months[months.length - 1] || fallbackEnd;

        const accountsById = accountResolver.accountsById;
        const resolveAccountIdFromTxn = accountResolver.resolveAccountIdFromTxn;

        const getTxnDirectionLikeGrid = (t) => {
            const d = String(t?.direction || t?.flow || t?.type || t?.movement || "").trim().toLowerCase();

            if (["in", "entrada", "income", "receita", "credit"].includes(d)) return "in";
            if (["out", "saida", "saída", "expense", "despesa", "debit"].includes(d)) return "out";

            const amt = Number(t?.amount ?? t?.value ?? 0);
            if (Number.isFinite(amt) && amt < 0) return "out";
            if (Number.isFinite(amt) && amt > 0) return "in";
            return "out";
        };

        const resolveIncomeYM = (t) => {
            const d =
                normalizeISODate(t?.purchaseDate ?? t?.purchase_date) ||
                normalizeISODate(t?.chargeDate ?? t?.charge_date) ||
                normalizeISODate(t?.date ?? t?.refDate ?? t?.reference_date) ||
                normalizeISODate(t?.createdAt ?? t?.created_at);

            return d ? d.slice(0, 7) : "";
        };

        const byAcc = new Map();
        for (const a of accounts || []) {
            if (!a?.id) continue;
            if (a?.active === false) continue;

            const accId = String(a.id);
            if (!everIncomeByAccId.get(accId)) continue;

            byAcc.set(accId, { id: accId, label: a.name || accId, values: {} });
        }

        const ensureRow = (accId, label) => {
            const k = String(accId || "unknown");
            let row = byAcc.get(k);
            if (!row) {
                row = { id: k, label: label || "Sem conta", values: {} };
                byAcc.set(k, row);
            }
            return row;
        };

        const totalByMonth = {};
        for (const ym of months) totalByMonth[ym] = 0;

        for (const t of txns || []) {
            if (!t) continue;
            if (isLikelyInvoicePayment(t)) continue;
            if (getTxnDirectionLikeGrid(t) !== "in") continue;

            const ym = resolveIncomeYM(t);
            if (!ym) continue;
            if (ymCompare(ym, monthMin) < 0 || ymCompare(ym, monthMax) > 0) continue;
            if (!monthsSet.has(ym)) continue;

            const resolvedId = resolveAccountIdFromTxn(t) || t?.accountId || "unknown";
            const acc = accountsById.get(String(resolvedId));
            const accId = acc?.id ? String(acc.id) : String(resolvedId);

            if (accId !== "unknown" && !everIncomeByAccId.get(accId)) continue;

            const label = acc?.name || (accId === "unknown" ? "Sem conta" : accId);
            const value = Math.abs((centsFromTxn(t) || 0) / 100);

            const row = ensureRow(accId, label);
            row.values[ym] = Number((safeNum(row.values[ym]) + value).toFixed(2));
            totalByMonth[ym] = Number((safeNum(totalByMonth[ym]) + value).toFixed(2));
        }

        const rows = Array.from(byAcc.values()).sort((a, b) => a.label.localeCompare(b.label));
        for (const k of Object.keys(totalByMonth)) totalByMonth[k] = Number(totalByMonth[k].toFixed(2));

        return { rows, totalByMonth };
    }, [txns, accounts, cardsData.months, accountResolver, everIncomeByAccId]);

    // -----------------------------
    // ✅ BILLS
    // Regras:
    // 1) Linha principal: SUBTOTAL por categoria
    // 2) Clique na categoria: expande e mostra os fornecedores (consolidados por favorecido)
    // 3) Dentro do favorecido: consolida mesmo favorecido
    // 4) Botões “Abrir tudo / Fechar tudo” + persistência no navegador
    // -----------------------------
    const billsData = useMemo(() => {
        const list = (bills || []).filter((b) => b?.active !== false).filter((b) => !billIsInvoice(b));

        const months = (cardsData.months || []).map((m) => ymKey(m.year, m.monthIndex0));
        const monthsSet = new Set(months);

        const now = new Date();
        const fallbackStart = `${now.getFullYear()}-01`;
        const fallbackEnd = `${now.getFullYear()}-12`;

        const monthMin = months[0] || fallbackStart;
        const monthMax = months[months.length - 1] || fallbackEnd;

        const byCat = new Map(); // catId -> { id, catId, label, values, __children: Map(payeeKey->child) }

        const ensureCatRow = (catId, label) => {
            const k = String(catId || "outros");
            let row = byCat.get(k);
            if (!row) {
                row = {
                    id: `cat_${k}`,
                    catId: k,
                    label: label || (k === "outros" ? "Outros" : k),
                    values: {},
                    __children: new Map(),
                };
                byCat.set(k, row);
            } else {
                if (label && label.length > String(row.label || "").length) row.label = label;
            }
            return row;
        };

        const ensureChild = (catRow, payeeKey, label) => {
            const k = String(payeeKey || "sem_favorecido");
            let child = catRow.__children.get(k);
            if (!child) {
                child = { id: `payee_${catRow.catId}_${k}`, payeeKey: k, label: label || "Sem favorecido", values: {} };
                catRow.__children.set(k, child);
            } else {
                if (label && label.length > String(child.label || "").length) child.label = label;
            }
            return child;
        };

        for (const b of list) {
            const amount = moneyToNumber(b?.defaultAmount);
            if (!amount) continue;

            const start = String(b?.startMonth || monthMin).slice(0, 7);
            const endRaw = String(b?.endMonth || "").slice(0, 7);
            const end = endRaw ? endRaw : monthMax;

            const catId = String(b?.categoryId || b?.category_id || "outros").trim() || "outros";
            const catLabel = String(b?.categoryName || b?.category_name || "").trim() || (catId === "outros" ? "Outros" : catId);

            const payeeKey = normalizePayeeForGroup(b) || "sem_favorecido";
            const payeeLabel = billLabelForRow(b) || "Sem favorecido";

            const catRow = ensureCatRow(catId, catLabel);
            const child = ensureChild(catRow, payeeKey, payeeLabel);

            let cur = start;
            let guard = 0;

            while (cur && ymCompare(cur, end) <= 0) {
                if (monthsSet.has(cur)) {
                    catRow.values[cur] = Number((safeNum(catRow.values[cur]) + amount).toFixed(2));
                    child.values[cur] = Number((safeNum(child.values[cur]) + amount).toFixed(2));
                }

                cur = addMonthsYM(cur, 1);
                guard += 1;
                if (guard > 240) break;
            }
        }

        const catRows = Array.from(byCat.values())
            .map((r) => {
                let total = 0;
                for (const ym of months) total += safeNum(r.values[ym]);
                return { ...r, __total: Number(total.toFixed(2)) };
            })
            .sort((a, b) => safeNum(b.__total) - safeNum(a.__total));

        const childrenByCatId = new Map();
        for (const cat of catRows) {
            const children = Array.from(cat.__children.values())
                .map((c) => {
                    let total = 0;
                    for (const ym of months) total += safeNum(c.values[ym]);
                    return { ...c, __total: Number(total.toFixed(2)) };
                })
                .sort((a, b) => safeNum(b.__total) - safeNum(a.__total))
                .map(({ __total, ...rest }) => rest);

            childrenByCatId.set(String(cat.catId), children);
        }

        const totalByMonth = {};
        for (const ym of months) totalByMonth[ym] = 0;

        for (const r of catRows) {
            for (const ym of months) totalByMonth[ym] = Number((safeNum(totalByMonth[ym]) + safeNum(r.values[ym])).toFixed(2));
        }

        const cleanCatRows = catRows.map(({ __children, __total, ...rest }) => rest);

        return { months, catRows: cleanCatRows, childrenByCatId, totalByMonth };
    }, [bills, cardsData.months]);

    // ✅ auto-preenche “openBillCats” com base no modo salvo (open/closed) quando categorias mudam
    useEffect(() => {
        const cats = (billsData?.catRows || []).map((c) => String(c?.catId || "outros"));
        if (!cats.length) return;

        setOpenBillCats((prev) => {
            const next = { ...(prev || {}) };
            let changed = false;

            for (const catId of cats) {
                if (typeof next[catId] !== "boolean") {
                    next[catId] = billsMode === "open"; // default pelo modo salvo
                    changed = true;
                }
            }

            // remove cats que não existem mais
            for (const k of Object.keys(next)) {
                if (!cats.includes(k)) {
                    delete next[k];
                    changed = true;
                }
            }

            return changed ? next : prev;
        });
    }, [billsData?.catRows, billsMode]);

    const openAllBills = useCallback(() => {
        const cats = (billsData?.catRows || []).map((c) => String(c?.catId || "outros"));
        const next = {};
        for (const id of cats) next[id] = true;
        setBillsMode("open");
        setOpenBillCats(next);
    }, [billsData?.catRows]);

    const closeAllBills = useCallback(() => {
        const cats = (billsData?.catRows || []).map((c) => String(c?.catId || "outros"));
        const next = {};
        for (const id of cats) next[id] = false;
        setBillsMode("closed");
        setOpenBillCats(next);
    }, [billsData?.catRows]);

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
                        values: incomeData.totalByMonth || emptyValues,
                        tone: "income",
                    },
                    rows: (incomeData.rows || []).map((r) => ({
                        id: `inc_${r.id}`,
                        label: r.label,
                        values: r.values,
                        tone: "incomeItem",
                    })),
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
                    rows: (billsData.catRows || []).map((c) => ({
                        id: `bill_cat_${c.catId}`,
                        catId: c.catId,
                        label: c.label,
                        values: c.values,
                        tone: "billCat",
                        isCat: true,
                    })),
                },
            ],
        };
    }, [cardsData, billsData, incomeData]);

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
        return columns.findIndex((c) => c.kind === "month" && c.year === focusYear && c.monthIndex0 === focusMonthIndex0);
    }, [columns, focusYear, focusMonthIndex0]);

    const last12MonthKeys = useMemo(() => {
        const monthCols = (columns || []).filter((c) => c.kind === "month");
        const last = monthCols.slice(-12);
        return last.map((c) => ymKey(c.year, c.monthIndex0));
    }, [columns]);

    const last12MonthSet = useMemo(() => new Set(last12MonthKeys), [last12MonthKeys]);
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

    const maskMoney = (str) => (hideValues ? "••••" : str);

    const formatMoneyCell = (value, allowNegative) => {
        const v = safeNum(value);
        if (!v) return "-";

        if (allowNegative) {
            const abs = Math.abs(v);
            const str = formatBRL(abs);
            return maskMoney(v < 0 ? `- ${str}` : str);
        }

        return maskMoney(formatBRL(Math.abs(v)));
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
        if (tone === "billCat") return alpha(theme.palette.warning.main, 0.08);
        if (tone === "billPayee") return alpha(theme.palette.warning.main, 0.04);
        return "transparent";
    };

    const renderRow = ({
        rowKey,
        label,
        values,
        tone,
        isHeaderRow,
        allowNegative,
        isSubtotal,
        prefixIcon,
        onClickLabel,
    }) => {
        const toneBg = getToneBg(tone);
        const heatMeta = computeHeatMeta(values, last12MonthKeys);

        return (
            <Box
                key={rowKey || label}
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
                        width: COL_LABEL_MAX,
                        maxWidth: COL_LABEL_MAX,
                        position: "sticky",
                        left: 0,
                        zIndex: 3,
                        background: bgSticky,
                        fontWeight: isHeaderRow ? 800 : isSubtotal ? 800 : 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        cursor: onClickLabel ? "pointer" : "default",
                        userSelect: "none",
                        gap: 0.5,
                    }}
                    onClick={onClickLabel || undefined}
                    title={label}
                >
                    {prefixIcon ? <span style={{ display: "inline-flex", alignItems: "center" }}>{prefixIcon}</span> : null}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                </Box>

                {columns.map((c, idx) => {
                    const isFocusMonth = c.kind === "month" && idx === focusColIndex;
                    const isYearTotal = c.kind === "yearTotal";
                    const isAllTotal = c.kind === "allTotal";

                    const w = colWidth(c);
                    const rawValue =
                        c.kind === "month"
                            ? values?.[ymKey(c.year, c.monthIndex0)]
                            : colValue(values, c);

                    const hasValue =
                        rawValue !== null &&
                        rawValue !== undefined &&
                        rawValue !== "";

                    const v = hasValue ? safeNum(rawValue) : null;
                    const isNeg = allowNegative && v < 0;

                    const cellKey = `${rowKey || label}|${c.kind}|${c.year ?? ""}|${c.monthIndex0 ?? ""}`;
                    const selected = isSelectedCell(cellKey);

                    // clique só faz sentido se tiver valor != 0
                    const clickable = !!v;

                    const ym = c.kind === "month" ? ymKey(c.year, c.monthIndex0) : "";
                    const shouldHeat =
                        c.kind === "month" &&
                        last12MonthSet.has(ym) &&
                        !!heatMeta &&
                        hasValue &&
                        v !== 0;

                    let heatBg = null;
                    if (shouldHeat) {
                        const t01 = (v - heatMeta.min) / (heatMeta.max - heatMeta.min);
                        const base = heatColor3(theme, t01);

                        // 👇 intensidade suave (ajuste fino aqui)
                        const a = theme.palette.mode === "dark" ? 0.22 : 0.14;
                        heatBg = alpha(base, a);
                    }

                    return (
                        <Box
                            key={cellKey}
                            onClick={
                                clickable
                                    ? (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const display = `${label} • ${c.kind === "month" ? ymKey(c.year, c.monthIndex0) : c.kind === "yearTotal" ? `Ano ${c.year}` : "Total"}`;
                                        toggleSelectCell(cellKey, v, display);
                                    }
                                    : undefined
                            }
                            sx={{
                                ...cellBase,
                                width: w,
                                minWidth: w,
                                justifyContent: "flex-end",
                                fontWeight: isHeaderRow || isSubtotal || isYearTotal || isAllTotal ? 800 : 500,
                                color: isNeg ? theme.palette.error.main : theme.palette.text.primary,
                                cursor: clickable ? "pointer" : "default",
                                userSelect: "none",

                                // ✅ heatmap base (somente últimos 12 meses)
                                ...(heatBg ? { background: heatBg } : null),

                                ...(isFocusMonth
                                    ? {
                                        background: heatBg ? heatBg : focusBg,
                                        borderLeft: focusBorder,
                                        borderRight: focusBorder,
                                    }
                                    : null),
                                ...(isYearTotal || isAllTotal ? { background: alpha(theme.palette.action.hover, 0.35) } : null),

                                ...(selected
                                    ? {
                                        background: selectedBg,
                                        outline: selectedBorder,
                                        outlineOffset: "-1px",
                                    }
                                    : null),
                            }}
                            title={clickable ? "Clique para somar/subtrair" : undefined}
                        >
                            {formatMoneyCell(v, allowNegative)}
                        </Box>
                    );
                })}
            </Box>
        );
    };

    const totalMatrixWidth = "max-content";

    const showSumBar = selectedCells.size > 0;

    const allBillsOpen = (billsData?.catRows || []).every((c) => {
        const catId = String(c.catId || "outros");
        return openBillCats[catId] === false; // false = aberto (pela sua lógica atual)
    });

    const toggleAllBills = () => {
        const cats = (billsData?.catRows || []).map((c) => String(c.catId || "outros"));

        setOpenBillCats((prev) => {
            const next = { ...prev };
            for (const catId of cats) {
                next[catId] = allBillsOpen ? true : false;
                // se tudo aberto → fecha (true)
                // se não → abre tudo (false)
            }
            return next;
        });
    };

    return (
        <Card variant="outlined" sx={{ overflow: "hidden" }}>
            <CardContent sx={{ pb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Stack spacing={0.2}>
                        <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                            Contas (matriz)
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                            receitas (income) + cartões (cutoff) + bills consolidadas
                        </Typography>
                    </Stack>

                    {/* Soma rápida (aparece só quando há seleção) */}
                    {showSumBar ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography
                                variant="body2"
                                sx={{
                                    fontWeight: 900,
                                    px: 1.1,
                                    py: 0.4,
                                    borderRadius: 999,
                                    background: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.22 : 0.12),
                                }}
                                title={`${selectedCells.size} valores selecionados`}
                            >
                                Soma: {maskMoney(formatBRL(Math.abs(selectedSum)))}
                            </Typography>

                            <Tooltip title="Limpar seleção">
                                <IconButton size="small" onClick={clearSelection}>
                                    <CloseRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    ) : null}
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
                                    width: COL_LABEL_MAX,
                                    maxWidth: COL_LABEL_MAX,
                                    position: "sticky",
                                    left: 0,
                                    zIndex: 6,
                                    background: bgSticky,
                                    fontWeight: 900,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
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
                                    width: COL_LABEL_MAX,
                                    maxWidth: COL_LABEL_MAX,
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
                                {/* section header row */}
                                <Box sx={{ display: "flex", background: strongBg }}>
                                    <Box
                                        sx={{
                                            ...cellBase,
                                            height: ROW_H_SECTION,
                                            minWidth: COL_LABEL_MIN,
                                            width: COL_LABEL_MAX,
                                            maxWidth: COL_LABEL_MAX,
                                            position: "sticky",
                                            left: 0,
                                            zIndex: 3,
                                            background: bgSticky,
                                            fontWeight: 900,
                                            borderBottom: `3px solid ${strongLine}`,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ opacity: 0.95, minWidth: 0 }}>
                                            {sec.icon}
                                            <span
                                                style={{
                                                    fontSize: 12,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {sec.label}
                                            </span>
                                        </Stack>
                                    </Box>

                                    <Box sx={{ height: ROW_H_SECTION, width: "100%", borderBottom: `3px solid ${strongLine}` }} />
                                </Box>



                                {/* total row */}
                                {renderRow({
                                    rowKey: sec.headerRow.id,
                                    label: sec.headerRow.label,
                                    values: sec.headerRow.values,
                                    tone: sec.headerRow.tone,
                                    isHeaderRow: true,
                                    allowNegative: false,
                                    isSubtotal: false,
                                    prefixIcon:
                                        sec.id === "bills" ? (
                                            <Tooltip title={allBillsOpen ? "Fechar todas as categorias" : "Abrir todas as categorias"}>
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleAllBills();
                                                    }}
                                                    sx={{
                                                        p: 0.3,
                                                        mr: 0.5,
                                                        color: allBillsOpen ? theme.palette.primary.main : theme.palette.text.secondary,
                                                    }}
                                                >
                                                    {allBillsOpen ? (
                                                        <UnfoldLessRoundedIcon sx={{ fontSize: 18 }} />
                                                    ) : (
                                                        <UnfoldMoreRoundedIcon sx={{ fontSize: 18 }} />
                                                    )}
                                                </IconButton>
                                            </Tooltip>
                                        ) : null,
                                })}

                                {/* Bills special */}
                                {sec.id === "bills" ? (
                                    <>
                                        {(sec.rows || []).map((cat) => {
                                            const catId = String(cat.catId || "outros");
                                            const isOpen = !!openBillCats[catId];
                                            const children = billsData.childrenByCatId?.get(catId) || [];

                                            const prefixIcon = (
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            toggleBillCat(catId);
                                                        }}
                                                        sx={{ p: 0.2, mr: 0.2 }}
                                                        aria-label={isOpen ? "recolher" : "expandir"}
                                                    >
                                                        {isOpen ? <ExpandMoreRoundedIcon sx={{ fontSize: 18 }} /> : <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />}
                                                    </IconButton>
                                                </span>
                                            );

                                            return (
                                                <Box key={cat.id}>
                                                    {renderRow({
                                                        rowKey: cat.id,
                                                        label: `↳ ${cat.label} (sub)`,
                                                        values: cat.values,
                                                        tone: "billCat",
                                                        isHeaderRow: false,
                                                        allowNegative: false,
                                                        isSubtotal: true,
                                                        prefixIcon,
                                                        onClickLabel: () => toggleBillCat(catId),
                                                    })}

                                                    <Collapse in={isOpen} timeout={180} unmountOnExit>
                                                        {children.map((p) =>
                                                            renderRow({
                                                                rowKey: p.id,
                                                                label: `   • ${p.label}`,
                                                                values: p.values,
                                                                tone: "billPayee",
                                                                isHeaderRow: false,
                                                                allowNegative: false,
                                                                isSubtotal: false,
                                                            })
                                                        )}
                                                    </Collapse>
                                                </Box>
                                            );
                                        })}
                                    </>
                                ) : (
                                    (sec.rows || []).map((r) =>
                                        renderRow({
                                            rowKey: r.id,
                                            label: r.label,
                                            values: r.values,
                                            tone: r.tone,
                                            isHeaderRow: false,
                                            allowNegative: false,
                                            isSubtotal: false,
                                        })
                                    )
                                )}
                            </Box>
                        ))}

                        {/* RESULTADO */}
                        <Box sx={{ mt: 0.3 }}>
                            {renderRow({
                                rowKey: "grand_total",
                                label: "RESULTADO",
                                values: grandTotalByMonth,
                                tone: "totals",
                                isHeaderRow: true,
                                allowNegative: true,
                                isSubtotal: false,
                            })}
                        </Box>
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}