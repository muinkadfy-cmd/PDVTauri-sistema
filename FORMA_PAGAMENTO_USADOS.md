# 💳 FORMA DE PAGAMENTO EM COMPRA/VENDA USADOS

**Data:** 30/01/2026  
**Versão:** 1.0

---

## 🎯 OBJETIVO

Adicionar campos de **forma de pagamento** nas páginas de **Compra de Usados** e **Venda de Usados**, padronizando com as outras abas do sistema (Vendas, Ordens de Serviço, etc).

---

## 💳 FORMAS DE PAGAMENTO DISPONÍVEIS

```
💵 Dinheiro
📱 PIX
💳 Débito
💳 Crédito
📄 Boleto
💰 Outro
```

---

## 📂 ALTERAÇÕES REALIZADAS

### **1. Tipos (`src/types/index.ts`)**

#### **Interface `Usado`:**
```typescript
export interface Usado {
  id: string;
  vendedorId?: string;
  titulo: string;
  descricao?: string;
  imei?: string;
  valorCompra: number;
  formaPagamento?: FormaPagamento; // ✅ NOVO
  status: UsadoStatus;
  storeId?: string;
  created_at?: string;
  updated_at?: string;
}
```

#### **Interface `UsadoVenda`:**
```typescript
export interface UsadoVenda {
  id: string;
  usadoId: string;
  compradorId?: string;
  valorVenda: number;
  formaPagamento?: FormaPagamento; // ✅ NOVO
  dataVenda: string;
  observacoes?: string;
  storeId?: string;
  created_at?: string;
  updated_at?: string;
}
```

---

### **2. Compra de Usados (`src/pages/CompraUsadosPage.tsx`)**

#### **Estado do Formulário:**
```typescript
const [usadoForm, setUsadoForm] = useState({
  titulo: '',
  descricao: '',
  imei: '',
  valorCompra: '',
  formaPagamento: 'dinheiro' as const  // ✅ NOVO (default)
});
```

#### **Criação do Usado:**
```typescript
const usado = await criarUsado({
  vendedorId,
  titulo: usadoForm.titulo,
  descricao: usadoForm.descricao || undefined,
  imei: usadoForm.imei || undefined,
  valorCompra: Number(usadoForm.valorCompra) || 0,
  formaPagamento: usadoForm.formaPagamento || 'dinheiro'  // ✅ NOVO
});
```

#### **UI - Select de Forma de Pagamento:**
```tsx
<label className="usados-label">Forma de pagamento *</label>
<select
  className="usados-input"
  value={usadoForm.formaPagamento}
  onChange={(e) => setUsadoForm((p) => ({ ...p, formaPagamento: e.target.value as any }))}
  disabled={saving}
>
  <option value="dinheiro">💵 Dinheiro</option>
  <option value="pix">📱 PIX</option>
  <option value="debito">💳 Débito</option>
  <option value="credito">💳 Crédito</option>
  <option value="boleto">📄 Boleto</option>
  <option value="outro">💰 Outro</option>
</select>
```

**Posição:** Logo após o campo "Valor de compra (R$)"

---

### **3. Venda de Usados (`src/pages/VendaUsadosPage.tsx`)**

#### **Estado:**
```typescript
const [formaPagamento, setFormaPagamento] = useState<'dinheiro' | 'pix' | 'debito' | 'credito' | 'boleto' | 'outro'>('dinheiro');
```

#### **Registro da Venda:**
```typescript
const res = await registrarVendaUsado(selectedUsadoId, {
  compradorId,
  valorVenda: Number(valorVenda) || 0,
  formaPagamento: formaPagamento,  // ✅ NOVO
  observacoes: observacoes || undefined
});
```

#### **Reset do Formulário:**
```typescript
setFormaPagamento('dinheiro');  // ✅ NOVO
```

#### **UI - Select de Forma de Pagamento:**
```tsx
<label className="usados-label">Forma de pagamento *</label>
<select
  className="usados-input"
  value={formaPagamento}
  onChange={(e) => setFormaPagamento(e.target.value as any)}
  disabled={saving}
>
  <option value="dinheiro">💵 Dinheiro</option>
  <option value="pix">📱 PIX</option>
  <option value="debito">💳 Débito</option>
  <option value="credito">💳 Crédito</option>
  <option value="boleto">📄 Boleto</option>
  <option value="outro">💰 Outro</option>
</select>
```

**Posição:** Entre "Valor de venda (R$)" e "Observações"

---

### **4. Lógica de Negócio (`src/lib/usados.ts`)**

#### **Função `registrarVendaUsado` - Assinatura Atualizada:**
```typescript
export async function registrarVendaUsado(
  usadoId: string,
  venda: {
    compradorId?: string;
    valorVenda: number;
    formaPagamento?: string;  // ✅ NOVO
    dataVenda?: string;
    observacoes?: string;
  }
): Promise<{ success: boolean; error?: string; venda?: UsadoVenda; usado?: Usado }>
```

#### **Criação da Venda com Forma de Pagamento:**
```typescript
const vendaRow: UsadoVenda = {
  id: generateId(),
  usadoId,
  compradorId: venda.compradorId,
  valorVenda: Number(venda.valorVenda) || 0,
  formaPagamento: venda.formaPagamento as any || 'dinheiro',  // ✅ NOVO
  dataVenda: venda.dataVenda || now,
  observacoes: venda.observacoes?.trim(),
  created_at: now,
  updated_at: now,
  storeId: STORE_ID as any
};
```

