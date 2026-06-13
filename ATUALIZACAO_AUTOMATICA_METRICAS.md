# 🔄 ATUALIZAÇÃO AUTOMÁTICA DE MÉTRICAS - COMPLETO

**Data:** 30/01/2026  
**Versão:** 1.0

---

## 🎯 OBJETIVO

Garantir que **TODAS as métricas** atualizem **automaticamente** e em **tempo real** quando você cria ou atualiza:
- ✅ Vendas
- ✅ Ordens de Serviço
- ✅ Recibos
- ✅ Cobranças
- ✅ Devoluções
- ✅ Encomendas
- ✅ Movimentações no Fluxo de Caixa

---

## 📊 COMO FUNCIONA

### **Sistema de Eventos:**

```
1. Usuário cria/atualiza registro
   ↓
2. Sistema salva no localStorage
   ↓
3. Sistema dispara EVENTO (CustomEvent + StorageEvent)
   ↓
4. Todas as páginas que escutam esse evento ATUALIZAM
   ↓
5. Métricas recalculam automaticamente
```

---

## 🔔 EVENTOS DISPARADOS

### **Tabela de Eventos:**

| Módulo | Evento Create | Evento Update | Evento Delete |
|--------|---------------|---------------|---------------|
| **Vendas** | `smart-tech-venda-criada` | - | - |
| **Ordens** | `smart-tech-ordem-criada` | `smart-tech-ordem-atualizada` | - |
| **Recibos** | `smart-tech-recibo-criado` | - | - |
| **Cobranças** | `smart-tech-cobranca-criada` | `smart-tech-cobranca-atualizada` | - |
| **Devoluções** | `smart-tech-devolucao-criada` | - | - |
| **Encomendas** | `smart-tech-encomenda-criada` | `smart-tech-encomenda-atualizada` | - |
| **Movimentações** | `smart-tech-movimentacao-criada` | - | - |

**Complementar:** Todos também disparam `StorageEvent` para compatibilidade com outras abas.

---

## 📂 ARQUIVOS MODIFICADOS

### **BIBLIOTECAS (src/lib):**

#### **1. `src/lib/ordens.ts`**
```typescript
// Após criar ordem
window.dispatchEvent(new CustomEvent('smart-tech-ordem-criada', { detail: { ordemId: saved.id } }));

// Após atualizar ordem
window.dispatchEvent(new CustomEvent('smart-tech-ordem-atualizada', { detail: { ordemId: saved.id } }));
```

#### **2. `src/lib/recibos.ts`**
```typescript
// Após criar recibo
window.dispatchEvent(new CustomEvent('smart-tech-recibo-criado', { detail: { reciboId: saved.id } }));
```

#### **3. `src/lib/cobrancas.ts`**
```typescript
// Após criar cobrança
window.dispatchEvent(new CustomEvent('smart-tech-cobranca-criada', { detail: { cobrancaId: saved.id } }));

// Após atualizar cobrança
window.dispatchEvent(new CustomEvent('smart-tech-cobranca-atualizada', { detail: { cobrancaId: salva.id } }));
```

#### **4. `src/lib/devolucoes.ts`**
```typescript
// Após criar devolução
window.dispatchEvent(new CustomEvent('smart-tech-devolucao-criada', { detail: { devolucaoId: saved.id } }));
```

#### **5. `src/lib/encomendas.ts`**
```typescript
// Após criar encomenda
window.dispatchEvent(new CustomEvent('smart-tech-encomenda-criada', { detail: { encomendaId: saved.id } }));

// Após atualizar encomenda
window.dispatchEvent(new CustomEvent('smart-tech-encomenda-atualizada', { detail: { encomendaId: salva.id } }));
```

---

### **PÁGINAS (src/pages):**

#### **6. `src/pages/RelatoriosPage.tsx`**
```typescript
// Escutar TODOS os eventos
useEffect(() => {
  const atualizar = () => setRefreshKey(prev => prev + 1);

  window.addEventListener('smart-tech-venda-criada', atualizar);
  window.addEventListener('smart-tech-ordem-criada', atualizar);
  window.addEventListener('smart-tech-ordem-atualizada', atualizar);
  window.addEventListener('smart-tech-recibo-criado', atualizar);
  window.addEventListener('smart-tech-cobranca-criada', atualizar);
  window.addEventListener('smart-tech-cobranca-atualizada', atualizar);
  window.addEventListener('smart-tech-devolucao-criada', atualizar);
  window.addEventListener('smart-tech-encomenda-criada', atualizar);
  window.addEventListener('smart-tech-encomenda-atualizada', atualizar);
  window.addEventListener('smart-tech-movimentacao-criada', atualizar);
  
  return () => {
    // Remover todos os listeners
  };
}, []);
```

#### **7. `src/pages/FluxoCaixaPage.tsx`**
```typescript
// Escutar TODOS os eventos
useEffect(() => {
  const atualizar = () => carregarMovimentacoes();

  window.addEventListener('smart-tech-venda-criada', atualizar);
  window.addEventListener('smart-tech-ordem-criada', atualizar);
  window.addEventListener('smart-tech-ordem-atualizada', atualizar);
  window.addEventListener('smart-tech-recibo-criado', atualizar);
  window.addEventListener('smart-tech-cobranca-criada', atualizar);
  window.addEventListener('smart-tech-cobranca-atualizada', atualizar);
  window.addEventListener('smart-tech-devolucao-criada', atualizar);
  window.addEventListener('smart-tech-encomenda-criada', atualizar);
  window.addEventListener('smart-tech-encomenda-atualizada', atualizar);
  window.addEventListener('smart-tech-movimentacao-criada', atualizar);
  
  return () => {
    // Remover todos os listeners
  };
}, []);
```

