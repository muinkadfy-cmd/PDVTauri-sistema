# 🚀 INSTRUÇÕES DE DEPLOY - PRODUÇÃO

**Data:** 2026-01-22  
**Sistema:** Smart Tech - Build Final

---

## 📋 PRÉ-REQUISITOS

### 1. Supabase Configurado
- [ ] Projeto criado no Supabase
- [ ] URL e Anon Key obtidos
- [ ] Tabelas criadas (executar SQL scripts)

### 2. Variáveis de Ambiente
Criar arquivo `.env.production`:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
VITE_STORE_ID=seu-store-id (opcional)
```

### 3. Build Local
```bash
npm install
npm run build
```

---

## 🔧 SCRIPTS SQL (SUPABASE)

### 1. Executar no Supabase SQL Editor

**Arquivo:** `adicionar_store_id.sql`
- Cria todas as tabelas necessárias
- Adiciona coluna `store_id` em todas as tabelas
- Cria índices para performance

**Arquivo:** `criar_tabela_financeiro.sql`
- Cria tabela `financeiro` se não existir
- Adiciona `store_id` e índices

### 2. Verificar Tabelas
Após executar os scripts, verificar se existem:
- `clientes`
- `produtos`
- `ordens_servico`
- `vendas`
- `venda_itens`
- `financeiro`

---

## 📦 BUILD DE PRODUÇÃO

### 1. Build
```bash
npm run build
```

### 2. Verificar Build
```bash
# Verificar se dist/ foi criado
ls dist/

# Verificar arquivos principais
ls dist/index.html
ls dist/manifest.webmanifest
ls dist/sw.js
```

### 3. Preview Local
```bash
npm run preview
# Abrir http://localhost:4173
```

---

## 🌐 DEPLOY

### Opção 1: Netlify
1. Conectar repositório
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Adicionar variáveis de ambiente
5. Deploy

### Opção 2: Vercel
1. Conectar repositório
2. Framework: Vite
3. Build command: `npm run build`
4. Output directory: `dist`
5. Adicionar variáveis de ambiente
6. Deploy

### Opção 3: GitHub Pages
1. Instalar `gh-pages`: `npm install --save-dev gh-pages`
2. Adicionar script: `"deploy": "npm run build && gh-pages -d dist"`
3. Executar: `npm run deploy`

### Opção 4: Servidor Próprio
1. Upload da pasta `dist/` para servidor
2. Configurar servidor web (Nginx/Apache)
3. Configurar HTTPS (obrigatório para PWA)
4. Configurar variáveis de ambiente

---

## ✅ PÓS-DEPLOY

### 1. Verificar
- [ ] Site carrega corretamente
- [ ] PWA pode ser instalado
- [ ] Service Worker registrado
- [ ] Sincronização funciona
- [ ] Modo offline funciona

### 2. Testar
- [ ] Criar cliente
- [ ] Criar produto
- [ ] Criar venda
- [ ] Verificar sincronização
- [ ] Testar modo offline

### 3. Monitorar
- [ ] Logs de erro
- [ ] Performance
- [ ] Uso de memória
- [ ] Sincronizações

---

## 🔒 SEGURANÇA

### HTTPS Obrigatório
- PWA requer HTTPS
- Service Worker requer HTTPS
- Use Let's Encrypt (gratuito)

### Variáveis de Ambiente
- Nunca commitar `.env` files
- Usar variáveis do servidor
- Rotacionar chaves periodicamente

---

## 📊 MONITORAMENTO

### Supabase
- Monitorar uso de API
- Verificar logs de erro
- Acompanhar sincronizações

### Performance
- Lighthouse Score
- Core Web Vitals
- Error tracking (Sentry opcional)

---

## ✅ CHECKLIST FINAL

- [ ] Supabase configurado
- [ ] Variáveis de ambiente configuradas
- [ ] Build executado com sucesso
- [ ] Deploy realizado
- [ ] HTTPS configurado
- [ ] PWA instalável
- [ ] Sincronização funcionando
- [ ] Testes realizados

---

**Status:** ✅ **PRONTO PARA DEPLOY**
