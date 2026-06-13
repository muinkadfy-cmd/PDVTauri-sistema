# 📦 Guia de Venda e Deploy Multi-Cliente - Smart Tech

## 🎯 Visão Geral

Este guia explica como preparar e fazer deploy do Smart Tech para múltiplos clientes, cada um com sua própria instância isolada.

---

## 🏗️ Arquitetura Multi-Tenant

### CLIENT_ID (Identidade do Cliente)

Cada cliente tem um **CLIENT_ID** único que:
- Isola dados no LocalStorage (prefixo `client_{CLIENT_ID}_`)
- Permite múltiplos deploys (um por cliente)
- Garante que dados não se misturem

### Formato do CLIENT_ID

- Apenas letras minúsculas, números, hífens e underscores
- Exemplos: `cliente_001`, `loja_abc`, `empresa_xyz`

---

## 🚀 Deploy por Cliente

### Opção 1: Deploy Individual (Recomendado)

Cada cliente recebe sua própria instância com CLIENT_ID fixo.

#### Passo 1: Configurar Variável de Ambiente

Crie um arquivo `.env.production` ou configure no CI/CD:

```bash
VITE_CLIENT_ID=cliente_001
```

#### Passo 2: Build

```bash
npm install
npm run build:prod
```

#### Passo 3: Deploy

O diretório `dist/` contém a aplicação pronta para deploy.

---

### Opção 2: Cloudflare Pages (Multi-Deploy)

#### Setup Inicial

1. **Fork/Clone do repositório** para cada cliente
2. **Configurar variável de ambiente** no Cloudflare Pages:
   - Settings → Environment Variables
   - Adicionar: `VITE_CLIENT_ID` = `cliente_001`

#### Deploy Automático

1. Conectar repositório ao Cloudflare Pages
2. Configurar build:
   - **Build command:** `npm run build:prod`
   - **Build output directory:** `dist`
   - **Root directory:** `/`

3. Adicionar variável de ambiente:
   - `VITE_CLIENT_ID` = `cliente_001` (ou o ID do cliente)

#### Deploy Manual

```bash
# 1. Configurar .env.production
echo "VITE_CLIENT_ID=cliente_001" > .env.production

# 2. Build
npm run build:prod

# 3. Fazer upload do diretório dist/ para Cloudflare Pages
```

---

## 📋 Checklist de Deploy

### Antes do Deploy:

- [ ] CLIENT_ID definido (via `.env.production` ou Cloudflare)
- [ ] Build testado localmente: `npm run build:prod`
- [ ] Preview testado: `npm run preview:prod`
- [ ] Verificar que `/setup` funciona (se CLIENT_ID não estiver definido)
- [ ] Verificar que dados são isolados por CLIENT_ID

### Após Deploy:

- [ ] Acessar aplicação e verificar que CLIENT_ID está configurado
- [ ] Criar dados de teste e verificar isolamento
- [ ] Testar backup/restore
- [ ] Verificar PWA (instalação, ícones, manifest)

---

## 🔧 Configuração de Variáveis de Ambiente

### Desenvolvimento

Crie `.env.local`:

```bash
VITE_CLIENT_ID=dev_cliente
VITE_STORE_ID=seu-store-id-uuid
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

### Produção

No Cloudflare Pages ou outro serviço:

```bash
VITE_CLIENT_ID=cliente_001
VITE_STORE_ID=seu-store-id-uuid
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

---

## 🎨 Personalização por Cliente

### 1. Nome e Logo

Edite `public/manifest.json` e `index.html`:
- Nome do sistema
- Logo/ícones
- Cores (theme_color)

### 2. Configurações Específicas

Crie arquivo `src/config/client.ts`:

```typescript
export const CLIENT_CONFIG = {
  name: import.meta.env.VITE_CLIENT_NAME || 'Smart Tech',
  logo: import.meta.env.VITE_CLIENT_LOGO || '/logo.png',
  // ... outras configs
};
```

---

## 📊 Estrutura de Dados por Cliente

### LocalStorage (Prefixado)

Todos os dados são prefixados com `client_{CLIENT_ID}_`:

```
client_cliente_001_smart-tech-clientes
client_cliente_001_smart-tech-produtos
client_cliente_001_smart-tech-vendas
...
```

### Backup

O backup inclui o CLIENT_ID e pode ser restaurado apenas no mesmo cliente (ou com confirmação).

---

## 🔐 Segurança

### Isolamento de Dados

- ✅ Dados isolados por CLIENT_ID no LocalStorage
- ✅ Backup inclui CLIENT_ID e valida na restauração
- ✅ Não há risco de misturar dados entre clientes

### Recomendações

1. **Nunca compartilhe** o mesmo CLIENT_ID entre clientes
2. **Use CLIENT_ID único** e descritivo
3. **Backup regular** de cada cliente
4. **Valide CLIENT_ID** antes de restaurar backup

---

## 🚨 Troubleshooting

### Problema: Dados não aparecem após deploy

**Solução:**
- Verificar se CLIENT_ID está configurado corretamente
- Verificar console do navegador para erros
- Limpar cache do navegador e recarregar

### Problema: Backup não restaura

**Solução:**
- Verificar se CLIENT_ID do backup corresponde ao atual
- Verificar estrutura do arquivo JSON
- Verificar console para erros de validação

### Problema: Build falha

**Solução:**
- Verificar se todas as dependências estão instaladas
- Verificar se TypeScript não tem erros: `npm run type-check`
- Verificar logs de build para erros específicos

---

## 📝 Exemplo de Deploy Completo

### Cliente: "Loja ABC"

1. **Configurar .env.production:**
   ```bash
   VITE_CLIENT_ID=loja_abc
   VITE_STORE_ID=123e4567-e89b-12d3-a456-426614174000
   ```

2. **Build:**
   ```bash
   npm run build:prod
   ```

3. **Deploy no Cloudflare Pages:**
   - Criar novo projeto
   - Conectar repositório
   - Configurar variáveis de ambiente
   - Deploy automático via Git

4. **URL resultante:**
   - `https://loja-abc-smarttech.pages.dev`

5. **Testar:**
   - Acessar URL
   - Verificar que CLIENT_ID está configurado
   - Criar dados de teste
   - Fazer backup e restaurar

---

## ✅ Checklist Final

- [ ] CLIENT_ID configurado
- [ ] Build passa sem erros
- [ ] Preview funciona localmente
- [ ] Deploy realizado
- [ ] Aplicação acessível
- [ ] Dados isolados corretamente
- [ ] Backup/restore funcionando
- [ ] PWA instalável

---

**Versão:** 1.0.0  
**Data:** 2026-01-22
