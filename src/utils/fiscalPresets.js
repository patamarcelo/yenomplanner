export function applyFiscalPreset(form, preset) {
  return {
    ...form, preset_cnpj: preset.cnpj, cnpj: preset.cnpj, name: preset.name,
    amount: preset.amount || '', description: preset.description || '',
    ...Object.fromEntries(['codigoMunicipioIbge', 'cep', 'logradouro', 'numero', 'bairro', 'complemento'].map(key => [key, preset.address?.[key] || ''])),
  };
}

export function clearFiscalPreset(form, cnpj = '') {
  return { ...applyFiscalPreset(form, { cnpj, name: '', address: {} }), preset_cnpj: '' };
}
