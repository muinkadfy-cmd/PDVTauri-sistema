# 🚀 Deploy no Cloudflare Pages

Este documento descreve como fazer deploy do Smart Tech no Cloudflare Pages.

## 📋 Pré-requisitos

1. Conta no Cloudflare
2. Repositório Git (GitHub, GitLab ou Bitbucket)
3. Projeto configurado com variáveis de ambiente

## 🔧 Configuração

### 1. Variáveis de Ambiente

No painel do Cloudflare Pages, configure as seguintes variáveis de ambiente:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
VITE_STORE_ID=550e8400-e29b-41d4-a716-446655440000
```

**Como configurar:**
1. Acesse seu projeto no Cloudflare Pages
2. Vá em **Settings** > **Environment variables**
3. Adicione cada variável acima
4. Certifique-se de marcar para **Production**, **Preview** e **Development** conforme necessário

### 2. Configuração de Build

No painel do Cloudflare Pages:

- **Build command:** `npm ci && npm run build`
- **Build output directory:** `dist`
- **Root directory:** `/` (raiz do projeto)

### 3. Framework Preset

- **Framework preset:** Vite (ou None, se Vite não estiver disponível)

## 📁 Arquivos Importantes

### `public/_redirects`

Este arquivo garante que rotas SPA funcionem corretamente (evita 404 ao recarregar páginas):

```
/* /index.html 200
```

### `vite.config.ts`

O Vite já está configurado para:
- Base path correto
- PWA com service worker
- Assets otimizados

## 🔄 Processo de Deploy

### Deploy Automático (Recomendado)

1. Conecte seu repositório Git ao Cloudflare Pages
2. Configure as variáveis de ambiente
3. Faça push para a branch principal
4. O Cloudflare Pages fará build e deploy automaticamente

### Deploy Manual

1. Faça build local: `npm run build`
2. No painel do Cloudflare Pages, vá em **Deployments**
3. Clique em **Upload assets**
4. Faça upload da pasta `dist`

## ✅ Validação Pós-Deploy

Após o deploy, verifique:

1. ✅ Aplicação carrega corretamente
2. ✅ Rotas SPA funcionam (teste recarregar `/clientes`, `/vendas`, etc)
3. ✅ PWA funciona (ícones, manifest, service worker)
4. ✅ Variáveis de ambiente estão sendo lidas corretamente
5. ✅ Supabase está conectado
6. ✅ Licenças podem ser ativadas

## 🐛 Troubleshooting

### Problema: 404 ao recarregar rotas

**Solução:** Verifique se `public/_redirects` existe e contém `/* /index.html 200`

### Problema: Variáveis de ambiente não funcionam

**Solução:** 
- Verifique se as variáveis estão configuradas no painel
- Certifique-se de que começam com `VITE_`
- Faça novo deploy após adicionar variáveis

### Problema: Build falha

**Solução:**
- Verifique logs de build no Cloudflare Pages
- Teste build local: `npm run build`
- Verifique se todas as dependências estão no `package.json`

### Problema: PWA não funciona

**Solução:**
- Verifique se `manifest.webmanifest` está em `public/`
- Verifique se ícones estão em `public/`
- Verifique se service worker está sendo gerado (`dist/sw.js`)

## 📝 Notas Importantes

- **Nunca** commite `.env.local` no Git
- Use `.env.example` como referência
- Variáveis de ambiente devem ser configuradas no painel do Cloudflare Pages
- O arquivo `_redirects` é necessário para SPA funcionar corretamente

## 🔗 Links Úteis

- [Documentação Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Configuração de Variáveis de Ambiente](https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables)
