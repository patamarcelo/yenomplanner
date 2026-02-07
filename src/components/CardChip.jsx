import React from "react";
import { Chip } from "@mui/material";
import { getCardById } from "../data/mockCards";

export default function CardChip({ cardId, size = "small" }) {
  const c = getCardById(cardId);
  if (!c) return null;

  return (
    <Chip
      size={size}
      label={c.name}
      sx={{
        background: c.tint,
        border: "1px solid rgba(0,0,0,0.08)",
        fontWeight: 750,
      }}
    />
  );
}
