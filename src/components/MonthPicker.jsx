import React from "react";
import { MenuItem, TextField } from "@mui/material";
import { formatMonthBR } from "../utils/dateBR";

function ymOptions() {
  // MVP: últimos + próximos meses
  const out = [];
  const base = new Date();
  base.setDate(1);

  for (let i = -6; i <= 8; i++) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    out.push(`${y}-${m}`);
  }
  return out;
}

export default function MonthPicker({ value, onChange }) {
  const opts = ymOptions();
  return (
    <TextField
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      select
      sx={{
        width: 140,
        "& .MuiOutlinedInput-root": { height: 40, borderRadius: 999 },
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
