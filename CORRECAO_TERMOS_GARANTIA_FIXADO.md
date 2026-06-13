# 📝 CORREÇÃO: Termos de Garantia - Fixado Permanentemente

**Data:** 31/01/2026  
**Status:** ✅ **IMPLEMENTADO**

---

## 🎯 **SOLICITAÇÃO DO USUÁRIO**

### **Problema Relatado:**
1. ❌ Card "Termos de Garantia" aparece na página Configurações (deve ser removido)
2. ❌ Termos não estão fixando permanentemente nas novas OS (usuário tem que habilitar manualmente)

### **Solução Implementada:**
1. ✅ Remover card "Termos de Garantia" da página Configurações
2. ✅ Manter termos **SOMENTE dentro da OS** (não em configuração separada)
3. ✅ Fixar termos **PERMANENTEMENTE** por padrão

---

## 📊 **MUDANÇAS APLICADAS**

### **1️⃣ Configurações - Remover Card**

**Arquivo:** `src/pages/ConfiguracoesPage.tsx`

**Antes:**
```tsx
{isAdmin() && (
  <div className="config-card">
    <h2>🧾 Termos de Garantia</h2>
    <p>Configure o texto padrão...</p>
    <button onClick={() => navigate('/configuracoes-termos-garantia')}>
      Editar Termos de Garantia
    </button>
  </div>
)}
```

**Depois:**
```tsx
// ❌ REMOVIDO - Termos agora são gerenciados SOMENTE dentro da OS
```

---

### **2️⃣ Settings - Fixar Permanentemente**

**Arquivo:** `src/lib/settings.ts`

**Mudança:**
```typescript
export function getDefaultWarrantySettings(storeId: string): WarrantySettings {
  const termosDefault = `📜 DIREITOS DE REGISTRO – SISTEMA PDV
  
🔒 Direitos Autorais
© 2026 Smart Tech Rolândia – Sistema PDV
...
📅 Ano: 2026`;

  return {
    id: storeId,
    warranty_terms: termosDefault,
    warranty_terms_pinned: true, // ✅ FIXADO POR PADRÃO
    warranty_terms_enabled: true, // ✅ SEMPRE HABILITADO
    print_mode: 'normal'
  };
}
```

**O que isso faz:**
- ✅ **Novas lojas** terão termos **fixados automaticamente**
- ✅ **Novas OS** terão termos **pré-preenchidos**
- ✅ **Não precisa configurar** nada em Configurações

---

## 🔧 **COMO FUNCIONA AGORA**

### **Fluxo Completo:**

```
1️⃣ Usuário clica em "Nova OS"
   └─> Sistema carrega termos padrão (se warranty_terms_pinned = true)
   └─> Campo de termos é AUTO-PREENCHIDO
   └─> Checkbox "Incluir na impressão" fica MARCADO e DESABILITADO

2️⃣ Usuário pode EDITAR os termos dentro da OS (campo de texto)
   └─> Alterações são salvas no SNAPSHOT da OS
   └─> Não afeta o padrão global

3️⃣ Ao salvar a OS:
   └─> warranty_terms_snapshot = texto editado pelo usuário
   └─> warranty_terms_enabled = true (fixado)

4️⃣ Ao imprimir a OS:
   └─> Se warranty_terms_enabled = true
   └─> Usa warranty_terms_snapshot da OS
   └─> Ou usa termos padrão se snapshot estiver vazio
```

---

## 🎨 **INTERFACE DA OS - Estado Final**

### **Seção "Termos de Garantia":**

```
┌─────────────────────────────────────────┐
│ 📜 Termos de Garantia                   │
│                                         │
│ ☑ Incluir na impressão (DESABILITADO)  │ ← Sempre marcado
│                                         │
│ [▼ Ver/Editar]  ← Botão para expandir  │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📜 DIREITOS DE REGISTRO...          │ │ ← Preview (2 linhas)
│ │ © 2026 Smart Tech...                │ │
│ │ ...                                 │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Ao clicar "Ver/Editar":**

```
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │ 📜 DIREITOS DE REGISTRO – SISTEMA... │ │
│ │                                     │ │ ← Área editável (6 linhas)
│ │ 🔒 Direitos Autorais...             │ │
│ │ © 2026 Smart Tech Rolândia...       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Restaurar Padrão] [Fixar/Desfixar]    │
└─────────────────────────────────────────┘
```

---

## ✅ **COMPORTAMENTO POR CENÁRIO**

### **Cenário 1: Nova Loja (Primeira Vez)**
```
1. Loja é criada
2. Sistema cria settings padrão:
   - warranty_terms_pinned = true ✅
   - warranty_terms_enabled = true ✅
