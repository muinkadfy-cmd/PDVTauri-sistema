# 🔍 Diagnóstico: Erro 400 ao Sincronizar Vendas

## ⚠️ Problema

Erro `400` ao tentar sincronizar vendas com Supabase:
```
Failed to load resource: the server responded with a status of 400
[SyncEngine] Erro ao processar upsert em vendas
```

---

## 🔧 Soluções Implementadas

### **1. Logging Melhorado**

O código agora mostra no console (F12):
- ✅ Payload original e convertido
- ✅ Todos os campos enviados
- ✅ Tipo de cada campo
- ✅ Erro completo do Supabase (code, message, details, hint)

### **2. Tratamento de Campos JSON**

- ✅ Campo `itens` é garantido como array (não string)
- ✅ Campos `undefined` são removidos antes de enviar
- ✅ Conversão automática de tipos

### **3. Validação de UUID**

- ✅ Verifica se ID é UUID válido
- ✅ Log de aviso se não for UUID

---

## 🧪 Como Diagnosticar

### **Passo 1: Abrir Console (F12)**

Procure por logs como:
```
[SyncEngine] Enviando upsert para vendas: {
  payloadOriginal: {...},
  payloadConvertido: {...},
  camposEnviados: [...]
}
```

### **Passo 2: Verificar Erro Completo**

Procure por:
```
[SyncEngine] ❌ Erro ao processar upsert em vendas: {
  errorCode: "...",
  errorMessage: "...",
  errorDetails: "...",
  errorHint: "..."
}
```

### **Passo 3: Verificar Schema no Supabase**

Execute no Supabase SQL Editor:
```sql
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'vendas'
ORDER BY ordinal_position;
```

---

## 🐛 Erros Comuns e Soluções

### **Erro 1: "column X does not exist" (PGRST204)**

**Causa:** Coluna não existe na tabela do Supabase

**Solução:**
1. Execute o SQL `sql_completo_schema_rls.sql` no Supabase
2. Verifique se a coluna foi criada:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'vendas';
   ```

### **Erro 2: "null value in column X violates not-null constraint"**

**Causa:** Campo obrigatório está null

**Solução:**
- Verifique no console qual campo está null
- Ajuste o schema para aceitar null OU garanta que o campo sempre tenha valor

### **Erro 3: "invalid input syntax for type uuid"**

**Causa:** ID não é UUID válido

**Solução:**
- O código já gera UUIDs corretamente
- Se houver dados antigos com IDs não-UUID, pode ser necessário migrar

### **Erro 4: "invalid input syntax for type jsonb"**

**Causa:** Campo `itens` não está em formato JSON válido

**Solução:**
- O código já trata isso automaticamente
- Se persistir, verifique se `itens` é um array válido

---

## 📋 Checklist de Verificação

1. ✅ Execute `sql_completo_schema_rls.sql` no Supabase
2. ✅ Verifique se a tabela `vendas` existe
3. ✅ Verifique se todas as colunas foram criadas
4. ✅ Abra o console (F12) e veja o erro completo
5. ✅ Compare campos enviados com colunas da tabela
6. ✅ Verifique se RLS está desabilitado ou políticas criadas

---

## 🔄 Próximos Passos

1. **Recarregue a página** e tente criar uma venda novamente
2. **Abra o console (F12)** e copie o erro completo
3. **Compartilhe o erro** para diagnóstico mais preciso

O logging melhorado mostrará exatamente qual campo está causando o problema!

---

**Status:** ✅ **Logging melhorado. Verifique o console para diagnóstico detalhado!**
