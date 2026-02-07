// src/utils/billingDates.js

export function ymFromDate(dateStr) {
    // YYYY-MM-DD -> YYYY-MM
    const parts = String(dateStr || "").split("-");
    if (parts.length < 2) return "";
    return `${parts[0]}-${parts[1]}`;
}

export function addMonthsToYM(ym, delta) {
    const [y, m] = String(ym || "").split("-").map((x) => Number(x));
    if (!y || !m) return "";
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() + Number(delta || 0));
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yy}-${mm}`;
}

export function dayFromISO(dateStr) {
    const parts = String(dateStr || "").split("-");
    if (parts.length < 3) return null;
    const day = Number(parts[2]);
    return Number.isFinite(day) ? day : null;
}

/**
 * Regra:
 * - Se purchaseDay <= cutoffDay => invoiceMonth = purchase YYYY-MM
 * - Se purchaseDay > cutoffDay => invoiceMonth = próximo mês
 */
export function computeInvoiceMonthFromPurchase(purchaseDateISO, cutoffDay) {
    const baseYM = ymFromDate(purchaseDateISO);
    const day = dayFromISO(purchaseDateISO);
    const cd = Number(cutoffDay);
    if (!baseYM || !day || !Number.isFinite(cd) || cd <= 0) return baseYM;
    return day <= cd ? baseYM : addMonthsToYM(baseYM, 1);
}
