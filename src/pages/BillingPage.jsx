import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Chip, CircularProgress, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import http from '../api/http';
import { applyFiscalPreset, clearFiscalPreset } from '../utils/fiscalPresets';

const base = '/yenomplanner/billing/';
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const money = value => (Number(value) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const labels = { queued: 'Na fila', processing: 'Processando', uncertain: 'Aguardando consulta', authorized: 'Autorizada', failed: 'Falha na preparação', planned: 'Previsto', paid: 'Recebido' };
const initial = () => ({ idempotency_key: crypto.randomUUID(), competence: today(), issueDate: today(), dueDate: today(), amount: '', description: '', cnpj: '', name: '', codigoMunicipioIbge: '', cep: '', logradouro: '', numero: '', bairro: '', complemento: '', preset_cnpj: '' });
const errorText = error => error.response?.data?.detail || error.message || 'Não foi possível concluir. Verifique a conexão e tente novamente.';

export default function BillingPage() {
  const initializedPreset = useRef(false);
  const [tab, setTab] = useState(0);
  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [receivables, setReceivables] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(initial);
  const [certificate, setCertificate] = useState(null);
  const [template, setTemplate] = useState(null);
  const [password, setPassword] = useState('');
  const [series, setSeries] = useState('1');
  const [payment, setPayment] = useState({ account_id: '', paid_at: today() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = useCallback(async () => {
    const [p, d, r, a] = await Promise.all(['profile/', 'documents/', 'receivables/', null].map(path => http.get(path ? base + path : '/yenomplanner/accounts/')));
    if (!initializedPreset.current && p.data.customer_templates?.length) {
      initializedPreset.current = true;
      setForm(old => old.cnpj ? old : applyFiscalPreset(old, p.data.customer_templates[0]));
    }
    setProfile(p.data); setSeries(String(p.data.series)); setDocuments(d.data); setReceivables(r.data);
    setAccounts((a.data.results || a.data).filter(account => account.type === 'checking'));
  }, []);
  useEffect(() => { load().catch(e => setError(errorText(e))); }, [load]);
  useEffect(() => {
    if (!documents.some(doc => ['queued', 'processing'].includes(doc.status))) return;
    const timer = setInterval(() => load().catch(() => {}), 5000);
    return () => clearInterval(timer);
  }, [documents, load]);
  const run = async callback => {
    setBusy(true); setError(''); setSuccess('');
    try { await callback(); await load(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const field = (name, label, extra = {}) => <TextField label={label} value={form[name]} onChange={e => setForm(old => ({ ...old, [name]: e.target.value }))} required fullWidth {...extra} />;
  const saveConfig = e => {
    e.preventDefault(); run(async () => {
      const data = new FormData(); data.append('series', series);
      if (certificate) { data.append('certificate', certificate); data.append('password', password); }
      if (template) data.append('template', template);
      const saved = await http.post(base + 'profile/', data);
      if (template && saved.data.customer_templates?.length) {
        initializedPreset.current = true;
        setForm(old => applyFiscalPreset(old, saved.data.customer_templates.at(-1)));
      }
      setPassword(''); setCertificate(null); setTemplate(null); setSuccess('Configuração salva. Certificado e senha ficam criptografados no servidor.');
    });
  };
  const lookupCustomer = () => run(async () => {
    const cnpj = form.cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) throw new Error('Informe um CNPJ com 14 dígitos.');
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!response.ok) throw new Error('Não foi possível consultar o CNPJ. Preencha os dados manualmente.');
    const data = await response.json();
    setForm(old => ({ ...old, cnpj, name: data.razao_social || '',
      codigoMunicipioIbge: String(data.codigo_municipio_ibge || ''), cep: String(data.cep || '').replace(/\D/g, ''),
      logradouro: data.logradouro || '', numero: data.numero || '', bairro: data.bairro || '' }));
  });
  const emit = e => {
    e.preventDefault(); run(async () => {
      await http.post(base + 'documents/', { ...form, customer: { cnpj: form.cnpj, name: form.name, address: Object.fromEntries(['codigoMunicipioIbge', 'cep', 'logradouro', 'numero', 'bairro', 'complemento'].map(key => [key, form[key]])) } });
      setForm(old => { const preset = profile?.customer_templates?.find(item => item.cnpj === old.preset_cnpj); return preset ? applyFiscalPreset(initial(), preset) : initial(); }); setSuccess('Solicitação recebida. Acompanhe o resultado na lista de notas.');
    });
  };
  const download = (doc, extension = 'xml') => run(async () => {
    const response = await http.get(base + `documents/${doc.id}/${extension}/`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data); const a = document.createElement('a');
    a.href = url; a.download = `nfse-homologacao-${doc.number}.${extension}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const presets = profile?.customer_templates || [];
  const selectedPreset = presets.find(item => item.cnpj === form.preset_cnpj);
  return <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 1, md: 3 } }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
      <Typography variant="h5" fontWeight={800}>Faturamento</Typography><Chip label="Beta · Homologação" color="warning" />
    </Stack>
    <Alert severity="info" sx={{ mb: 2 }}>Ambiente de testes. As notas e os recebimentos desta versão não alteram seus saldos reais.</Alert>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{String(error)}</Alert>}
    {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
    <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
      <Tab label="Emitir NFS-e" /><Tab label="Notas emitidas" /><Tab label="Contas a receber" /><Tab label="Configurações" />
    </Tabs>
    {busy && <CircularProgress size={24} sx={{ mb: 2 }} />}
    {tab === 0 && <Paper component="form" onSubmit={emit} sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h6" mb={2}>Nova nota de serviço</Typography>
      {!profile?.certificate_ready && <Alert severity="warning" sx={{ mb: 2 }}>Cadastre o certificado A1 e o XML-modelo em Configurações.</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        {field('competence', 'Competência', { type: 'date', slotProps: { inputLabel: { shrink: true } } })}
        {field('issueDate', 'Data de emissão', { type: 'date', slotProps: { inputLabel: { shrink: true } } })}
        {field('dueDate', 'Vencimento do recebível', { type: 'date', slotProps: { inputLabel: { shrink: true } } })}
      </Box>
      <Stack spacing={2} mt={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          <Autocomplete freeSolo fullWidth options={presets}
            value={presets.find(item => item.cnpj === form.cnpj) || form.cnpj}
            inputValue={form.cnpj}
            filterOptions={(options, { inputValue }) => options.some(item => item.cnpj === inputValue) ? options : options.filter(item => `${item.cnpj} ${item.name}`.toLocaleLowerCase().includes(inputValue.toLocaleLowerCase()))}
            getOptionLabel={option => typeof option === 'string' ? option : `${option.cnpj} · ${option.name}`}
            isOptionEqualToValue={(option, value) => option.cnpj === value.cnpj}
            onInputChange={(_, value, reason) => { if (reason === 'input') setForm(old => clearFiscalPreset(old, value)); }}
            onChange={(_, value) => setForm(old => value && typeof value !== 'string' ? applyFiscalPreset(old, value) : clearFiscalPreset(old, value || ''))}
            renderInput={params => <TextField {...params} label="CNPJ do cliente" required helperText="Selecione um modelo importado ou digite um novo CNPJ." />}
          />
          <Button onClick={lookupCustomer} disabled={busy} sx={{ whiteSpace: 'nowrap' }}>Consultar CNPJ</Button>
        </Stack>
        {field('name', 'Razão social do cliente')}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          {field('cep', 'CEP (somente números)')}{field('codigoMunicipioIbge', 'Código IBGE do município')}
          {field('logradouro', 'Logradouro')}{field('numero', 'Número')}{field('bairro', 'Bairro')}{field('complemento', 'Complemento', { required: false })}
        </Box>
        {selectedPreset && <Alert severity="info">Modelo de {selectedPreset.name} aplicado. Os dados podem ser editados antes de emitir.
          <Box component="details" mt={1}><Box component="summary" sx={{ cursor: 'pointer' }}>Parâmetros fiscais do XML</Box>
            {Object.entries(selectedPreset.fiscal || {}).filter(([, value]) => value).map(([key, value]) => <Typography key={key} variant="body2">{key}: {value}</Typography>)}
          </Box>
        </Alert>}
        {field('description', 'Descrição dos serviços', { multiline: true, minRows: 4 })}
        {field('amount', 'Valor do serviço (R$)', { type: 'number', inputProps: { min: '0.01', step: '0.01' } })}
        <Button type="submit" variant="contained" disabled={busy || !profile?.certificate_ready || !profile?.template_ready}>Emitir em homologação</Button>
      </Stack>
    </Paper>}
    {tab === 1 && <Stack spacing={2}>
      <Button onClick={() => run(load)} disabled={busy} sx={{ alignSelf: 'end' }}>Atualizar</Button>
      {!documents.length && <Typography color="text.secondary">Nenhuma nota solicitada.</Typography>}
      {documents.map(doc => <Paper key={doc.id} sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap"><Typography fontWeight={700}>NFS-e #{doc.number} · {doc.request.customer.name}</Typography><Chip size="small" label={labels[doc.status] || doc.status} color={doc.status === 'authorized' ? 'success' : 'default'} /></Stack>
        <Typography mt={1}>{money(Number(doc.request.amount) * 100)} · Competência: {doc.request.competence}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{doc.dps_id}</Typography>
        {doc.message && <Alert severity="warning" sx={{ mt: 1 }}>{doc.message}</Alert>}
        {doc.status === 'authorized' && <><Button onClick={() => download(doc)} disabled={busy}>Baixar XML</Button><Button onClick={() => download(doc, 'pdf')} disabled={busy}>Baixar PDF</Button></>}
        {['uncertain', 'processing'].includes(doc.status) && <Button disabled={busy} onClick={() => run(() => http.post(base + `documents/${doc.id}/reconcile/`))}>Consultar autorização</Button>}
        {doc.status === 'uncertain' && <Button disabled={busy} color="warning" onClick={() => run(async () => { const result = await http.post(base + `documents/${doc.id}/recover/`); setSuccess(result.data.status === 'authorized' ? 'Nota recuperada e autorizada.' : 'A SEFIN recusou o reenvio da mesma DPS.'); })}>Recuperar esta DPS</Button>}
      </Paper>)}
    </Stack>}
    {tab === 2 && <Stack spacing={2}>
      <Alert severity="info">A nota autorizada cria um recebível previsto. Aqui você pode testar a baixa manual, sem gerar receita nas contas reais.</Alert>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField select fullWidth label="Conta de recebimento" value={payment.account_id} onChange={e => setPayment(old => ({ ...old, account_id: e.target.value }))}>{accounts.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField>
        <TextField fullWidth type="date" label="Data do recebimento" slotProps={{ inputLabel: { shrink: true } }} value={payment.paid_at} onChange={e => setPayment(old => ({ ...old, paid_at: e.target.value }))} />
      </Stack>
      {!receivables.length && <Typography color="text.secondary">Nenhum recebível. Ele será criado após a autorização da nota.</Typography>}
      {receivables.map(row => <Paper key={row.id} sx={{ p: 2 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2}>
        <Box><Typography fontWeight={700}>{row.customer}</Typography><Typography>{money(row.amount_cents)} · Vencimento: {row.due_date}</Typography><Chip size="small" label={labels[row.status]} /></Box>
        {row.status !== 'paid' && <Button variant="outlined" disabled={busy || !payment.account_id} onClick={() => run(async () => { await http.post(base + `receivables/${row.id}/receive/`, payment); setSuccess('Recebimento de teste registrado.'); })}>Registrar recebimento de teste</Button>}
      </Stack></Paper>)}
    </Stack>}
    {tab === 3 && <Paper component="form" onSubmit={saveConfig} sx={{ p: { xs: 2, md: 3 } }}><Stack spacing={2}>
      <Typography variant="h6">Certificado e configuração fiscal</Typography>
      <Typography color="text.secondary">O certificado e a senha são exclusivos do seu usuário e armazenados criptografados. A senha não será exibida novamente.</Typography>
      {profile?.certificate_ready && <Alert severity="success">Certificado cadastrado · CNPJ do modelo: {profile.cnpj} · Validade: {profile.certificate_expires_at?.slice(0, 10)}</Alert>}
      <Button component="label" variant="outlined">{certificate ? certificate.name : 'Selecionar certificado A1 (.pfx ou .p12)'}<input hidden type="file" accept=".pfx,.p12" onChange={e => setCertificate(e.target.files[0] || null)} /></Button>
      <TextField label="Senha do certificado" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} disabled={!certificate} />
      <Button component="label" variant="outlined">{template ? template.name : 'Selecionar XML-modelo de NFS-e'}<input hidden type="file" accept=".xml" onChange={e => setTemplate(e.target.files[0] || null)} /></Button>
      <Typography variant="body2" color="text.secondary">Use um XML da sua empresa com os parâmetros fiscais já conferidos. Cliente, endereço, valor, descrição e parâmetros fiscais ficam salvos como modelo reutilizável por CNPJ. Próxima DPS: {profile?.next_number || 1}.</Typography>
      {presets.length > 0 && <Box><Typography fontWeight={700} mb={1}>Modelos por cliente</Typography>{presets.map(item => <Typography key={item.cnpj} variant="body2">{item.cnpj} · {item.name} · {money(Number(item.amount) * 100)}</Typography>)}</Box>}
      {profile?.template_ready && !presets.length && <Alert severity="info">Importe novamente seu XML para recuperar os dados do cliente e criar o primeiro modelo. Não precisa reenviar o certificado.</Alert>}
      <TextField label="Série da API" type="number" value={series} onChange={e => setSeries(e.target.value)} inputProps={{ min: 1, max: 49999 }} />
      <Button variant="contained" type="submit" disabled={busy}>Salvar configuração</Button>
    </Stack></Paper>}
  </Box>;
}
