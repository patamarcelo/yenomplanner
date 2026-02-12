// src/pages/Transactions.jsx
import React, { useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Stack, Typography, Alert, CircularProgress } from "@mui/material";
import TransactionsGrid from "../components/TransactionsGrid";
import { setMonth } from "../store/financeSlice";
import {
  fetchAllTransactionsThunk,
  selectTransactionsUi,
  selectTransactionsStatus,
  selectTransactionsError,
} from "../store/transactionsSlice";

export default function Transactions() {
  const dispatch = useDispatch();

  
  const rows = useSelector(selectTransactionsUi);
  const status = useSelector(selectTransactionsStatus);
  const error = useSelector(selectTransactionsError);

  useEffect(() => {
    // ✅ busca uma vez ao entrar na página
    dispatch(fetchAllTransactionsThunk());
  }, [dispatch]);

  const all = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    return list.slice().sort((a, b) => (a?.chargeDate < b?.chargeDate ? 1 : -1));
  }, [rows]);

  return (
    <Stack spacing={1.6}>
      {error ? (
        <Typography variant="body2" sx={{ color: "error.main" }}>
          {String(error)}
        </Typography>
      ) : null}

      <TransactionsGrid
        rows={all}
        status={status}
        onMonthFilterChange={(v) => dispatch(setMonth(v))}
      />
    </Stack>
  );
}