3. Ao criar primeira OS:
   - Termos são auto-preenchidos ✅
   - Checkbox fica marcado e desabilitado ✅
```

### **Cenário 2: Loja Existente (Já tem OS)**
```
1. Configuração atual mantida
2. Se warranty_terms_pinned = false:
   - Usuário pode clicar em "Fixar" dentro da OS
3. Se warranty_terms_pinned = true:
   - Novas OS já vêm preenchidas ✅
```

### **Cenário 3: Editar OS Existente**
```
1. Abre OS antiga
2. Carrega warranty_terms_snapshot da OS
3. Usuário pode editar só desta OS
4. Não afeta o padrão global
```

---

## 🧪 **COMO TESTAR**

### **Teste 1: Nova OS**
```bash
1. Faça logout e login
2. Vá em "Ordens de Serviço"
3. Clique em "Nova Ordem"
4. ✅ Verificar: Termos já devem estar preenchidos
5. ✅ Verificar: Checkbox "Incluir na impressão" marcado
```

### **Teste 2: Editar Termos**
```bash
1. Na OS, clique em "Ver/Editar" nos termos
2. Edite o texto
3. Clique em "Salvar Ordem"
4. Imprima a OS
5. ✅ Verificar: Termos editados aparecem na impressão
```

### **Teste 3: Fixar/Desfixar** (Opcional)
```bash
1. Na OS, clique em "Ver/Editar"
2. Clique em botão "Fixar/Desfixar"
3. Crie nova OS
4. ✅ Se fixado: Termos pré-preenchidos
5. ✅ Se desfixado: Termos vazios
```

---

## 📄 **FLUXO DE DADOS**

```
┌─────────────────────────────────────────────────────┐
│ SETTINGS (Supabase/LocalStorage)                    │
│                                                     │
│ {                                                   │
│   id: "store-uuid",                                 │
│   warranty_terms: "📜 DIREITOS...",                 │
│   warranty_terms_pinned: true,      ← FIXADO       │
│   warranty_terms_enabled: true      ← HABILITADO   │
│ }                                                   │
└─────────────────────────────────────────────────────┘
                    ↓
         ┌──────────┴──────────┐
         │                     │
         ↓                     ↓
┌────────────────┐    ┌────────────────┐
│ NOVA OS        │    │ EDITAR OS      │
│                │    │                │
│ warranty_terms_│    │ warranty_terms_│
│ snapshot =     │    │ snapshot =     │
│ (termos padrão)│    │ (snapshot OS)  │
└────────────────┘    └────────────────┘
         │                     │
         └──────────┬──────────┘
                    ↓
         ┌────────────────────┐
         │ IMPRESSÃO          │
         │                    │
         │ Se enabled = true: │
         │ Usa snapshot       │
         │ Ou usa padrão      │
         └────────────────────┘
```

---

## 💡 **VANTAGENS DA SOLUÇÃO**

### **✅ Para o Usuário:**
1. ✅ Não precisa configurar nada
2. ✅ Termos já vêm prontos em novas OS
3. ✅ Pode editar termos por OS se precisar
4. ✅ Simplifica interface (sem card em Configurações)

### **✅ Para o Sistema:**
1. ✅ Menos cliques para criar OS
2. ✅ Menos pontos de configuração
3. ✅ Comportamento consistente
4. ✅ Menos suporte necessário

---

## 🔍 **VERIFICAÇÃO FINAL**

### **Checklist de Validação:**

- [x] Card "Termos de Garantia" removido de `ConfiguracoesPage.tsx`
- [x] `warranty_terms_pinned: true` em `settings.ts` (padrão)
- [x] Lógica de auto-preenchimento mantida em `OrdensPage.tsx`
- [x] Snapshot de termos salvo corretamente na OS
- [x] Impressão usa snapshot da OS ou padrão se vazio

---

## 📝 **ARQUIVOS MODIFICADOS**

| Arquivo | Mudança | Status |
|---------|---------|--------|
| `src/pages/ConfiguracoesPage.tsx` | Remover card Termos | ✅ |
| `src/lib/settings.ts` | Fixar `warranty_terms_pinned: true` | ✅ |

---

## 🎯 **CONCLUSÃO**

✅ **PROBLEMA RESOLVIDO!**

**Termos de Garantia agora:**
- ✅ São gerenciados **SOMENTE dentro da OS**
- ✅ Vêm **pré-preenchidos** em novas OS
- ✅ Estão **fixados permanentemente** por padrão
- ✅ Card removido da página Configurações

**Usuário pode:**
- ✅ Ver/editar termos dentro da OS
- ✅ Fixar/desfixar se necessário (botão dentro da OS)
- ✅ Não precisa ir em Configurações