---

## 🎨 INTERFACE DO USUÁRIO

### **Compra de Usados:**
```
┌─────────────────────────────────────────┐
│ 📦 Aparelho usado                       │
├─────────────────────────────────────────┤
│ Título *                                │
│ [iPhone 11 64GB                       ] │
│                                         │
│ IMEI                                    │
│ [                                     ] │
│                                         │
│ Descrição                               │
│ [                                     ] │
│                                         │
│ Valor de compra (R$)                    │
│ [500.00                               ] │
│                                         │
│ Forma de pagamento *                    │
│ [💵 Dinheiro              ▼           ] │  ← NOVO
│                                         │
└─────────────────────────────────────────┘
```

### **Venda de Usados:**
```
┌─────────────────────────────────────────┐
│ 💰 Venda                                │
├─────────────────────────────────────────┤
│ Valor de venda (R$) *                   │
│ [700.00                               ] │
│                                         │
│ Forma de pagamento *                    │
│ [📱 PIX                   ▼           ] │  ← NOVO
│                                         │
│ Observações                             │
│ [                                     ] │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🧪 COMO TESTAR

### **Teste 1: Compra com Forma de Pagamento**
```
1. Ir em "Compra (Usados)"
2. Preencher dados do aparelho
3. Valor de compra: R$ 500,00
4. Forma de pagamento: Selecionar "PIX"
5. Clicar em "💾 Salvar Compra"
6. ✅ Compra salva com formaPagamento = 'pix'
7. ✅ Aparece na lista de estoque
```

### **Teste 2: Venda com Forma de Pagamento**
```
1. Ir em "Venda (Usados)"
2. Selecionar item em estoque
3. Valor de venda: R$ 700,00
4. Forma de pagamento: Selecionar "Débito"
5. Clicar em "✅ Confirmar Venda"
6. ✅ Venda registrada com formaPagamento = 'debito'
7. ✅ Item marcado como vendido
```

### **Teste 3: Verificar Defaults**
```
1. Abrir "Compra (Usados)"
2. ✅ Forma de pagamento default: "Dinheiro"
3. Abrir "Venda (Usados)"
4. ✅ Forma de pagamento default: "Dinheiro"
```

### **Teste 4: Todas as Formas de Pagamento**
```
Testar cada opção do select:
✅ Dinheiro
✅ PIX
✅ Débito
✅ Crédito
✅ Boleto
✅ Outro
```

---

## 📊 PADRONIZAÇÃO COM OUTRAS ABAS

Agora **Compra/Venda Usados** tem a mesma estrutura de **Vendas** e **Ordens de Serviço**:

| Campo | Vendas | OS | Compra Usados | Venda Usados |
|-------|--------|-------|---------------|--------------|
| **Forma Pagamento** | ✅ | ✅ | ✅ | ✅ |
| **Opções** | 6 | 6 | 6 | 6 |
| **Default** | Dinheiro | Dinheiro | Dinheiro | Dinheiro |
| **Obrigatório** | ✅ | ✅ | ✅ | ✅ |

---

## 💾 PERSISTÊNCIA DE DADOS

### **localStorage:**
```javascript
// Compra de Usado
{
  "id": "abc123",
  "titulo": "iPhone 11",
  "valorCompra": 500,
  "formaPagamento": "pix",  // ✅ Salvo
  "status": "em_estoque"
}

// Venda de Usado
{
  "id": "xyz789",
  "usadoId": "abc123",
  "valorVenda": 700,
  "formaPagamento": "debito",  // ✅ Salvo
  "dataVenda": "2026-01-30"
}
```

### **Supabase (sincronização automática):**
Os dados serão sincronizados automaticamente pelo sync-engine, incluindo o campo `formaPagamento`.

---

## ✅ BENEFÍCIOS

```
✅ Padronização com outras abas do sistema
✅ Rastreamento de forma de pagamento em compras
✅ Rastreamento de forma de pagamento em vendas
✅ Relatórios mais precisos (futuramente)
✅ Controle financeiro detalhado
✅ UX consistente em todo o sistema
✅ Dados mais completos para análise
```

---

## 🔮 MELHORIAS FUTURAS (Não Implementadas Agora)

```
📊 Relatório de vendas por forma de pagamento
📊 Métricas de preferência de pagamento
💳 Campos adicionais para cartão (parcelas, taxa)
📈 Dashboard com breakdown por pagamento
🔍 Filtro por forma de pagamento na lista
```

---

## 📝 RESUMO

**ANTES:**
```
❌ Não havia campo de forma de pagamento
❌ Impossível rastrear como foi pago
❌ Dados incompletos
```

**DEPOIS:**
```
✅ Campo de forma de pagamento obrigatório
✅ 6 opções disponíveis
✅ Default seguro (Dinheiro)
✅ Padronizado com Vendas/OS
✅ Dados completos e consistentes
```

---

**📅 Data:** 30/01/2026  
**🏆 Status:** IMPLEMENTADO  
**✅ Build:** OK

© 2026 - PDV Smart Tech - Payment Method v1.0
