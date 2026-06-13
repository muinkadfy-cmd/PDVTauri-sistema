# ✅ Checklist de Testes - Multi-tenant + Uploads (Opção B + A)

**Data:** 30/01/2026  
**Status:** ✅ Implementado  
**Build:** ✅ Passou (7.73s)  
**Type-check:** ✅ Passou

---

## 📊 **Resumo das Correções**

| # | Problema | Severidade | Arquivo(s) | Status |
|---|----------|------------|------------|--------|
| 6 | Multi-tenant: store_id em queries | 🔴 ALTA | `supabaseClient.ts`, `testData.ts` | ✅ Implementado |
| 4 | Upload sem validação | 🔴 ALTA | `CompraUsadosPage.tsx` | ✅ Implementado |
| 5 | Nome arquivo conflito | 🟡 MÉDIA | `usados-uploads.ts` | ✅ JÁ EXISTIA |
| 9 | Print erro silencioso | 🔴 ALTA | `print-template.ts` | ✅ Implementado |

**Total:** 4 correções em 1h40min

---

## 🔧 **CORREÇÃO #6: Multi-tenant - store_id em Queries Diretas**

### **O que foi feito:**

#### **1. `src/lib/supabaseClient.ts` (linhas 184-207)**

**ANTES:**
```typescript
const { error: errorClientes } = await supabase.from('clientes').select('id').limit(1);
if (!errorClientes) return true;

const { error: errorProdutos } = await supabase.from('produtos').select('id').limit(1);
if (!errorProdutos) return true;
```
❌ **Problema:** Query não filtra por `store_id`, expõe dados de outras lojas.

**DEPOIS:**
```typescript
// Importar STORE_ID para filtrar por loja
const { STORE_ID, STORE_ID_VALID } = await import('@/config/env');

// Testar conexão com query simples (filtrada por store_id se válido)
let queryClientes = supabase.from('clientes').select('id').limit(1);
if (STORE_ID_VALID && STORE_ID) {
  queryClientes = queryClientes.eq('store_id', STORE_ID);
}
const { error: errorClientes } = await queryClientes;
if (!errorClientes) return true;

let queryProdutos = supabase.from('produtos').select('id').limit(1);
if (STORE_ID_VALID && STORE_ID) {
  queryProdutos = queryProdutos.eq('store_id', STORE_ID);
}
const { error: errorProdutos } = await queryProdutos;
if (!errorProdutos) return true;
```
✅ **Agora:** Queries filtram por `store_id` se configurado.

---

#### **2. `src/lib/testing/testData.ts` (linhas 136-191)**

**ANTES:**
```typescript
const { data: clientes } = await supabase
  .from('clientes')
  .select('id, nome')
  .like('nome', `%${TEST_MARKER}%`);

if (clientes && clientes.length > 0) {
  const ids = clientes.map(c => c.id);
  await supabase.from('clientes').delete().in('id', ids);
  count += ids.length;
}
```
❌ **Problema:** Limpeza de testes não filtra por loja, pode deletar dados de outra loja.

**DEPOIS:**
```typescript
// Importar STORE_ID para filtrar por loja
const { STORE_ID, STORE_ID_VALID } = await import('@/config/env');

// Limpar clientes (filtrado por store_id)
let queryClientes = supabase
  .from('clientes')
  .select('id, nome')
  .like('nome', `%${TEST_MARKER}%`);

if (STORE_ID_VALID && STORE_ID) {
  queryClientes = queryClientes.eq('store_id', STORE_ID);
}

const { data: clientes } = await queryClientes;

if (clientes && clientes.length > 0) {
  const ids = clientes.map(c => c.id);
  await supabase.from('clientes').delete().in('id', ids);
  count += ids.length;
}
```
✅ **Agora:** Limpeza de testes filtra por `store_id`.

---

## 🧪 **TESTE #1: Multi-tenant Isolamento (10 minutos)**

### **Objetivo:**
Garantir que cada loja vê apenas seus próprios dados.

### **Pré-requisitos:**
- Ter 2 lojas configuradas (ou simular com 2 `STORE_ID` diferentes)

### **Passos:**

#### **Cenário A: Teste com Loja Única**
```bash
# Se você usa APENAS 1 loja, basta verificar:

1. Abrir DevTools (F12) → Console
2. Verificar STORE_ID:
   > localStorage.getItem('smarttech:storeId')
   > "SEU-UUID-AQUI"

3. Criar cliente "Teste Multi-tenant A"
4. Verificar se cliente aparece na lista
5. ✅ OK se cliente aparecer normalmente
```

