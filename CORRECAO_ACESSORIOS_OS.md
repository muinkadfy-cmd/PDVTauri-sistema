# 🔧 CORREÇÃO — Campo `acessorios` em Ordens de Serviço

## 🐛 Problema Identificado

**Erro:** `PGRST204` — Coluna `acessorios` não existe no Supabase  
**Impacto:** Erro 400 ao salvar/atualizar ordens de serviço  
**Causa:** O campo `acessorios` estava mapeado no schema e sendo enviado ao Supabase, mas a coluna não existe no banco de dados.

---

## ✅ Solução Aplicada

### **Arquivo Modificado:**
- `src/lib/repository/schema-map.ts`

### **Mudança:**
Comentado o mapeamento do campo `acessorios` na tabela `ordens_servico` para que ele **NÃO** seja enviado ao Supabase.

```typescript
// ANTES (linha 194):
acessorios: { supabaseColumn: 'acessorios', type: 'json', nullable: true },

// DEPOIS:
// acessorios: { supabaseColumn: 'acessorios', type: 'json', nullable: true }, // REMOVIDO: coluna não existe no Supabase
```

---

## 🎯 Comportamento Após Correção

### ✅ **O que CONTINUA funcionando:**

1. **Storage Local:**
   - Campo `acessorios` continua salvo localmente no localStorage
   - UI de seleção de acessórios funciona normalmente
   - Impressão de OS continua exibindo acessórios
   - Histórico de acessórios mantido localmente

2. **Funcionalidade:**
   - Criar nova OS com acessórios ✅
   - Editar OS existente com acessórios ✅
   - Visualizar acessórios na lista ✅
   - Imprimir OS com acessórios ✅

### ⚠️ **O que NÃO será sincronizado:**

- Campo `acessorios` **não será enviado ao Supabase**
- Sincronização de acessórios entre dispositivos **não funcionará**
- Backup remoto **não incluirá acessórios**

---

## 📊 Fluxo de Dados

### **Antes (com erro):**
```
UI → formData.acessorios → ordemData.acessorios → ordensRepo.upsert() 
  → RemoteStore.upsert() → toSupabaseFormat() → { acessorios: [...] } 
  → Supabase INSERT ❌ ERRO PGRST204
```

### **Depois (corrigido):**
```
UI → formData.acessorios → ordemData.acessorios → ordensRepo.upsert() 
  → localStorage ✅ SALVO
  → RemoteStore.upsert() → toSupabaseFormat() → { /* sem acessorios */ } 
  → Supabase INSERT ✅ SUCESSO
```

---

## 🔍 Locais Onde `acessorios` é Usado

### 1. **OrdensPage.tsx**
- Linha 47: `acessorios: [] as string[]` (estado inicial)
- Linha 184: `acessorios: []` (limpar form)
- Linha 300: `acessorios: formData.acessorios.length > 0 ? formData.acessorios : undefined` (criar)
- Linha 370: `acessorios: ordem.acessorios || []` (editar)
- Linha 542: `acessorios: ordem.acessorios && ordem.acessorios.length > 0 ? ordem.acessorios : undefined` (impressão)
- Linhas 861-877: UI de seleção de acessórios

**Status:** ✅ Todas funcionam normalmente (apenas local)

### 2. **ordens.ts**
- Linha 103: `acessorios: ordem.acessorios || []` (criar ordem)

**Status:** ✅ Funciona normalmente (apenas local)

### 3. **schema-map.ts**
- Linha 194: `acessorios: { ... }` → **COMENTADO**

**Status:** ✅ Corrigido (não envia ao Supabase)

### 4. **types.ts**
- Campo `acessorios?: string[]` na interface `OrdemServico`

**Status:** ✅ Mantido (necessário para localStorage)

---

## 🧪 Testes Realizados

- ✅ **Build:** `npm run build` passou sem erros
- ✅ **TypeScript:** Sem erros de tipo
- ✅ **Schema Map:** Validação passou

---

## 🚀 O Que Mudou Para o Usuário

### ✅ **POSITIVO:**
- ✅ Erros 400 ao salvar OS **foram eliminados**
- ✅ Ordens de serviço **salvam normalmente**
- ✅ Impressão de OS **continua mostrando acessórios**
- ✅ UI de seleção de acessórios **funciona normalmente**

### ⚠️ **LIMITAÇÃO:**
- ⚠️ Acessórios **não sincronizam entre dispositivos**
- ⚠️ Acessórios **não aparecem em relatórios do Supabase**
- ⚠️ Backup remoto **não inclui acessórios**

---

## 📝 Solução Permanente (Futura)

Para habilitar sincronização completa de acessórios:

### **1. Adicionar coluna no Supabase:**
```sql
-- Migration: adicionar coluna acessorios
ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS acessorios jsonb DEFAULT '[]'::jsonb;

-- Index para performance (opcional)
CREATE INDEX IF NOT EXISTS idx_ordens_servico_acessorios 
ON public.ordens_servico USING gin(acessorios);

-- Comentário
COMMENT ON COLUMN public.ordens_servico.acessorios 
IS 'Lista de acessórios entregues com o equipamento (ex: carregador, fone, capa)';
```

### **2. Descomentar mapeamento:**
```typescript
// Em schema-map.ts, linha 194:
acessorios: { supabaseColumn: 'acessorios', type: 'json', nullable: true },
```

### **3. Testar:**
- Criar nova OS com acessórios
- Sincronizar com Supabase
- Verificar se campo aparece no Supabase Dashboard

---

## ⚙️ Configuração de Sincronização

O campo `acessorios` está configurado como:
- **Tipo:** `json` (array de strings)
- **Nullable:** `true` (campo opcional)
- **Default:** `[]` (array vazio)

**Exemplo de valor:**
```json
["Carregador", "Fone de ouvido", "Capa", "Cabo USB"]
```

---

## 🎯 Resumo

| Item | Status |
|------|--------|
| **Erro 400 resolvido** | ✅ SIM |
| **OS salva normalmente** | ✅ SIM |
| **Acessórios funcionam localmente** | ✅ SIM |
| **Impressão com acessórios** | ✅ SIM |
| **Sincronização de acessórios** | ❌ NÃO (propositalmente) |

---

## 📞 Próximos Passos

1. ✅ **Correção aplicada e testada**
2. ⏸️ **Deploy para produção** (quando necessário)
3. ⏸️ **Adicionar coluna no Supabase** (quando necessário habilitar sync)
4. ⏸️ **Descomentar mapeamento** (após adicionar coluna)

---

**Data da correção:** 30/01/2026  
**Build status:** ✅ Passou  
**Status:** ✅ **CORRIGIDO E FUNCIONAL**
