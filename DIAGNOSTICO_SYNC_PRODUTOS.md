# 🔍 Diagnóstico: Produtos não aparecem no Supabase

## ✅ Melhorias Implementadas

1. **Feedback Visual**: Erros agora aparecem em Toast para o usuário
2. **Logging Melhorado**: Logs com prefixo `[SYNC]` no console
3. **Fallback de ID**: Tenta com ID customizado, se falhar tenta sem ID
4. **Mensagens de Erro Detalhadas**: Mostra código e mensagem do erro

---

## 🔍 Como Diagnosticar

### 1. **Abra o Console do Navegador (F12)**
- Vá em **Console**
- Crie/edite um produto
- Procure por logs com `[SYNC]`

### 2. **Verifique os Logs**

**Se aparecer:**
```
[SYNC] Supabase não configurado, pulando sincronização
```
→ **Solução**: Configure `.env.local` com as credenciais

**Se aparecer:**
```
[SYNC] Offline, pulando sincronização
```
→ **Solução**: Verifique sua conexão com internet

**Se aparecer:**
```
[SYNC] Erro ao criar produto no Supabase: [mensagem de erro]
```
→ Veja a mensagem de erro abaixo para resolver

---

## ⚠️ Erros Comuns e Soluções

### Erro PGRST301 (RLS - Row Level Security)

**Mensagem:**
```
new row violates row-level security policy
```

**Solução:**
1. Acesse **Supabase Dashboard**
2. Vá em **Authentication → Policies**
3. Selecione a tabela `produtos`
4. Crie uma política permissiva:

```sql
-- Permitir tudo (apenas para desenvolvimento/teste)
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir tudo para produtos"
ON public.produtos
FOR ALL
USING (true)
WITH CHECK (true);
```

**OU** desabilite RLS temporariamente:
```sql
ALTER TABLE public.produtos DISABLE ROW LEVEL SECURITY;
```

---

### Erro PGRST116 (Tabela não existe)

**Mensagem:**
```
relation "public.produtos" does not exist
```

**Solução:**
1. Execute o SQL em `alter_produtos_table.sql`
2. Ou crie a tabela manualmente no Supabase Dashboard

---

### Erro de ID Duplicado

**Mensagem:**
```
duplicate key value violates unique constraint
```

**Solução:**
- A função agora tenta sem ID se falhar com ID customizado
- O Supabase gerará um UUID automaticamente

---

### Erro de Tipo de Dados

**Mensagem:**
```
invalid input syntax for type decimal
```

**Solução:**
- Verifique se `preco` e `custo` são números válidos
- Certifique-se que a tabela tem colunas `DECIMAL(10,2)`

---

## 🧪 Teste Passo a Passo

### 1. Verificar Configuração
```javascript
// No console do navegador:
import { isSupabaseConfigured, isSupabaseOnline } from './lib/supabase';
console.log('Configurado:', isSupabaseConfigured());
isSupabaseOnline().then(online => console.log('Online:', online));
```

### 2. Testar Inserção Manual
```javascript
// No console do navegador:
import { supabase } from './lib/supabase';
const { data, error } = await supabase
  .from('produtos')
  .insert({
    nome: 'Teste Manual',
    preco: 10.99,
    estoque: 1,
    ativo: true
  })
  .select();
console.log('Data:', data);
console.log('Error:', error);
```

### 3. Verificar Tabela no Supabase
- Acesse **Supabase Dashboard → Table Editor → produtos**
- Verifique se a tabela existe e tem as colunas corretas

---

## 📋 Checklist de Verificação

- [ ] `.env.local` está configurado com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- [ ] Servidor foi reiniciado após configurar `.env.local`
- [ ] Tabela `produtos` existe no Supabase
- [ ] Tabela `produtos` tem todas as colunas necessárias
- [ ] RLS está configurado ou desabilitado
- [ ] Console do navegador não mostra erros
- [ ] Toast de erro aparece quando há problema

---

## 🔧 Próximos Passos

1. **Abra o Console (F12)**
2. **Crie um produto na UI**
3. **Veja os logs `[SYNC]`**
4. **Copie o erro (se houver)**
5. **Siga a solução correspondente acima**

---

**Status:** ✅ **Diagnóstico e melhorias implementadas!**