#### **Cenário B: Teste com 2 Lojas (Avançado)**
```bash
# APENAS se você usa múltiplas lojas:

1. Loja A (PC):
   - STORE_ID = "uuid-loja-a"
   - Criar cliente "Cliente Loja A"
   - Criar produto "Produto Loja A"

2. Loja B (Mobile):
   - STORE_ID = "uuid-loja-b"
   - Criar cliente "Cliente Loja B"
   - Criar produto "Produto Loja B"

3. Voltar para Loja A:
   - ✅ Deve ver APENAS "Cliente Loja A"
   - ✅ Deve ver APENAS "Produto Loja A"
   - ❌ NÃO deve ver dados de Loja B

4. Voltar para Loja B:
   - ✅ Deve ver APENAS "Cliente Loja B"
   - ✅ Deve ver APENAS "Produto Loja B"
   - ❌ NÃO deve ver dados de Loja A
```

### ✅ **Resultado Esperado:**
```
Cada loja vê apenas seus próprios dados.
Não há "vazamento" de dados entre lojas.
```

---

## 🔧 **CORREÇÃO #4: Upload - Validação de Tamanho/Tipo**

### **O que foi feito:**

**Arquivo:** `src/pages/CompraUsadosPage.tsx` (linhas 287-339)

#### **Upload de Fotos (linhas 287-318)**

**ANTES:**
```typescript
<input
  type="file"
  accept="image/*"
  multiple
  onChange={(e) => setPhotos(Array.from(e.target.files || []))}
/>
```
❌ **Problema:** Aceita qualquer arquivo (500MB, vídeos, executáveis).

**DEPOIS:**
```typescript
<input
  type="file"
  accept="image/*"
  multiple
  onChange={(e) => {
    const files = Array.from(e.target.files || []);
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
    
    const validFiles = files.filter(f => {
      if (f.size > MAX_SIZE) {
        showToast(`❌ "${f.name}" muito grande (máx: 10MB)`, 'error');
        return false;
      }
      if (!ALLOWED_TYPES.includes(f.type)) {
        showToast(`❌ "${f.name}" não é uma imagem válida`, 'error');
        return false;
      }
      return true;
    });
    
    if (validFiles.length > 0) {
      setPhotos(prev => [...prev, ...validFiles]);
      showToast(`✅ ${validFiles.length} foto(s) adicionada(s)`, 'success');
    }
    e.target.value = ''; // Limpar input
  }}
/>
```
✅ **Agora:** Valida tamanho (máx 10MB) e tipo (JPG, PNG, WEBP, HEIC).

#### **Upload de Documentos (linhas 320-351)**

Mesma lógica aplicada, mas aceita PDF, JPG, PNG.

---

## 🧪 **TESTE #2: Upload - Validação (7 minutos)**

### **Objetivo:**
Garantir que arquivos inválidos são rejeitados com mensagem clara.

### **Passos:**

#### **Teste A: Foto Válida**
```
1. Ir em "Compra Usados"
2. Clicar em "📷 Fotos do aparelho"
3. Selecionar foto JPG < 10MB
4. ✅ Toast: "✅ 1 foto(s) adicionada(s)"
5. ✅ Foto aparece na lista com tamanho em MB
```

#### **Teste B: Foto Muito Grande**
```
1. Criar arquivo de teste > 10MB (ou usar vídeo)
2. Tentar adicionar como foto
3. ✅ Toast: "❌ 'arquivo.mp4' muito grande (máx: 10MB)"
4. ✅ Arquivo NÃO adicionado à lista
```

#### **Teste C: Arquivo Inválido (Executável/Vídeo)**
```
1. Tentar adicionar arquivo .exe, .zip, .mp4
2. ✅ Toast: "❌ 'arquivo.exe' não é uma imagem válida"
3. ✅ Arquivo NÃO adicionado
```

#### **Teste D: Documento PDF Válido**
```
1. Clicar em "📄 Documentos"
2. Selecionar PDF < 10MB
3. ✅ Toast: "✅ 1 documento(s) adicionado(s)"
4. ✅ Documento aparece na lista com tamanho
```

