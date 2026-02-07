import React from "react";
import { Stack, Typography, Card, CardContent } from "@mui/material";

export default function Invoices() {
  return (
    <Stack spacing={2}>
      <Typography variant="h6" sx={{ fontWeight: 900 }}>
        Faturas (MVP)
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Próximo passo: seletor Cartão + Mês, agrupamento (Avulsos / Parcelas / Recorrências) e total da fatura.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
