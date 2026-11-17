import React, { useState } from 'react';
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { viewportDiagnosticsEnabled, setViewportDiagnosticsEnabled, getViewportDiagnostics } from '../utils/viewportDiagnostics.js';

export default function ViewportDiagnosticsPanel() {
  const [enabled] = useState(viewportDiagnosticsEnabled);
  const [message, setMessage] = useState('');
  const [fallback, setFallback] = useState('');
  const change = (next) => {
    try {
      setViewportDiagnosticsEnabled(next);
      window.location.reload();
    } catch {
      setMessage('O navegador não permitiu salvar a opção de diagnóstico.');
    }
  };
  const copy = async () => {
    const text = getViewportDiagnostics();
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Diagnóstico copiado. Você pode colá-lo na conversa com o suporte.');
    } catch {
      setFallback(text);
      setMessage('Selecione e copie o diagnóstico abaixo.');
    }
  };
  return (
    <Card sx={{ borderRadius: 2 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography fontWeight={900}>Diagnóstico da tela</Typography>
          <Typography variant="body2" color="text.secondary">
            Para investigar margens e teclado no celular. Registra somente medidas da tela neste app,
            sem valores digitados ou dados financeiros, e não envia nada automaticamente.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            {!enabled ? <Button variant="outlined" onClick={() => change(true)}>Iniciar diagnóstico da tela</Button> : <>
              <Button variant="contained" onClick={copy}>Copiar diagnóstico da tela</Button>
              <Button variant="outlined" onClick={() => change(false)}>Encerrar diagnóstico</Button>
            </>}
          </Stack>
          {enabled && <Typography variant="body2">Coleta ativa. Reproduza o problema no Dashboard e no modal, depois volte aqui para copiar.</Typography>}
          {message && <Alert severity="info">{message}</Alert>}
          {fallback && <TextField label="Diagnóstico para copiar" multiline value={fallback} slotProps={{ input: { readOnly: true } }} fullWidth />}
        </Stack>
      </CardContent>
    </Card>
  );
}
