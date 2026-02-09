// src/components/MonthPicker.jsx (ou onde estiver)
import React, { useMemo, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { TextField, MenuItem, Divider } from "@mui/material";
import { setMonth } from "../store/financeSlice";
import { formatMonthBR } from "../utils/dateBR";

function currentYM() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function MonthPicker({ fullWidth = false, size = "small" }) {
  const dispatch = useDispatch();
  const month = useSelector((s) => s.finance.month);
  const txns = useSelector((s) => s.finance.txns) || [];

  const months = useMemo(() => {
    const set = new Set();

    for (const t of txns) {
      const ym = String(t?.invoiceMonth || "");
      if (ym) set.add(ym);
    }

    // ✅ garante mês atual na lista
    set.add(currentYM());

    // ordena desc (mais recente primeiro)
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [txns]);

  // ✅ se o mês selecionado não existe (ou ainda não tem dados), cai pro mês atual
  useEffect(() => {
    const cur = currentYM();
    if (!month) return; // month=="" é "Todos": respeita
    if (month && !months.includes(month)) {
      dispatch(setMonth(cur));
    }
  }, [month, months, dispatch]);

  return (
    <TextField
      label="Mês"
      select
      value={month ?? ""}
      onChange={(e) => dispatch(setMonth(e.target.value))}
      size={size}
      fullWidth={fullWidth}
    >
      <MenuItem value="">Todos</MenuItem>
      <Divider />
      {months.map((ym) => (
        <MenuItem key={ym} value={ym}>
          {formatMonthBR(ym)}
        </MenuItem>
      ))}
    </TextField>
  );
}
