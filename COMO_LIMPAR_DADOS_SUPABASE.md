# 🗑️ COMO LIMPAR DADOS DO SUPABASE

**Data:** 30/01/2026

---

## 🎯 OBJETIVO

Limpar **APENAS os dados de clientes** do Supabase, mantendo:
- ✅ Estrutura das tabelas (schema)
- ✅ Políticas RLS
- ✅ Índices
- ✅ Outros dados (vendas, produtos, ordens, etc)

---

## 🚀 MÉTODO 1: VIA SUPABASE DASHBOARD (RECOMENDADO)

### **Passo a Passo:**

#### **1. Acessar Supabase Dashboard**
```
https://supabase.com/dashboard
```

#### **2. Selecionar Projeto**
- Clicar no projeto PDV
- Ir na aba **"SQL Editor"** (menu lateral esquerdo)

#### **3. Executar SQL**
```sql
-- Deletar TODOS os clientes
DELETE FROM clientes;

-- Verificar
SELECT COUNT(*) FROM clientes;
-- Resultado esperado: 0
```

#### **4. Clicar em "RUN"**
- ✅ Clientes deletados!

---

## 🔧 MÉTODO 2: VIA ARQUIVO SQL (PARA ADMIN)

### **Arquivo Criado:**
```
supabase/migrations/LIMPAR_CLIENTES.sql
```

### **Como Usar:**

#### **1. Copiar o conteúdo do arquivo**
```sql
DELETE FROM clientes;
DELETE FROM pessoas WHERE tipo = 'cliente';
```

#### **2. Colar no SQL Editor do Supabase**
- Dashboard → SQL Editor
- Colar o código
- Clicar em **RUN**

#### **3. Verificar resultado**
```sql
SELECT COUNT(*) FROM clientes;
-- Deve retornar: 0
```

---

## 📊 MÉTODO 3: VIA TABLE EDITOR (MANUAL)

### **Para deletar poucos clientes:**

#### **1. Acessar Table Editor**
```
Dashboard → Table Editor → Selecionar "clientes"
```

#### **2. Selecionar clientes**
- Marcar checkbox de cada linha
- Ou clicar em "Select All" para todos

#### **3. Clicar em "Delete"**
- Confirmar exclusão
- ✅ Clientes deletados!

---

## ⚠️ MÉTODO 4: LIMPAR TUDO (CUIDADO!)

### **Arquivo Criado:**
```
supabase/migrations/LIMPAR_TODOS_DADOS.sql
```

### **Para limpar TODOS os dados do sistema:**

#### **Opção A: Usar arquivo SQL completo**
1. Abrir `supabase/migrations/LIMPAR_TODOS_DADOS.sql`
2. Copiar todo o conteúdo
3. Colar no SQL Editor do Supabase
4. Clicar em **RUN**

#### **Opção B: Executar manualmente**
```sql
-- ⚠️ CUIDADO: Isso deleta TUDO!

-- Ordem correta para evitar erro de foreign key:
DELETE FROM vendas;
DELETE FROM ordens_servico;
DELETE FROM movimentacoes_financeiras;
DELETE FROM cobrancas;
DELETE FROM devolucoes;
DELETE FROM encomendas;
DELETE FROM recibos;
DELETE FROM usados_vendas;
DELETE FROM usados_arquivos;
DELETE FROM usados;
DELETE FROM produtos;
DELETE FROM clientes;
DELETE FROM pessoas;

-- Verificar
SELECT 
  'vendas' as tabela, COUNT(*) as total FROM vendas
UNION ALL
SELECT 'ordens_servico', COUNT(*) FROM ordens_servico
UNION ALL
SELECT 'clientes', COUNT(*) FROM clientes
UNION ALL
SELECT 'produtos', COUNT(*) FROM produtos
UNION ALL
SELECT 'movimentacoes', COUNT(*) FROM movimentacoes_financeiras;
```

---

## 🎯 MÉTODO 5: LIMPAR SÓ TRANSAÇÕES (MANTÉM CADASTROS)

### **Arquivo Criado:**
```
supabase/migrations/LIMPAR_APENAS_TRANSACOES.sql
```

