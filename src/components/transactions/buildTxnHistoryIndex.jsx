function norm(v) {
    return String(v ?? "").trim().toLowerCase();
}

function inc(map, key) {
    if (!key) return;
    map[key] = (map[key] || 0) + 1;
}

function topKeysByCount(map, limit = 12) {
    return Object.entries(map || {})
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .slice(0, limit)
        .map(([k]) => k);
}

export default function buildTxnHistoryIndex(rows = []) {
    const merchantsCount = {};
    const merchantToDescriptions = {}; // merchantKey -> {descKey: count}
    const merchantToCategories = {};   // merchantKey -> {catKey: count}
    const merchantLabelByKey = {};     // merchantKey -> "Zaffari" (primeiro visto)

    for (const r of rows || []) {
        const merchantRaw = String(r?.merchant ?? "").trim();
        const merchantKey = norm(merchantRaw);
        if (!merchantKey) continue;

        if (!merchantLabelByKey[merchantKey]) merchantLabelByKey[merchantKey] = merchantRaw;

        inc(merchantsCount, merchantKey);

        const descRaw = String(r?.description ?? "").trim();
        const descKey = norm(descRaw);
        if (descKey) {
            merchantToDescriptions[merchantKey] ||= {};
            inc(merchantToDescriptions[merchantKey], descKey);
        }

        const catRaw = String(r?.categoryId ?? "").trim(); // aqui você usa slug em geral
        const catKey = norm(catRaw);
        if (catKey) {
            merchantToCategories[merchantKey] ||= {};
            inc(merchantToCategories[merchantKey], catKey);
        }
    }

    const merchantsTop = topKeysByCount(merchantsCount, 50).map((k) => ({
        key: k,
        label: merchantLabelByKey[k] || k,
        count: merchantsCount[k] || 0,
    }));

    function getMerchantSuggestions(prefix, limit = 10) {
        const p = norm(prefix);
        if (!p) return merchantsTop.slice(0, limit);

        // prioriza "startsWith", depois "includes"
        const starts = [];
        const contains = [];

        for (const m of merchantsTop) {
            const k = m.key;
            if (k.startsWith(p)) starts.push(m);
            else if (k.includes(p)) contains.push(m);
        }
        return starts.concat(contains).slice(0, limit);
    }

    function getDescriptionSuggestions(merchant, prefix, limit = 12) {
        const mk = norm(merchant);
        const p = norm(prefix);
        if (!mk) return [];

        const pool = merchantToDescriptions[mk] || {};
        const keys = Object.keys(pool);

        const filtered = !p
            ? keys
            : keys.filter((k) => k.startsWith(p) || k.includes(p));

        return filtered
            .sort((a, b) => (pool[b] || 0) - (pool[a] || 0))
            .slice(0, limit)
            .map((k) => ({ key: k, label: k }));
    }

    function getBestCategoryForMerchant(merchant) {
        const mk = norm(merchant);
        if (!mk) return "";
        const pool = merchantToCategories[mk] || {};
        const best = Object.entries(pool).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0];
        return best?.[0] || "";
    }

    function getTopCategoriesForMerchant(merchant, limit = 6) {
        const mk = norm(merchant);
        if (!mk) return [];
        const pool = merchantToCategories[mk] || {};
        return topKeysByCount(pool, limit);
    }

    return {
        getMerchantSuggestions,
        getDescriptionSuggestions,
        getBestCategoryForMerchant,
        getTopCategoriesForMerchant,
    };
}