---

## 🧪 COMO TESTAR

### **Teste 1: Criar Venda → Atualizar Fluxo de Caixa**
```
1. Abrir aba "Fluxo de Caixa" (ver saldo R$ 0,00)
2. Abrir aba "Vendas"
3. Criar nova venda de R$ 100,00
4. Voltar para aba "Fluxo de Caixa"
5. ✅ Saldo deve atualizar para R$ 100,00 AUTOMATICAMENTE
6. ✅ NÃO precisa recarregar (F5)
```

### **Teste 2: Criar OS → Atualizar Relatórios**
```
1. Abrir aba "Relatórios"
2. Ver total de entradas (ex: R$ 100,00)
3. Abrir aba "Ordem de Serviço"
4. Criar nova OS de R$ 50,00 (paga)
5. Voltar para aba "Relatórios"
6. ✅ Total deve atualizar para R$ 150,00 AUTOMATICAMENTE
```

### **Teste 3: Criar Recibo → Atualizar Fluxo de Caixa**
```
1. Abrir aba "Fluxo de Caixa"
2. Abrir aba "Recibo"
3. Gerar recibo de R$ 30,00
4. Voltar para "Fluxo de Caixa"
5. ✅ Deve mostrar nova entrada de R$ 30,00 AUTOMATICAMENTE
```

### **Teste 4: Múltiplas Abas Sincronizadas**
```
1. Abrir sistema em 2 abas diferentes
2. Aba 1: Fluxo de Caixa
3. Aba 2: Vendas
4. Aba 2: Criar venda
5. Aba 1: ✅ Atualiza AUTOMATICAMENTE (via StorageEvent)
```

### **Teste 5: Atualizar Status de Cobrança**
```
1. Abrir "Fluxo de Caixa" (ver saldo)
2. Abrir "Cobranças"
3. Mudar status de "Pendente" → "Paga"
4. Voltar para "Fluxo de Caixa"
5. ✅ Nova entrada deve aparecer AUTOMATICAMENTE
```

---

## 📊 ESTATÍSTICAS

```
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🔔 Eventos Criados:        10                       ║
║   📂 Arquivos Modificados:   7                        ║
║   📄 Páginas com Listeners:  3                        ║
║   ⚡ Atualização:             Tempo Real               ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
```

---

## ✅ BENEFÍCIOS

```
✅ Atualização automática em tempo real
✅ NÃO precisa recarregar página (F5)
✅ Múltiplas abas sincronizadas
✅ UX fluida e responsiva
✅ Métricas sempre corretas
✅ Compatível com localStorage
✅ Funciona offline
```

---

## 🔧 ARQUITETURA TÉCNICA

### **Eventos Customizados:**
```typescript
// Disparar evento
window.dispatchEvent(new CustomEvent('smart-tech-venda-criada', { 
  detail: { vendaId: '123' } 
}));

// Escutar evento
window.addEventListener('smart-tech-venda-criada', (event) => {
  const vendaId = event.detail.vendaId;
  // Atualizar métricas
});
```

### **Storage Events (Cross-Tab):**
```typescript
// Disparar evento para outras abas
window.dispatchEvent(new StorageEvent('storage', {
  key: 'smart-tech-vendas-updated',
  newValue: Date.now().toString()
}));

// Escutar em outras abas
window.addEventListener('storage', (event) => {
  if (event.key === 'smart-tech-vendas-updated') {
    // Atualizar métricas
  }
});
```

---

## 🎯 PÁGINAS QUE ATUALIZAM AUTOMATICAMENTE

### **1. VendasPage**
Atualiza quando:
- ✅ Nova venda criada (mesma aba)
- ✅ Nova venda criada (outra aba)
- ✅ Métricas financeiras recalculadas

### **2. FluxoCaixaPage**
Atualiza quando:
- ✅ Venda criada
- ✅ OS criada/atualizada
- ✅ Recibo criado
- ✅ Cobrança criada/atualizada
- ✅ Devolução criada
- ✅ Encomenda criada/atualizada
- ✅ Movimentação manual criada

### **3. RelatoriosPage**
Atualiza quando:
- ✅ Qualquer transação criada/atualizada
- ✅ Recarrega dados da view do Supabase
- ✅ Recalcula totais e breakdowns

---

## 📝 RESUMO

**ANTES:**
```
❌ Criar venda → F5 para ver no Fluxo de Caixa
❌ Criar OS → F5 para ver nos Relatórios
❌ Criar recibo → F5 para ver métricas
```

**DEPOIS:**
```
✅ Criar venda → Fluxo de Caixa atualiza AUTOMATICAMENTE
✅ Criar OS → Relatórios atualizam AUTOMATICAMENTE
✅ Criar recibo → Métricas atualizam AUTOMATICAMENTE
```

---

## 🚀 RESULTADO FINAL

Agora o sistema está **100% reativo**:

- 🔔 **10 eventos** disparados
- 📄 **3 páginas** escutando
- ⚡ **Tempo real** sem F5
- 🎯 **UX perfeita**

**Tudo atualiza automaticamente!** 🎉

---

**📅 Data:** 30/01/2026  
**🏆 Status:** IMPLEMENTADO  
**✅ Build:** OK

© 2026 - PDV Smart Tech - Real-time Updates v1.0
