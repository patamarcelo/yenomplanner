import React from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { buildMonthlyTooltipComparison, isTooltipToday } from '../utils/monthlyTooltipComparison.js';

export default function MonthlyComparisonTooltip({ active, payload, label, money, month }) {
  if (!active) return null;
  const { rows, average, maximum } = buildMonthlyTooltipComparison(payload);
  if (!rows.length) return null;
  const rotateValues = rows.length > 4;
  const today = isTooltipToday(month, label);
  const columns = `repeat(${rows.length}, minmax(0, 1fr))`;
  return (
    <Box sx={(theme) => ({
      p: 1.1,
      width: rows.length > 6 ? 480 : 310,
      maxWidth: 'calc(100vw - 32px)',
      borderRadius: 1.5,
      background: alpha(theme.palette.background.paper, 0.98),
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: '0 12px 28px rgba(0,0,0,0.14)',
    })}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography sx={{ fontWeight: 900, fontSize: 12 }}>Acumulado até o dia {label}</Typography>
        {today && <Box component="span" sx={(theme) => ({
          color: 'success.main', bgcolor: alpha(theme.palette.success.main, 0.1),
          borderRadius: 1, px: 0.8, py: 0.2, fontSize: 10, fontWeight: 900,
        })}>HOJE</Box>}
      </Stack>
      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Do mais antigo ao mais recente</Typography>
      <Box sx={{ pt: rotateValues ? 11 : 2.8, mt: 0.7 }}>
        <Box sx={{ position: 'relative', height: 96, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: columns, gap: 1, height: '100%' }}>
            {rows.map((row) => (
              <Box key={row.key} sx={{ position: 'relative', height: '100%', minWidth: 0 }}>
                <Typography sx={{
                  position: 'absolute', bottom: `calc(${Math.max(0, row.value) / maximum * 100}% + 4px)`,
                  left: rotateValues ? 'calc(50% - 5px)' : '50%',
                  transform: rotateValues ? 'rotate(-90deg)' : 'translateX(-50%)',
                  transformOrigin: rotateValues ? 'left bottom' : 'center',
                  zIndex: 1, bgcolor: 'background.paper', px: 0.2,
                  textAlign: 'center', fontSize: 9, fontWeight: 800, whiteSpace: 'nowrap',
                }}>{money(row.value)}</Typography>
                <Box sx={{
                  position: 'absolute', bottom: 0, left: '50%', width: '42%', maxWidth: 22, transform: 'translateX(-50%)',
                  height: `${Math.max(0, row.value) / maximum * 100}%`,
                  borderRadius: '3px 3px 0 0', bgcolor: row.color || 'primary.main',
                }} />
              </Box>
            ))}
          </Box>
          {average !== null && <Box sx={{
            position: 'absolute', bottom: `${average / maximum * 100}%`, left: 0, right: 0,
            borderTop: '1px dashed', borderColor: 'text.primary', pointerEvents: 'none',
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
      {average !== null && <>
        <Divider sx={{ my: 0.8 }} />
        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
          Tracejado: média dos meses anteriores — <Box component="span" sx={{ fontWeight: 900 }}>{money(average)}</Box>
        </Typography>
      </>}
    </Box>
  );
}
