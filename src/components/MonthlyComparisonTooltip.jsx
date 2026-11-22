import React from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { buildMonthlyTooltipComparison } from '../utils/monthlyTooltipComparison.js';

export default function MonthlyComparisonTooltip({ active, payload, label, money }) {
  if (!active) return null;
  const { rows, average, maximum } = buildMonthlyTooltipComparison(payload);
  if (!rows.length) return null;
  return (
    <Box sx={(theme) => ({
      p: 1.5,
      width: 310,
      maxWidth: 'calc(100vw - 32px)',
      borderRadius: 1.5,
      background: alpha(theme.palette.background.paper, 0.98),
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: '0 12px 28px rgba(0,0,0,0.14)',
    })}>
      <Typography sx={{ fontWeight: 900, fontSize: 13 }}>Acumulado até o dia {label}</Typography>
      <Typography variant="caption" color="text.secondary">Meses do maior para o menor valor</Typography>
      <Stack spacing={1.1} sx={{ mt: 1.3 }}>
        {rows.map((row) => (
          <Box key={row.key}>
            <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.4 }}>
              <Typography sx={{ fontSize: 12, fontWeight: row.key === 'atual' ? 900 : 600 }}>{row.name}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' }}>{money(row.value)}</Typography>
            </Stack>
            <Box sx={{ height: 9, position: 'relative', borderRadius: 1, bgcolor: 'action.hover' }}>
              <Box sx={{ width: `${Math.max(0, row.value) / maximum * 100}%`, height: '100%', borderRadius: 1, bgcolor: row.color || 'primary.main' }} />
              {average !== null && <Box sx={{
                position: 'absolute', left: `${average / maximum * 100}%`,
                top: -2, bottom: -2, borderLeft: '2px dashed', borderColor: 'text.primary',
              }} />}
            </Box>
          </Box>
        ))}
      </Stack>
      {average !== null && <>
        <Divider sx={{ my: 1.2 }} />
        <Typography variant="caption" color="text.secondary">
          Tracejado: média dos meses anteriores — <Box component="span" sx={{ fontWeight: 900 }}>{money(average)}</Box>
        </Typography>
      </>}
    </Box>
  );
}
