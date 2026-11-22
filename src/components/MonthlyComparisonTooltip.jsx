import React from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { buildMonthlyTooltipComparison } from '../utils/monthlyTooltipComparison.js';

export default function MonthlyComparisonTooltip({ active, payload, label, money }) {
  if (!active) return null;
  const { rows, average, maximum } = buildMonthlyTooltipComparison(payload);
  if (!rows.length) return null;
  const showBarValues = rows.length <= 4;
  const columns = `repeat(${rows.length}, minmax(0, 1fr))`;
  return (
    <Box sx={(theme) => ({
      p: 1.5,
      width: rows.length > 6 ? 560 : 360,
      maxWidth: 'calc(100vw - 32px)',
      borderRadius: 1.5,
      background: alpha(theme.palette.background.paper, 0.98),
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: '0 12px 28px rgba(0,0,0,0.14)',
    })}>
      <Typography sx={{ fontWeight: 900, fontSize: 13 }}>Acumulado até o dia {label}</Typography>
      <Typography variant="caption" color="text.secondary">Meses do mais antigo ao mais recente</Typography>
      <Box sx={{ pt: 3, mt: 1 }}>
        <Box sx={{ position: 'relative', height: 130, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: columns, gap: 1, height: '100%' }}>
            {rows.map((row) => (
              <Box key={row.key} sx={{ position: 'relative', height: '100%', minWidth: 0 }}>
                {showBarValues && <Typography sx={{
                  position: 'absolute', bottom: `calc(${Math.max(0, row.value) / maximum * 100}% + 4px)`,
                  left: '50%', transform: 'translateX(-50%)', zIndex: 1, bgcolor: 'background.paper', px: 0.3,
                  textAlign: 'center', fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap',
                }}>{money(row.value)}</Typography>}
                <Box sx={{
                  position: 'absolute', bottom: 0, left: '15%', width: '70%',
                  height: `${Math.max(0, row.value) / maximum * 100}%`,
                  borderRadius: '4px 4px 0 0', bgcolor: row.color || 'primary.main',
                }} />
              </Box>
            ))}
          </Box>
          {average !== null && <Box sx={{
            position: 'absolute', bottom: `${average / maximum * 100}%`, left: 0, right: 0,
            borderTop: '2px dashed', borderColor: 'text.primary', pointerEvents: 'none',
          }} />}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: columns, gap: 1, mt: 0.7 }}>
          {rows.map((row) => (
            <Typography key={row.key} sx={{ textAlign: 'center', fontSize: rows.length > 6 ? 9 : 11, fontWeight: row.key === 'atual' ? 900 : 600 }}>
              {row.key === 'atual' ? 'Atual' : row.name?.split('/')[0]}
              {row.key !== 'atual' && row.name?.includes('/') && <Box component="span" sx={{ display: 'block', color: 'text.secondary' }}>{row.name.split('/')[1]}</Box>}
            </Typography>
          ))}
        </Box>
      </Box>
      {!showBarValues && <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.7, mt: 1.5 }}>
        {rows.map((row) => <Stack key={row.key} direction="row" justifyContent="space-between" spacing={0.5}>
          <Typography sx={{ fontSize: 10 }}>{row.key === 'atual' ? 'Atual' : row.name}</Typography>
          <Typography sx={{ fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap' }}>{money(row.value)}</Typography>
        </Stack>)}
      </Box>}
      {average !== null && <>
        <Divider sx={{ my: 1.2 }} />
        <Typography variant="caption" color="text.secondary">
          Tracejado: média dos meses anteriores — <Box component="span" sx={{ fontWeight: 900 }}>{money(average)}</Box>
        </Typography>
      </>}
    </Box>
  );
}
