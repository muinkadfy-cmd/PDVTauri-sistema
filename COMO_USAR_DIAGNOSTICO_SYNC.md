# 🔍 COMO USAR O DIAGNÓSTICO DE SINCRONIZAÇÃO

**Data:** 30/01/2026  
**Problema:** Métricas não atualizam, dados não vão para Supabase

---

## 🎯 O QUE É ESTA FERRAMENTA?

```
Uma página especial que verifica:
✅ Se o Supabase está configurado
✅ Se a autenticação está funcionando
✅ Quantos dados estão no localStorage
✅ Quantos dados estão no Supabase
✅ Se a fila de sincronização (outbox) está travada
✅ Se o RLS (Row Level Security) está bloqueando
```

---

## 🚀 COMO ACESSAR

### **Opção 1: Localhost (Desenvolvimento)**

```
1. Iniciar o servidor: npm run dev
2. Abrir navegador: http://localhost:5173/diagnostico-sync
3. ✅ Página carrega automaticamente
```

### **Opção 2: Cloudflare Pages (Produção)**

```
1. Ir no seu site: https://c6d188e8.pdv-duz.pages.dev/
2. Adicionar na URL: ?dev=true
3. Exemplo: https://c6d188e8.pdv-duz.pages.dev/?dev=true
4. Acessar: /diagnostico-sync
5. URL completa: https://c6d188e8.pdv-duz.pages.dev/diagnostico-sync?dev=true
```

**⚠️ IMPORTANTE:**
```
A rota /diagnostico-sync só funciona em modo DEV.
Se você está no Cloudflare Pages, adicione ?dev=true na URL.
```

---

## 📋 O QUE A FERRAMENTA MOSTRA

### **Teste 1: Configuração do .env.local**

**O que verifica:**
```
✅ VITE_SUPABASE_URL está definida?
✅ VITE_SUPABASE_ANON_KEY está definida?
✅ VITE_STORE_ID é um UUID válido?
```

**Resultado Esperado:**
```
✅ Supabase configurado
   - url: ✅ Configurada
   - anonKey: ✅ Configurada
   - storeId: ✅ 7371cfdc-7df5-4543-95b0-882da2de6ab9
```

**Se aparecer erro:**
```
❌ Supabase NÃO configurado
   → Verificar .env.local
   → Reiniciar servidor (npm run dev)
```

---

### **Teste 2: Autenticação Supabase**

**O que verifica:**
```
✅ Consegue conectar no Supabase?
✅ Usuário está autenticado?
✅ Token está válido?
```

**Resultado Esperado:**
```
✅ Autenticado com sucesso
   - user: seuemail@exemplo.com
   - expires: 30/01/2026 às 20:00
```

**Se aparecer erro:**
```
❌ Falha na autenticação: JWT expirado
   → Recarregar página (F5)
   → Fazer login novamente
```

---

### **Teste 3: Dados no LocalStorage**

**O que verifica:**
```
📦 Quantos registros estão salvos localmente?
```

**Resultado Esperado:**
```
📋 X registros locais
   - vendas: 10
   - financeiro: 25
   - ordens: 5
```

**Interpretação:**
```
✅ Tem dados → LocalStorage funcionando
❌ Sem dados → Criar venda/OS para testar
```

---

### **Teste 4: Outbox (Fila de Sincronização)**

**O que verifica:**
```
📦 Quantos itens estão aguardando sincronização?
```

**Resultado Esperado:**
```
✅ Fila vazia (tudo sincronizado)
   - total: 0
```

**Ou:**
```
📋 5 itens aguardando sincronização
   - total: 5
   - primeiros:
     1. tabela: sales, operação: upsert
     2. tabela: financeiro, operação: upsert
     ...
```

**⚠️ ATENÇÃO:**
```
⚠️ 150 itens pendentes (pode estar travada)
   → Fila muito grande
   → Sincronização pode estar falhando
   → Ver testes 5, 6 e 7 para identificar causa
```

---

### **Teste 5: Dados no Supabase (Vendas)**

**O que verifica:**
```
✅ Quantas vendas estão no Supabase?
✅ Consegue consultar a tabela sales?
```

**Resultado Esperado:**
```
✅ 10 vendas no Supabase
   - count: 10
```

**Se aparecer erro:**
```
❌ Erro ao consultar: new row violates row-level security policy
   → Problema com RLS (Row Level Security)
   → Ver Teste 7
```

**Ou:**
```
❌ Erro ao consultar: relation "sales" does not exist
   → Tabela não existe no Supabase
   → Criar tabela via migration
```

---

### **Teste 6: Dados no Supabase (Financeiro)**

**O que verifica:**
```
✅ Quantos lançamentos financeiros estão no Supabase?
✅ Consegue consultar a tabela financeiro?
```

**Resultado Esperado:**
```
✅ 25 lançamentos no Supabase
   - count: 25
```

**Mesmo tratamento de erros do Teste 5.**

---

### **Teste 7: Teste de Inserção (RLS)**

**O que verifica:**
```
✅ Consegue inserir um registro de teste?
✅ RLS está bloqueando?
```

**Resultado Esperado:**
```
✅ Inserção OK (RLS permitiu)
```

**Se aparecer erro:**
```
❌ Falha ao inserir: new row violates row-level security policy
   - code: 42501
   - possibleCause: RLS (Row Level Security) bloqueando

CAUSA:
   → RLS policy não permite insert/update
   → Usuário não tem permissão

SOLUÇÃO:
   1. Ir no Supabase Dashboard
   2. Table Editor → sales (ou financeiro)
   3. Settings → RLS Policies
   4. Criar policy que permite INSERT/UPDATE
   5. Ou desabilitar RLS (somente DEV/teste):
      ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
```

