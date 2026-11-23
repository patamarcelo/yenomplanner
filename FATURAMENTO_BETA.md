# Faturamento beta

Rota `/faturamento`, acessível pelo ícone monetário no menu. Abas: emissão de NFS-e, notas emitidas, contas a receber e configurações.

Compile com `VITE_API_BASE_URL` apontando para o backend **de homologação**. A página usa a autenticação Token existente e as APIs `/yenomplanner/billing/`. Consulte `NFSE_HOMOLOGACAO.md` no repositório valutech para migrações, chave de criptografia e worker.

Certificado e senha são enviados ao backend somente no cadastro; não são salvos no navegador. O backend os armazena criptografados por usuário. A consulta opcional de CNPJ chama BrasilAPI diretamente do navegador, sem enviar certificado ou senha.

Notas autorizadas geram recebíveis previstos. Nesta beta, o recebimento é simulado e não altera contas reais. Produção permanece desabilitada no backend.

Verificações: `npm run build`; `node --test --test-isolation=none tests/*.test.js`; ESLint dos arquivos novos; renderização das quatro abas em 1440px e 402px com respostas API simuladas.
