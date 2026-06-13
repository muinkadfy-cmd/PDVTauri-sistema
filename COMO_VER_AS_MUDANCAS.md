# 🚀 COMO VER AS MUDANÇAS - GUIA RÁPIDO

**Data:** 31/01/2026  
**Problema:** Não consigo ver as mudanças implementadas

---

## ⚡ SOLUÇÃO RÁPIDA (3 PASSOS)

### **1️⃣ SERVIDOR DE DESENVOLVIMENTO**

O servidor dev foi iniciado automaticamente!

**Verifique se está rodando:**
- Abra o navegador
- Vá para: `http://localhost:5173`
- Ou: `http://localhost:5174` (se 5173 estiver ocupado)

---

### **2️⃣ LIMPAR CACHE DO NAVEGADOR**

**IMPORTANTE:** Cache pode estar bloqueando as mudanças!

**Chrome/Edge:**
1. Pressione `Ctrl + Shift + R` (hard refresh)
2. Ou: `Ctrl + F5`
3. Ou: Abra DevTools (`F12`) → Clique com botão direito no ícone de refresh → "Esvaziar cache e atualizar"

**Firefox:**
1. Pressione `Ctrl + Shift + R`
2. Ou: `Ctrl + F5`

---

### **3️⃣ VERIFICAR NO CONSOLE**

Abra o Console do navegador (`F12`) e verifique:

```javascript
// Você deve ver as novas funções
console.log(window.location.pathname);
```

---

## 📋 CHECKLIST - O QUE VOCÊ DEVE VER

### ✅ **1. IDs Visuais Profissionais**

**Ordens de Serviço:**
- ❌ Antes: `OS #numero` ou `#5b6c`
- ✅ Agora: `OS-0001`, `OS-0023`, `OS-0456`

**Vendas:**
- ❌ Antes: `Venda #5b6c`
- ✅ Agora: `V-0001`, `V-0045`, `V-0123`

**Como testar:**
1. Vá em "Ordens de Serviço"
2. Veja a lista de ordens
3. Deve aparecer `OS-0001` em vez de `OS #numero`

---

### ✅ **2. WhatsApp em TODAS as Páginas**

**Você deve ver botão WhatsApp (💬) em:**
- ✅ Vendas (listagem)
- ✅ Ordens de Serviço (listagem)
- ✅ Recibos (listagem)
- ✅ Cobranças (listagem)
- ✅ Encomendas (listagem)
- ✅ Devoluções (listagem)
- ✅ **Venda Usados** (após vender) ← NOVO!
- ✅ **Compra Usados** (após comprar) ← NOVO!

**Como testar:**
1. Vá em "Venda de Usados"
2. Registre uma venda
3. Após confirmar, deve aparecer botão "💬 WhatsApp" junto com "🖨️ Imprimir"

---

### ✅ **3. Backup Completo (15 tabelas)**

**Como testar:**
1. Vá em "Backup e Restauração"
2. Clique em "Fazer Backup"
3. Baixe o arquivo JSON
4. Abra o arquivo e verifique que tem **15 tabelas**:
   - clientes
   - produtos
   - vendas
   - ordens
   - financeiro
   - cobrancas
   - devolucoes
   - encomendas
   - recibos
   - codigos
   - **settings** ← NOVO!
   - **pessoas** ← NOVO!
   - **usados** ← NOVO!
   - **usadosVendas** ← NOVO!
   - **usadosArquivos** ← NOVO!

---

## 🔧 PROBLEMAS COMUNS E SOLUÇÕES

### **Problema 1: Servidor não está rodando**

**Sintomas:**
- Página não carrega
- `ERR_CONNECTION_REFUSED`

**Solução:**
```bash
# Parar qualquer servidor rodando
Ctrl + C

# Limpar cache de build
npm run clean

# Reinstalar dependências (se necessário)
npm install

# Iniciar servidor
npm run dev
```

---

### **Problema 2: Cache do navegador**

**Sintomas:**
- Mudanças não aparecem
- Versão antiga do sistema

**Solução:**
1. `Ctrl + Shift + Delete` (Limpar dados de navegação)
2. Marcar "Imagens e arquivos em cache"
3. Clicar "Limpar dados"
4. Recarregar: `Ctrl + Shift + R`

---

### **Problema 3: Porta ocupada**

**Sintomas:**
- Erro: "Port 5173 is already in use"

**Solução:**
```bash
# Matar processo na porta 5173
npx kill-port 5173

# Ou usar outra porta
npm run dev -- --port 5174
```

