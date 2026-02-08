// src/components/MonthPicker.jsx  (ou onde estiver)
// (mantive o mesmo nome/export pra não quebrar import)

import React, { useEffect, useMemo } from "react";
import { MenuItem, TextField } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { setMonth } from "../store/financeSlice";
import { formatMonthBR } from "../utils/dateBR";

function currentYM() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function ymFromISO(iso) {
  const s = String(iso || "");
  const parts = s.split("-");
  if (parts.length < 2) return "";
  const y = parts[0];
  const m = parts[1];
  if (!y || !m) return "";
  return `${y}-${m}`;
}

function isValidYM(ym) {
  return /^\d{4}-\d{2}$/.test(String(ym || ""));
}

function sortYMDesc(a, b) {
  // "2026-02" -> 202602
  const na = Number(String(a).replace("-", ""));
  const nb = Number(String(b).replace("-", ""));
  return nb - na;
}

export default function MonthPicker() {
  const dispatch = useDispatch();
  const month = useSelector((s) => s.finance.month);
  const txns = useSelector((s) => s.finance.txns);

  const opts = useMemo(() => {
    const set = new Set();

    for (const t of txns || []) {
      const ymA = t?.invoiceMonth;
      const ymB = ymFromISO(t?.purchaseDate);
      const ymC = ymFromISO(t?.chargeDate);

      if (isValidYM(ymA)) set.add(ymA);
      if (isValidYM(ymB)) set.add(ymB);
      if (isValidYM(ymC)) set.add(ymC);
    }

    // garante o mês atual sempre disponível (mesmo sem lançamentos)
    set.add(currentYM());

    return Array.from(set).sort(sortYMDesc);
  }, [txns]);

  // garante mês atual como padrão:
  // - se month vazio
  // - se month não existe mais (ex.: limpeza/estado antigo)
  useEffect(() => {
    const cur = currentYM();
    if (!month || !isValidYM(month)) {
      dispatch(setMonth(cur));
      return;
    }
    if (opts.length && !opts.includes(month)) {
      dispatch(setMonth(cur));
    }
  }, [dispatch, month, opts]);

  return (
    <TextField
      size="small"
      value={month || currentYM()}
      onChange={(e) => dispatch(setMonth(e.target.value))}
      select
      sx={{
        width: 140,
        "& .MuiOutlinedInput-root": {
          height: 40,
          borderRadius: 14, // <<< reduzi MUITO (tava 999)
        },
      }}
    >
      {opts.map((ym) => (
        <MenuItem key={ym} value={ym}>
          {formatMonthBR(ym)}
        </MenuItem>
      ))}
    </TextField>
  );
}
