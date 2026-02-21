// src/pages/Transactions.jsx
import React, { useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Stack, Typography } from "@mui/material";

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

  const month = useSelector((s) => s.finance?.month || "");

  useEffect(() => {
    // ✅ evita refetch ao navegar entre telas
    if (status === "loading") return;
    if (status === "succeeded") return;
    dispatch(fetchAllTransactionsThunk());
  }, [dispatch, status]);

  const all = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    // ISO yyyy-mm-dd compara bem como string
    return list
      .slice()
      .sort((a, b) =>
        String(b?.chargeDate || "").localeCompare(String(a?.chargeDate || ""))
      );
  }, [rows]);

  return (
    <Stack
      spacing={1.6}
      sx={{
        width: "100%",     // ✅ garante ocupar toda a largura disponível
        flex: 1,           // ✅ ajuda quando a página está em layout flex
        minWidth: 0,       // ✅ evita overflow estranho em grids/tabelas
        minHeight: 0,      // ✅ permite o DataGrid “crescer” verticalmente se o pai permitir
      }}
    >
      {error ? (
        <Typography variant="body2" sx={{ color: "error.main" }}>
          {String(error)}
        </Typography>
      ) : null}

      <TransactionsGrid
        rows={all}
        month={month}
        status={status}
        onMonthFilterChange={(v) => {
          // grid emite "ALL" quando seleciona todos
          dispatch(setMonth(v === "ALL" ? "" : v));
        }}
      />
    </Stack>
  );
}
