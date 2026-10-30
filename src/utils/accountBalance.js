export function resolveTxnAccountId(tx, accounts) {
  if (tx?.accountId) return tx.accountId;

  const legacy = tx?.cardId;
  if (!legacy) return "";

  const found = (accounts || []).find(
    (a) =>
      a?.type === "credit_card" &&
      String(a?.externalId || a?.external_id || "").endsWith(`_${legacy}`)
  );
  return found?.id || "";
}

export function signedAmount(tx) {
  const v = Math.abs(Number(tx?.amount || 0));
  if (!Number.isFinite(v)) return 0;
  return String(tx?.direction).toLowerCase() === "income" ? v : -v;
}

export function calcAccountBalance(account, txns, accounts) {
  const opening = Number(account?.openingBalance || 0);
  const accId = String(account?.id || "");
  const sum = (txns || [])
    .filter((t) => {
      const tid = String(resolveTxnAccountId(t, accounts) || "");
      if (!tid || tid !== accId) return false;

      if (String(account?.type) !== "checking") return true;

      const st = String(t?.status || "").toLowerCase();
      return st === "pago";
    })
    .reduce((acc, t) => acc + signedAmount(t), 0);

  return opening + sum;
}