### **Para limpar vendas, OS, fluxo de caixa, MAS manter clientes e produtos:**

```sql
-- Deleta transações
DELETE FROM vendas;
DELETE FROM ordens_servico;
DELETE FROM movimentacoes_financeiras;
DELETE FROM cobrancas;
DELETE FROM devolucoes;
DELETE FROM encomendas;
DELETE FROM recibos;
DELETE FROM usados_vendas;

-- Mantém: clientes, produtos, pessoas, usados (cadastro)
```

---

## 🔐 SE DER ERRO DE PERMISSÃO

### **Erro:**
```
permission denied for table clientes
```

### **Solução:**

#### **1. Desabilitar RLS temporariamente:**
```sql
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
DELETE FROM clientes;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
```

#### **2. Ou executar como ADMIN:**
```sql
-- Usar a aba "SQL Editor" como admin
-- O usuário admin tem permissão total
```

---

## 📋 CHECKLIST

Após limpar os dados:

```
□ Acessar Supabase Dashboard
□ Ir em SQL Editor
□ Executar: DELETE FROM clientes;
□ Verificar: SELECT COUNT(*) FROM clientes;
□ Resultado: 0 clientes
□ ✅ Dados limpos!
```

---

## 🧪 TESTAR NO SISTEMA

Após limpar no Supabase:

### **1. Limpar cache do navegador**
```
F12 → Application → Clear storage → Clear site data
Ctrl + Shift + R
```

### **2. Ir em "Clientes"**
```
✅ Lista deve estar vazia
✅ Contador deve mostrar: 0 clientes
```

### **3. Criar novo cliente**
```
✅ Deve funcionar normalmente
✅ Cliente será sincronizado com Supabase
```

---

## 🔄 SINCRONIZAÇÃO

### **O que acontece após limpar:**

1. **Supabase:** Clientes deletados ✅
2. **LocalStorage:** Clientes ainda existem ⚠️
3. **Sync:** Na próxima sincronização, o sistema vai:
   - Baixar clientes do Supabase (vazio)
   - Mesclar com local
   - Enviar clientes locais para Supabase

### **Para sincronizar corretamente:**

#### **Opção A: Limpar Local + Supabase**
```javascript
// No console do navegador (F12)
localStorage.removeItem('smart-tech-clientes');
localStorage.removeItem('smart-tech-pessoas');
```

#### **Opção B: Forçar Sync do Supabase → Local**
```
1. Limpar clientes no Supabase (SQL)
2. Limpar cache do navegador
3. Fechar todas as abas
4. Reabrir sistema
5. ✅ Clientes do Supabase (vazio) sobrescreverão local
```

---

## 🎯 RESUMO

```
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   LIMPAR CLIENTES NO SUPABASE                         ║
║                                                        ║
║   1. Dashboard → SQL Editor                           ║
║   2. DELETE FROM clientes;                            ║
║   3. RUN                                               ║
║   4. ✅ Pronto!                                        ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
```

---

## 📞 COMANDOS ÚTEIS

### **Ver clientes:**
```sql
SELECT * FROM clientes LIMIT 10;
```

### **Contar clientes:**
```sql
SELECT COUNT(*) FROM clientes;
```

### **Ver últimos 5 clientes:**
```sql
SELECT nome, telefone, created_at 
FROM clientes 
ORDER BY created_at DESC 
LIMIT 5;
```

### **Deletar cliente específico:**
```sql
DELETE FROM clientes WHERE id = 'uuid-aqui';
```

### **Deletar clientes por loja:**
```sql
DELETE FROM clientes WHERE store_id = 'uuid-da-loja';
```

---

## ⚠️ IMPORTANTE

- ✅ **Backup:** Faça backup antes de deletar
- ✅ **Teste:** Teste em ambiente de desenvolvimento primeiro
- ✅ **Verificação:** Sempre verifique com COUNT após deletar
- ✅ **RLS:** Se der erro, desabilite RLS temporariamente
- ✅ **Cache:** Limpe o cache do navegador após deletar

---

**📅 Data:** 30/01/2026  
**🏆 Método:** SQL no Dashboard  
**✅ Rápido e Seguro**

© 2026 - PDV Smart Tech - Guia de Limpeza v1.0
