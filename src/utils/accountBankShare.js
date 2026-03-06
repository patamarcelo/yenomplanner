export const BRAZIL_BANKS = [
    { code: "001", name: "Banco do Brasil S.A." },
    { code: "033", name: "Banco Santander (Brasil) S.A." },
    { code: "077", name: "Banco Inter S.A." },
    { code: "104", name: "Caixa Econômica Federal" },
    { code: "197", name: "Stone Pagamentos S.A." },
    { code: "212", name: "Banco Original S.A." },
    { code: "237", name: "Banco Bradesco S.A." },
    { code: "260", name: "Nu Pagamentos S.A. - Nubank" },
    { code: "290", name: "PagSeguro Internet S.A." },
    { code: "323", name: "Mercado Pago" },
    { code: "336", name: "Banco C6 S.A." },
    { code: "341", name: "Itaú Unibanco S.A." },
    { code: "380", name: "PicPay Bank - Banco Múltiplo S.A." },
];

export function onlyDigits(v) {
    return String(v || "").replace(/\D/g, "");
}

export function formatCPF(v) {
    const d = onlyDigits(v).slice(0, 11);
    return d
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function formatCNPJ(v) {
    const d = onlyDigits(v).slice(0, 14);
    return d
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function formatDocument(documentType, documentNumber) {
    return documentType === "cnpj"
        ? formatCNPJ(documentNumber)
        : formatCPF(documentNumber);
}

export function getAccountKindLabel(kind) {
    if (kind === "payment") return "Conta pagamento";
    if (kind === "savings") return "Conta poupança";
    return "Conta corrente";
}

export function getDocumentLabel(type) {
    return type === "cnpj" ? "CNPJ" : "CPF";
}

export function buildBankShareText(account) {
    const bank = account?.bankDetails || {};
    const accountLabel = getAccountKindLabel(bank.accountKind);
    const documentLabel = getDocumentLabel(bank.documentType);
    const documentValue = formatDocument(bank.documentType, bank.documentNumber);

    const accountLine = `${bank.accountNumber || "—"}${bank.accountDigit ? `-${bank.accountDigit}` : ""
        }`;

    const lines = [
        `Banco: ${bank.bankCode || "—"} - ${bank.bankName || "—"}`,
        `Agência: ${bank.branch || "—"}`,
        `${accountLabel}: ${accountLine || "—"}`,
        `${documentLabel}: ${documentValue || "—"}`,
        `Nome: ${bank.holderName || "—"}`,
    ];

    if (bank.pixKey) {
        const pixLabelMap = {
            cpf: "PIX CPF",
            cnpj: "PIX CNPJ",
            email: "PIX E-mail",
            phone: "PIX Telefone",
            random: "PIX Aleatória",
        };
        lines.push(`${pixLabelMap[bank.pixKeyType] || "PIX"}: ${bank.pixKey}`);
    }

    return lines.join("\n");
}