import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, FormControlLabel, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import http from '../api/http';
import { applyFiscalPreset, clearFiscalPreset } from '../utils/fiscalPresets';

const base = '/yenomplanner/billing/';
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const daysAgo = days => { const date = new Date(); date.setDate(date.getDate() - days); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const money = value => (Number(value) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const labels = { queued: 'Na fila', processing: 'Processando', uncertain: 'Aguardando consulta', authorized: 'Autorizada', failed: 'Falha na preparação', planned: 'Previsto', paid: 'Recebido' };
const initial = () => ({ idempotency_key: crypto.randomUUID(), competence: today(), issueDate: today(), dueDate: today(), amount: '', description: '', cnpj: '', name: '', codigoMunicipioIbge: '', cep: '', logradouro: '', numero: '', bairro: '', complemento: '', preset_cnpj: '' });
const errorText = error => error.response?.data?.detail || error.message || 'Não foi possível concluir. Verifique a conexão e tente novamente.';

export default function BillingPage() {
  const initializedPreset = useRef(false);
  const [tab, setTab] = useState(0);
  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [filters, setFilters] = useState({ customer: '', start: daysAgo(90), end: today(), environment: 'producao' });
  const [presetAmounts, setPresetAmounts] = useState({});
  const [receivables, setReceivables] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(initial);
  const [certificate, setCertificate] = useState(null);
  const [template, setTemplate] = useState(null);
  const [password, setPassword] = useState('');
  const [series, setSeries] = useState('1');
  const [history, setHistory] = useState(null);
  const [environment, setEnvironment] = useState('restrita');
  const [confirmProduction, setConfirmProduction] = useState(false);
  const [payment, setPayment] = useState({ account_id: '', paid_at: today() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = useCallback(async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const [p, d, c, r, a] = await Promise.all([
      http.get(base + 'profile/'), http.get(base + 'documents/', { params }),
      http.get(base + 'documents/', { params: { customers: 1 } }),
      http.get(base + 'receivables/'), http.get('/yenomplanner/accounts/')]);
    if (!initializedPreset.current && p.data.customer_templates?.length) {
      initializedPreset.current = true;
      setForm(old => old.cnpj ? old : applyFiscalPreset(old, p.data.customer_templates[0]));
    }
    setProfile(p.data); setSeries(String(p.data.series)); setDocuments(d.data); setCustomers(c.data); setReceivables(r.data);
    setAccounts((a.data.results || a.data).filter(account => account.type === 'checking'));
  }, [filters]);
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
  const saveConfig = (kind, cnpj) => run(async () => {
      const data = new FormData(); data.append('series', kind === 'history' ? series : String(profile?.series ?? 1));
      if (kind === 'certificate') { data.append('certificate', certificate); data.append('password', password); }
      if (kind === 'template') data.append('template', template);
      if (kind === 'history') data.append('history', history);
      if (kind === 'amount') { data.append('preset_amount_cnpj', cnpj); data.append('preset_amount', presetAmounts[cnpj] ?? ''); }
      const saved = await http.post(base + 'profile/', data);
      if (kind === 'template' && saved.data.customer_templates?.length) {
        initializedPreset.current = true;
        setForm(old => applyFiscalPreset(old, saved.data.customer_templates.at(-1)));
      }
      if (kind === 'certificate') { setPassword(''); setCertificate(null); }
      if (kind === 'template') setTemplate(null);
      if (kind === 'history') setHistory(null);
      if (kind === 'amount') {
        const savedAmount = saved.data.customer_templates.find(item => item.cnpj === cnpj)?.amount;
        setForm(old => old.preset_cnpj === cnpj ? { ...old, amount: savedAmount ?? old.amount } : old);
        setPresetAmounts(old => { const next = { ...old }; delete next[cnpj]; return next; });
      }
      setSuccess('Configuração salva.');
    });
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
      await http.post(base + 'documents/', { ...form, environment, confirm_production: environment === 'producao' && confirmProduction, customer: { cnpj: form.cnpj, name: form.name, address: Object.fromEntries(['codigoMunicipioIbge', 'cep', 'logradouro', 'numero', 'bairro', 'complemento'].map(key => [key, form[key]])) } });
      setConfirmProduction(false);
      setForm(old => { const preset = profile?.customer_templates?.find(item => item.cnpj === old.preset_cnpj); return preset ? applyFiscalPreset(initial(), preset) : initial(); }); setSuccess('Solicitação recebida. Acompanhe o resultado na lista de notas.');
    });
  };
  const download = (doc, extension = 'xml') => run(async () => {
    const response = await http.get(base + `documents/${doc.id}/${extension}/`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data); const a = document.createElement('a');
    a.href = url; a.download = extension === 'signed' ? `DPS-${doc.environment}-${doc.number}-assinada.xml` : `nfse-${doc.environment}-${doc.number}.${extension}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const presets = profile?.customer_templates || [];
  const selectedPreset = presets.find(item => item.cnpj === form.preset_cnpj);
  return <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 1, md: 3 } }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
      <Typography variant="h5" fontWeight={800}>Faturamento</Typography><Chip label="NFS-e" color="primary" />
    </Stack>
    <Alert severity="info" sx={{ mb: 2 }}>Escolha o ambiente antes de emitir. Em produção, a nota é real; o saldo só muda quando você registrar o recebimento.</Alert>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{String(error)}</Alert>}
    {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
    <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
      <Tab label="Emitir NFS-e" /><Tab label="Notas emitidas" /><Tab label="Contas a receber" /><Tab label="Configurações" />
    </Tabs>
    {busy && <CircularProgress size={24} sx={{ mb: 2 }} />}
    {tab === 0 && <Paper component="form" onSubmit={emit} sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h6" mb={2}>Nova nota de serviço</Typography>
      {!profile?.certificate_ready && <Alert severity="warning" sx={{ mb: 2 }}>Cadastre o certificado A1 e o XML-modelo em Configurações.</Alert>}
      <TextField select fullWidth label="Ambiente" value={environment} onChange={e => { setEnvironment(e.target.value); setConfirmProduction(false); }} sx={{ mb: 2 }}>
        <MenuItem value="restrita">Homologação · teste</MenuItem><MenuItem value="producao">Produção · nota real</MenuItem>
      </TextField>
      {environment === 'producao' && <Alert severity="warning" sx={{ mb: 2 }}>Próxima DPS de produção: {profile?.production_next_number ?? 'histórico pendente'}. Série {profile?.series}. Confira CNPJ, tomador, valor e dados fiscais antes de emitir.</Alert>}
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
        {environment === 'producao' && <FormControlLabel control={<Checkbox checked={confirmProduction} onChange={e => setConfirmProduction(e.target.checked)} />} label="Confirmei os dados e autorizo a emissão real desta NFS-e" />}
        <Button type="submit" variant="contained" disabled={busy || !profile?.certificate_ready || !profile?.template_ready || (environment === 'producao' && (!profile?.production_next_number || !confirmProduction))}>Emitir em {environment === 'producao' ? 'produção' : 'homologação'}</Button>
      </Stack>
    </Paper>}
    {tab === 1 && <Stack spacing={2}>
      <Paper sx={{ p: 2 }}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
        <TextField select label="Favorecido" value={filters.customer} onChange={e => setFilters(old => ({ ...old, customer: e.target.value }))} fullWidth>
          <MenuItem value="">Todos os favorecidos</MenuItem>{customers.map(item => <MenuItem key={item.cnpj} value={item.cnpj}>{item.name} · {item.cnpj}</MenuItem>)}
        </TextField>
        <TextField type="date" label="Período inicial" value={filters.start} onChange={e => setFilters(old => ({ ...old, start: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
        <TextField type="date" label="Período final" value={filters.end} onChange={e => setFilters(old => ({ ...old, end: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
        <TextField select label="Ambiente" value={filters.environment} onChange={e => setFilters(old => ({ ...old, environment: e.target.value }))} fullWidth>
          <MenuItem value="">Todos</MenuItem><MenuItem value="producao">Produção</MenuItem><MenuItem value="restrita">Homologação</MenuItem>
        </TextField>
      </Box></Paper>
      <Button onClick={() => run(load)} disabled={busy} sx={{ alignSelf: 'end' }}>Atualizar</Button>
      {!documents.length && <Typography color="text.secondary">Nenhuma nota encontrada neste período.</Typography>}
      {documents.map(doc => <Paper key={doc.id} sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap"><Typography fontWeight={700}>NFS-e #{doc.number} · {doc.request.customer.name}</Typography><Stack direction="row" spacing={1}><Chip size="small" label={doc.environment === 'producao' ? 'Produção' : 'Teste'} /><Chip size="small" label={labels[doc.status] || doc.status} color={doc.status === 'authorized' ? 'success' : 'default'} /></Stack></Stack>
        <Typography mt={1}>{money(Number(doc.request.amount) * 100)} · Competência: {doc.request.competence}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{doc.dps_id}</Typography>
        {doc.message && <Alert severity="warning" sx={{ mt: 1 }}>{doc.message}</Alert>}
        {['failed', 'uncertain'].includes(doc.status) && <Button onClick={() => download(doc, 'signed')} disabled={busy}>Baixar DPS assinada</Button>}
        {doc.status === 'authorized' && <><Button onClick={() => download(doc)} disabled={busy}>Baixar XML</Button><Button onClick={() => download(doc, 'pdf')} disabled={busy}>Baixar PDF</Button></>}
        {['uncertain', 'processing'].includes(doc.status) && <Button disabled={busy} onClick={() => run(() => http.post(base + `documents/${doc.id}/reconcile/`))}>Consultar autorização</Button>}
        {['uncertain', 'failed'].includes(doc.status) && <Button disabled={busy} color="warning" onClick={() => run(async () => { const result = await http.post(base + `documents/${doc.id}/recover/`); setSuccess(result.data.status === 'authorized' ? 'Nota recuperada e autorizada.' : 'A SEFIN recusou o reenvio da mesma DPS.'); })}>Reconsultar e reenviar esta DPS</Button>}
      </Paper>)}
    </Stack>}
    {tab === 2 && <Stack spacing={2}>
      <Alert severity="info">A nota autorizada cria um recebível previsto. A baixa de notas de produção gera uma receita na conta escolhida; a baixa de testes não altera o saldo.</Alert>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField select fullWidth label="Conta de recebimento" value={payment.account_id} onChange={e => setPayment(old => ({ ...old, account_id: e.target.value }))}>{accounts.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField>
        <TextField fullWidth type="date" label="Data do recebimento" slotProps={{ inputLabel: { shrink: true } }} value={payment.paid_at} onChange={e => setPayment(old => ({ ...old, paid_at: e.target.value }))} />
      </Stack>
      {!receivables.length && <Typography color="text.secondary">Nenhum recebível. Ele será criado após a autorização da nota.</Typography>}
      {receivables.map(row => <Paper key={row.id} sx={{ p: 2 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2}>
        <Box><Typography fontWeight={700}>{row.customer}</Typography><Typography>{money(row.amount_cents)} · Vencimento: {row.due_date}</Typography><Chip size="small" label={row.environment === 'producao' ? 'Produção' : 'Teste'} sx={{ mr: 1 }} /><Chip size="small" label={labels[row.status]} /></Box>
        {row.status !== 'paid' && <Button variant="outlined" disabled={busy || !payment.account_id} onClick={() => run(async () => { await http.post(base + `receivables/${row.id}/receive/`, payment); setSuccess('Recebimento registrado.'); })}>Registrar recebimento{row.environment === 'restrita' ? ' de teste' : ''}</Button>}
      </Stack></Paper>)}
    </Stack>}
    {tab === 3 && <Stack spacing={2}>
      <Paper sx={{ p: { xs: 2, md: 3 } }}><Stack spacing={2}>
        <Typography variant="h6">Certificado digital</Typography>
        <Typography color="text.secondary">O certificado e a senha ficam criptografados no servidor. A senha não será exibida novamente.</Typography>
        {profile?.certificate_ready && <Alert severity="success">Certificado cadastrado · CNPJ: {profile.cnpj} · Validade: {profile.certificate_expires_at?.slice(0, 10)}</Alert>}
        <Button component="label" variant="outlined">{certificate ? certificate.name : 'Selecionar certificado A1 (.pfx ou .p12)'}<input hidden type="file" accept=".pfx,.p12" onChange={e => setCertificate(e.target.files[0] || null)} /></Button>
        <TextField label="Senha do certificado" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} disabled={!certificate} />
        <Button variant="contained" disabled={busy || !certificate || !password} onClick={() => saveConfig('certificate')}>Salvar certificado</Button>
      </Stack></Paper>
      <Paper sx={{ p: { xs: 2, md: 3 } }}><Stack spacing={2}>
        <Typography variant="h6">Modelo XML e valores sugeridos</Typography>
        <Typography variant="body2" color="text.secondary">O XML mantém os dados fiscais e do cliente. O valor de cada modelo é apenas uma sugestão no formulário de emissão.</Typography>
        <Button component="label" variant="outlined">{template ? template.name : 'Selecionar XML-modelo de NFS-e'}<input hidden type="file" accept=".xml" onChange={e => setTemplate(e.target.files[0] || null)} /></Button>
        <Button variant="contained" disabled={busy || !template} onClick={() => saveConfig('template')}>Importar modelo XML</Button>
        {presets.length > 0 && <Stack spacing={2}><Typography fontWeight={700}>Modelos por cliente</Typography>{presets.map(item => <Stack key={item.cnpj} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          <Typography sx={{ flex: 1 }}>{item.name} · {item.cnpj}</Typography>
          <TextField label="Valor sugerido (R$)" type="number" size="small" value={presetAmounts[item.cnpj] ?? item.amount ?? ''} onChange={e => setPresetAmounts(old => ({ ...old, [item.cnpj]: e.target.value }))} inputProps={{ min: '0.01', step: '0.01' }} sx={{ width: { xs: '100%', sm: 200 } }} />
          <Button variant="outlined" disabled={busy || presetAmounts[item.cnpj] === undefined} onClick={() => saveConfig('amount', item.cnpj)}>Salvar valor</Button>
        </Stack>)}</Stack>}
        {profile?.template_ready && !presets.length && <Alert severity="info">Importe novamente seu XML para recuperar os dados do cliente e criar o primeiro modelo. Não precisa reenviar o certificado.</Alert>}
      </Stack></Paper>
      <Paper sx={{ p: { xs: 2, md: 3 } }}><Stack spacing={2}>
        <Typography variant="h6">Histórico e sequência de emissão</Typography>
        <Typography variant="body2">Importe o histórico JSON do emissor local. O sistema confere CNPJ e série e calcula a próxima DPS de produção; o arquivo não é armazenado.</Typography>
        <TextField label="Série da API" type="number" value={series} onChange={e => setSeries(e.target.value)} inputProps={{ min: 1, max: 49999 }} />
        <Button component="label" variant="outlined">{history ? history.name : 'Selecionar histórico de emissões (.json)'}<input hidden type="file" accept=".json,application/json" onChange={e => setHistory(e.target.files[0] || null)} /></Button>
        <Typography variant="body2">Próxima DPS de produção: {profile?.production_next_number ?? 'aguardando histórico'}. Próxima DPS de homologação: {profile?.next_number ?? 1}.</Typography>
        <Button variant="contained" disabled={busy || !history} onClick={() => saveConfig('history')}>Importar histórico</Button>
      </Stack></Paper>
    </Stack>}
  </Box>;
}