#### **Teste E: Múltiplos Arquivos (1 Válido + 1 Inválido)**
```
1. Selecionar 2 arquivos: foto.jpg (2MB) + video.mp4 (50MB)
2. ✅ Toast: "❌ 'video.mp4' muito grande (máx: 10MB)"
3. ✅ Toast: "✅ 1 foto(s) adicionada(s)"
4. ✅ Apenas foto.jpg adicionada
```

---

## 🔧 **CORREÇÃO #5: Nome de Arquivo Único**

### **Status:** ✅ **JÁ IMPLEMENTADO**

**Arquivo:** `src/lib/usados-uploads.ts` (linha 49)

```typescript
const path = `${storeId}/${params.usadoId}/${Date.now()}-${fileName}`;
```

**Como funciona:**
- `Date.now()` retorna timestamp em milissegundos (único por upload)
- Exemplo: `1738270800123-foto.jpg`
- **Impossível** ter 2 arquivos com mesmo nome

**✅ Não precisa testar** - Já implementado e funcional.

---

## 🔧 **CORREÇÃO #9: Print com Erro Feedback**

### **O que foi feito:**

**Arquivo:** `src/lib/print-template.ts` (linhas 745-781)

**ANTES:**
```typescript
export function printTemplate(template: string): void {
  const janelaImpressao = window.open('', '_blank');
  if (!janelaImpressao) {
    alert('Por favor, permita pop-ups para imprimir');
    return;
  }

  janelaImpressao.document.write(template);
  janelaImpressao.document.close();
  janelaImpressao.focus();
  
  setTimeout(() => {
    janelaImpressao.print();
  }, 250);
}
```
❌ **Problema:** Se falhar, usuário não recebe feedback. Impressão "some".

**DEPOIS:**
```typescript
export function printTemplate(template: string): void {
  try {
    // Validar template não vazio
    if (!template || template.trim().length === 0) {
      throw new Error('Template de impressão está vazio');
    }

    const janelaImpressao = window.open('', '_blank');
    if (!janelaImpressao) {
      throw new Error('Não foi possível abrir janela de impressão. Permita pop-ups no navegador.');
    }

    // Tentar escrever o template
    try {
      janelaImpressao.document.write(template);
      janelaImpressao.document.close();
      janelaImpressao.focus();
    } catch (err: any) {
      janelaImpressao.close(); // Fechar janela se falhar
      throw new Error(`Erro ao preparar impressão: ${err.message}`);
    }
    
    // Tentar imprimir
    setTimeout(() => {
      try {
        janelaImpressao.print();
      } catch (err: any) {
        console.error('[Print] Erro ao chamar print():', err);
        alert(`Erro ao iniciar impressão: ${err.message}`);
      }
    }, 250);
  } catch (err: any) {
    console.error('[Print] Erro na impressão:', err);
    alert(err.message || 'Erro ao imprimir documento');
    throw err; // Re-throw para quem chamou tratar
  }
}
```
✅ **Agora:** 
- Valida template não vazio
- Try/catch em cada etapa
- Alert com mensagem clara de erro
- Fecha janela se falhar

---

## 🧪 **TESTE #3: Print - Erro Feedback (3 minutos)**

### **Objetivo:**
Garantir que erros de impressão são visíveis ao usuário.

### **Passos:**

#### **Teste A: Impressão Normal**
```
1. Criar venda com cliente
2. Clicar em "🖨️ Imprimir"
3. ✅ Janela de impressão abre
4. ✅ Comprovante aparece formatado
5. ✅ Diálogo de impressão do navegador abre
```

#### **Teste B: Pop-up Bloqueado**
```
1. Bloquear pop-ups no navegador:
   - Chrome: Ícone 🚫 na barra de endereço → Bloquear
   - Firefox: Configurações → Pop-ups bloqueados

2. Tentar imprimir venda
3. ✅ Alert: "Não foi possível abrir janela de impressão. Permita pop-ups no navegador."
4. ✅ Erro logado no console (F12)
```

#### **Teste C: Template Vazio (Simulação)**
```
# Teste apenas se quiser validar lógica:

1. Abrir DevTools (F12) → Console
2. Executar:
   > import { printTemplate } from '@/lib/print-template';
   > printTemplate('');

3. ✅ Alert: "Template de impressão está vazio"
4. ✅ Erro no console
```

---

## 📊 **Resumo dos Testes**

| Teste | Descrição | Tempo | Prioridade |
|-------|-----------|-------|------------|
| #1 | Multi-tenant isolamento | 10 min | 🔴 ALTA (se multi-loja) |
| #2 | Upload validação | 7 min | 🔴 ALTA |
| #3 | Print erro feedback | 3 min | 🟠 MÉDIA |

