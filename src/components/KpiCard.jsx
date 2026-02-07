import React from "react";
import { Card, CardContent, Typography, Stack } from "@mui/material";

export default function KpiCard({ title, value, subtitle, right }) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
          <Stack spacing={0.6}>
            <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 650 }}>
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: -0.4 }}>
              {value}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {subtitle}
              </Typography>
            ) : null}
          </Stack>
          {right ? <div>{right}</div> : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