---

## 🔧 INTERPRETANDO OS RESULTADOS

### **Cenário 1: Tudo Funcionando ✅**

```
✅ Supabase configurado
✅ Autenticado com sucesso
📋 X registros locais
✅ Fila vazia (tudo sincronizado)
✅ X vendas no Supabase
✅ X lançamentos no Supabase
✅ Inserção OK (RLS permitiu)
```

**Conclusão:**
```
✅ Sincronização está funcionando perfeitamente!
✅ Dados estão indo para o Supabase
✅ Métricas devem estar atualizadas
```

**Se métricas ainda não atualizam:**
```
→ Problema não é com Supabase
→ Verificar cache do navegador
→ Limpar localStorage e recarregar do Supabase
```

---

### **Cenário 2: Outbox Cheia ⚠️**

```
✅ Supabase configurado
✅ Autenticado com sucesso
📋 50 registros locais
⚠️ 150 itens pendentes (pode estar travada)
❌ 0 vendas no Supabase ← PROBLEMA
❌ 0 lançamentos no Supabase ← PROBLEMA
❌ Falha ao inserir: RLS bloqueando ← CAUSA
```

**Conclusão:**
```
❌ Sincronização está TRAVADA
❌ RLS está bloqueando inserções
❌ Outbox acumulou 150 itens tentando sincronizar
```

**Solução:**
```
1. Corrigir RLS (ver Teste 7)
2. Após corrigir, aguardar sincronização automática
3. Ou forçar sincronização manual:
   - Console (F12)
   - localStorage.removeItem('smarttech:outbox');
   - location.reload();
   - Criar nova venda de teste
```

---

### **Cenário 3: Tabela Não Existe ❌**

```
✅ Supabase configurado
✅ Autenticado com sucesso
📋 10 registros locais
✅ Fila vazia
❌ Erro ao consultar: relation "sales" does not exist
```

**Conclusão:**
```
❌ Tabela "sales" não existe no Supabase
❌ Migrations não foram executadas
```

**Solução:**
```
1. Ir em c:\PDV\supabase\migrations\
2. Executar migrations no Supabase Dashboard:
   - SQL Editor
   - Colar conteúdo dos arquivos .sql
   - Run
3. Verificar se tabelas foram criadas:
   - Table Editor
   - Verificar: sales, financeiro, orders, etc.
```

---

## 📊 COMPARAÇÃO: LOCAL vs SUPABASE

### **Exemplo de Resultado:**

```
📦 LOCALSTORAGE:
   - vendas: 50
   - financeiro: 120
   - ordens: 30

📡 SUPABASE:
   - vendas: 0 ← PROBLEMA!
   - financeiro: 0 ← PROBLEMA!
   - ordens: N/A
```

**Interpretação:**
```
❌ Dados estão APENAS no localStorage
❌ NÃO estão sincronizando com Supabase
❌ Ao limpar cache, perde tudo
```

**Causas Possíveis:**
```
1. RLS bloqueando (ver Teste 7)
2. Autenticação falhando (ver Teste 2)
3. Tabelas não existem (ver Teste 5/6)
4. Outbox travada (ver Teste 4)
```

---

## 🚨 ERROS COMUNS E SOLUÇÕES

### **Erro: "new row violates row-level security policy"**

**Causa:**
```
RLS (Row Level Security) está bloqueando inserções
```

**Solução:**
```
1. Ir no Supabase Dashboard
2. Table Editor → sales
3. Settings → RLS Policies
4. Criar policy:
   CREATE POLICY "Allow insert for authenticated users"
   ON sales FOR INSERT
   WITH CHECK (true);
5. Ou desabilitar RLS (DEV):
   ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
```

---

### **Erro: "relation 'sales' does not exist"**

**Causa:**
```
Tabela "sales" não existe no Supabase
```

**Solução:**
```
1. Executar migrations:
   c:\PDV\supabase\migrations\*.sql
2. Ou criar tabela manualmente no Supabase
```

---

### **Erro: "JWT expirado"**

**Causa:**
```
Token de autenticação venceu (> 1 hora)
```

**Solução:**
```
1. F5 (recarregar página)
2. Fazer login novamente
```

---

## ✅ PRÓXIMOS PASSOS

### **Após executar o diagnóstico:**

```
1. ✅ Anotar todos os resultados
2. ✅ Identificar problemas (vermelho ❌)
3. ✅ Seguir soluções acima
4. ✅ Executar diagnóstico novamente
5. ✅ Confirmar que todos ficaram verdes ✅
```

### **Se tudo estiver verde:**

```
✅ Sincronização funcionando
✅ Criar venda de teste
✅ Verificar se aparece no Supabase Dashboard
✅ Verificar se métricas atualizam
```

### **Se ainda houver problemas:**

```
1. Tirar print da tela do diagnóstico
2. Enviar para análise
3. Incluir console (F12) com erros
```

---

## 📸 COMO TIRAR PRINT DO DIAGNÓSTICO

```
1. Abrir /diagnostico-sync
2. Aguardar todos os testes concluírem
3. Print Screen (PrtScn)
4. Ou F12 → Console → Copy console output
5. Enviar para análise
```

---

**📅 Data:** 30/01/2026  
**🔍 Ferramenta:** DiagnosticoSyncPage  
**✅ Status:** ATIVA (modo DEV)

**Rota:** `/diagnostico-sync?dev=true`

© 2026 - PDV Smart Tech - Sync Diagnostic Tool v1.0
