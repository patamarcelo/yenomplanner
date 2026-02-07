import React, { useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Stack, Typography } from "@mui/material";
import TransactionsGrid from "../components/TransactionsGrid";
import { setMonth } from "../store/financeSlice";

export default function Transactions() {
  const dispatch = useDispatch();
  const month = useSelector((s) => s.finance.month);
  const txns = useSelector((s) => s.finance.txns);

  const all = useMemo(() => {
    const list = Array.isArray(txns) ? txns : [];
    return list.slice().sort((a, b) => (a?.chargeDate < b?.chargeDate ? 1 : -1));
  }, [txns]);

  return (
    <Stack spacing={1.6}>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Linhas com destaque por cartão. Filtro por mês = fatura.
      </Typography>

      <TransactionsGrid
        rows={all}
        month={month}
        onMonthFilterChange={(v) => dispatch(setMonth(v))}
      />
    </Stack>
  );
}