---

### **Problema 4: Versão antiga do build**

**Sintomas:**
- Mudanças aparecem no dev mas não em produção

**Solução:**
```bash
# Fazer novo build
npm run build

# Verificar build
npm run preview
```

---

## 🔍 VERIFICAÇÃO DETALHADA

### **Passo 1: Confirmar commits**

```bash
# Ver últimos commits
git log --oneline -5

# Deve mostrar:
# 2c38b33 feat: implementar ids visuais profissionais
# ca63687 fix: corrigir backup incompleto
# e19ecdc feat: adicionar whatsapp em TODO o sistema
```

### **Passo 2: Verificar arquivos modificados**

```bash
# Ver mudanças do último commit
git show --stat

# Deve mostrar:
# src/lib/format-display-id.ts (novo)
# src/pages/OrdensPage.tsx (modificado)
# src/pages/VendasPage.tsx (modificado)
# ...
```

### **Passo 3: Verificar servidor dev**

```bash
# Verificar se está rodando
curl http://localhost:5173

# Deve retornar HTML
```

---

## 🎯 TESTE COMPLETO

### **Teste 1: IDs Visuais**

1. ✅ Abrir "Ordens de Serviço"
2. ✅ Criar nova OS
3. ✅ Ver na lista: `OS-0001` (não `#numero`)
4. ✅ Imprimir: deve mostrar `OS-0001` no comprovante

### **Teste 2: WhatsApp Usados**

1. ✅ Abrir "Venda de Usados"
2. ✅ Selecionar item em estoque
3. ✅ Preencher comprador e valor
4. ✅ Confirmar venda
5. ✅ Ver botão "💬 WhatsApp" aparecer
6. ✅ Clicar e verificar mensagem pré-preenchida

### **Teste 3: Backup Completo**

1. ✅ Abrir "Backup e Restauração"
2. ✅ Fazer backup
3. ✅ Abrir arquivo JSON
4. ✅ Buscar por "usados": deve encontrar
5. ✅ Buscar por "pessoas": deve encontrar

---

## 💡 DICAS IMPORTANTES

### **1. Use modo anônimo do navegador**

Para testar sem cache:
- Chrome: `Ctrl + Shift + N`
- Firefox: `Ctrl + Shift + P`
- Edge: `Ctrl + Shift + N`

### **2. Verifique o ambiente**

Certifique-se que está em:
- ✅ `http://localhost:5173` (dev)
- ❌ **NÃO** em produção/build antigo

### **3. Console do navegador**

Abra (`F12`) e verifique:
- ✅ Sem erros JavaScript
- ✅ Arquivos carregados corretamente
- ✅ Network mostrando status 200

---

## 🚨 SE NADA FUNCIONAR

### **Última tentativa - Restart completo:**

```bash
# 1. Parar servidor (Ctrl + C)

# 2. Limpar tudo
rm -rf node_modules
rm -rf dist
rm package-lock.json

# 3. Reinstalar
npm install

# 4. Build limpo
npm run build

# 5. Iniciar dev
npm run dev

# 6. No navegador: Ctrl + Shift + Delete → Limpar cache → Ctrl + Shift + R
```

---

## ✅ CHECKLIST FINAL

Antes de pedir ajuda, verifique:

```
□ ✅ Servidor dev está rodando? (npm run dev)
□ ✅ URL correta? (localhost:5173)
□ ✅ Cache limpo? (Ctrl + Shift + R)
□ ✅ Console sem erros? (F12)
□ ✅ Commits aplicados? (git log)
□ ✅ Arquivos modificados? (git diff)
```

---

## 📞 SUPORTE

Se ainda não funcionar, me avise com:

1. **URL que está acessando:** `http://localhost:????`
2. **Erros no console:** Captura de tela do F12
3. **Versão do commit:** Resultado de `git log -1`
4. **Servidor rodando:** Sim/Não

---

## 🎊 RESULTADO ESPERADO

Após seguir este guia, você deve ver:

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ✅ IDs profissionais: OS-0001, V-0045                 ║
║   ✅ WhatsApp em todas páginas (8/8)                    ║
║   ✅ Backup completo (15 tabelas)                       ║
║   ✅ Sistema funcionando 100%                           ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

---

**📅 Data:** 31/01/2026  
**🏆 Status:** GUIA COMPLETO  
**🎯 Objetivo:** Ver as mudanças implementadas

© 2026 - PDV Smart Tech - Guia de Troubleshooting v1.0
