# 🔧 Solução: Erro 400 ao Sincronizar Produtos

## 🔍 Problema Identificado

**Erro 400** do Supabase ao tentar inserir produtos. Possíveis causas:

1. **ID não é UUID válido** (mais provável)
2. **RLS bloqueando** (Row Level Security)
3. **Campos obrigatórios faltando**
4. **Tipos de dados incompatíveis**

---

## ✅ Correções Implementadas

### 1. **Removido ID do INSERT**
- ✅ Agora **NUNCA** envia ID no INSERT
- ✅ Supabase gera UUID automaticamente
- ✅ ID do LocalStorage permanece diferente (isso é OK)

### 2. **Logging Melhorado**
- ✅ Mostra erro completo (message, code, details, hint)
- ✅ Mostra dados enviados
- ✅ Toast com mensagem de erro

### 3. **Conversão de Tipos**
- ✅ Garante que todos os valores são do tipo correto
- ✅ Converte strings, números e booleanos explicitamente

---

## 🧪 Como Diagnosticar Agora

### Passo 1: Abra o Console (F12)
1. Pressione **F12** no navegador
2. Vá na aba **Console**
3. Crie um produto na UI

### Passo 2: Veja os Logs

**Procure por:**
```
[SYNC] Tentando create produto no Supabase: [id]
[SYNC] Dados do produto: { ... }
```

**Se aparecer erro:**
```
[SYNC] Erro completo ao criar produto: {
  message: "...",
  code: "...",
  details: "...",
  hint: "..."
}
```

**Copie o erro completo** e veja a solução abaixo.

---

## 🔧 Soluções por Tipo de Erro

### Erro PGRST301 (RLS)

**Mensagem:** `new row violates row-level security policy`

**Solução:**
Execute no Supabase SQL Editor:

```sql
-- Desabilitar RLS temporariamente
ALTER TABLE public.produtos DISABLE ROW LEVEL SECURITY;

-- OU criar política permissiva
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir tudo produtos"
ON public.produtos
FOR ALL
USING (true)
WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
```

---

### Erro de Tipo de Dados

**Mensagem:** `invalid input syntax for type decimal` ou similar

**Solução:**
1. Verifique se a tabela tem as colunas corretas
2. Execute `alter_produtos_table.sql` novamente
3. Verifique se `preco` e `custo` são `DECIMAL(10,2)`

---

### Erro de Campo Obrigatório

**Mensagem:** `null value in column "nome" violates not-null constraint`

**Solução:**
- Verifique se `nome` está sendo enviado
- Verifique se não está vazio ou null

---

### Erro de Tabela Não Existe

**Mensagem:** `relation "public.produtos" does not exist`

**Solução:**
1. Execute `alter_produtos_table.sql` no Supabase
2. Verifique se a tabela foi criada

---

## 📋 Checklist Rápido

- [ ] Console mostra `[SYNC] Tentando create produto`
- [ ] Console mostra `[SYNC] Dados do produto: { ... }`
- [ ] Se houver erro, copie o erro completo
- [ ] Verifique se RLS está configurado (execute `configurar_rls_produtos.sql`)
- [ ] Verifique se tabela existe e tem colunas corretas
- [ ] Toast aparece mostrando o erro

---

## 🚀 Teste Agora

1. **Abra o Console (F12)**
2. **Crie um produto na UI**
3. **Veja os logs `[SYNC]`**
4. **Se aparecer erro, copie e cole aqui**

---

**Status:** ✅ **Melhorias implementadas. Teste e veja os logs detalhados!**