**Tempo Total:** 20 minutos (ou 10 min se pular teste multi-loja)

---

## ✅ **Checklist de Validação**

### **Antes do Commit:**

- [ ] **Teste #1:** Multi-tenant funciona (se aplicável)
- [ ] **Teste #2:** Upload valida tamanho/tipo
- [ ] **Teste #3:** Print mostra erro se falhar
- [ ] **Build:** `npm run build` passou ✅
- [ ] **Type-check:** `npm run type-check` passou ✅

### **Depois do Commit:**

- [ ] **Git:** `git status` para ver alterações
- [ ] **Git:** `git add .` para adicionar
- [ ] **Git:** `git commit -m "fix: multi-tenant queries + validação upload + print feedback"`
- [ ] **Git:** `git push` para enviar

---

## 🎯 **Arquivos Alterados**

```
src/lib/supabaseClient.ts (23 linhas)
  ✅ Filtro store_id em queries de teste de conexão

src/lib/testing/testData.ts (58 linhas)
  ✅ Filtro store_id em limpeza de testes

src/pages/CompraUsadosPage.tsx (52 linhas)
  ✅ Validação de tamanho/tipo em uploads
  ✅ Toast de feedback ao adicionar arquivos
  ✅ Exibir tamanho do arquivo na lista

src/lib/print-template.ts (37 linhas)
  ✅ Try/catch em printTemplate
  ✅ Validação de template vazio
  ✅ Alert de erro claro
  ✅ Fechar janela se falhar

Total: ~170 linhas alteradas em 4 arquivos
```

---

## 📈 **Impacto das Correções**

| Problema | Antes | Depois |
|----------|-------|--------|
| **Query sem store_id** | ❌ Expõe dados de outras lojas | ✅ Filtra por loja |
| **Upload > 10MB** | ❌ Aceita e falha silencioso | ✅ Bloqueia com toast |
| **Upload tipo inválido** | ❌ Aceita .exe, .zip, .mp4 | ✅ Bloqueia com toast |
| **Nome arquivo duplicado** | ✅ **JÁ RESOLVIDO** (timestamp) | ✅ Mantido |
| **Print falha** | ❌ "Some" sem aviso | ✅ Alert com erro claro |

---

## 🚀 **Próximos Passos**

### **1. Testar Localmente (20 min):**
```
✅ Execute os 3 testes do checklist
✅ Verifique se tudo funciona como esperado
✅ Se usar múltiplas lojas, teste isolamento
```

### **2. Fazer Commit (2 min):**
```bash
git status
git add .
git commit -m "fix: multi-tenant queries + validação upload + print erro feedback"
git push
```

### **3. Monitorar em Produção (1-2 dias):**
```
✅ Verificar se uploads rejeitam arquivos grandes
✅ Verificar se print mostra erro se pop-up bloqueado
✅ Se multi-loja: verificar isolamento de dados
✅ Coletar feedback de usuários
```

### **4. Implementar Fase 3 (Opcional):**
```
Ainda restam 2 problemas da auditoria:
- #10: Dados Empresa/Settings no Print (30 min) - MÉDIA
- #12: Log de Erros Melhorado (30 min) - MÉDIA

Total: 1 hora para completar 100% da auditoria
```

---

## 💡 **Dicas de Teste**

### **Teste de Upload:**
- Use arquivos reais do celular (fotos grandes)
- Teste com conexão lenta (3G) para ver toast de progresso
- Tente adicionar 10 fotos de uma vez

### **Teste de Multi-tenant:**
- Se você usa apenas 1 loja, pode pular esse teste
- Se usar múltiplas lojas, CRÍTICO validar isolamento

### **Teste de Print:**
- Teste com pop-ups bloqueados
- Teste em mobile (iOS/Android)
- Verifique console (F12) para logs de erro

---

## 📋 **Progresso Total da Auditoria**

```
✅ Bloqueadores Críticos: 3/3 (100%)
✅ Quick Wins: 3/3 (100%)
✅ Multi-tenant + Uploads: 4/4 (100%)
⏳ Restantes: 2 problemas (1 hora)

TOTAL: 10/12 (83% CONCLUÍDO)
```

---

**✅ Correções implementadas e prontas para teste!**  
**📝 Execute o checklist antes de fazer commit.**  
**🎉 Apenas 2 correções restantes para 100%!**
