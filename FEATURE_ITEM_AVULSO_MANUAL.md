# ✏️ FEATURE: Item Avulso/Manual na Venda Rápida

**Data:** 31/01/2026  
**Status:** ✅ **IMPLEMENTADO**

---

## 🎯 **SOLICITAÇÃO DO USUÁRIO**

### **Problema:**
- ❌ **Venda Rápida** só permite adicionar produtos cadastrados
- ❌ Para vender um item avulso (serviço, produto único), precisa cadastrar no estoque
- ❌ Processo lento para vendas rápidas de items não recorrentes

### **Solução:**
- ✅ Adicionar botão "Item Manual"
- ✅ Permitir digitar nome e valor livremente
- ✅ **Não desconta estoque** (item avulso)
- ✅ **Gera lançamento financeiro** normal

---

## 📊 **IMPLEMENTAÇÃO**

### **1️⃣ Interface `ItemVenda` - Atualizada**

**Arquivo:** `src/types/index.ts`

```typescript
export interface ItemVenda {
  produtoId?: string; // ✅ OPCIONAL - undefined para items manuais
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  custoUnitario?: number;
  custoTotal?: number;
  isManual?: boolean; // ✅ NOVO - Indica item manual (não desconta estoque)
}
```

**Mudanças:**
- ✅ `produtoId` agora é **opcional** (`?`)
- ✅ `isManual` indica se é item avulso

---

### **2️⃣ VendasPage - Botões**

**Arquivo:** `src/pages/VendasPage.tsx`

**Antes:**
```tsx
<button onClick={adicionarItem}>
  + Adicionar Item
</button>
```

**Depois:**
```tsx
<div style={{ display: 'flex', gap: '0.5rem' }}>
  <button onClick={adicionarItem}>
    + Adicionar Item
  </button>
  <button 
    onClick={adicionarItemManual}
    style={{ background: 'var(--warning)' }}
  >
    ✏️ Item Manual
  </button>
</div>
```

---

### **3️⃣ VendasPage - Renderização de Items**

**Lógica:**

```tsx
{item.isManual ? (
  // ✅ ITEM MANUAL: Input de texto livre
  <input
    type="text"
    value={item.produtoNome}
    onChange={(e) => atualizarItem(index, { produtoNome: e.target.value })}
    placeholder="Nome do produto/serviço..."
    style={{ 
      borderLeft: '3px solid var(--warning)',
      fontStyle: 'italic'
    }}
    title="Item manual (não desconta estoque)"
  />
) : (
  // ✅ ITEM CADASTRADO: Select de produtos
  <select value={item.produtoId} onChange={...}>
    {produtos.map(prod => (
      <option key={prod.id} value={prod.id}>
        {prod.nome} - {formatCurrency(prod.preco)}
      </option>
    ))}
  </select>
)}
```

**Visual:**
- ✅ Item manual: Input com **borda laranja** à esquerda
- ✅ Item cadastrado: Select normal

---

### **4️⃣ Validação - Atualizada**

**VendasPage.tsx - Validação ao Salvar:**

```typescript
// ✅ Items manuais devem ter nome e preço
const itemManualInvalido = itens.find(item => 
  item.isManual && (!item.produtoNome?.trim() || item.precoUnitario <= 0)
);
if (itemManualInvalido) {
  showToast('❌ Items manuais devem ter nome e preço válidos!', 'error');
  return;
}

// ✅ Items cadastrados devem ter produtoId válido
const itemProdutoInvalido = itens.find(item => 
  !item.isManual && (!item.produtoId || !produtos.find(p => p.id === item.produtoId))
);
if (itemProdutoInvalido) {
  showToast('❌ Um ou mais produtos cadastrados são inválidos!', 'error');
  return;
}
```

---

### **5️⃣ Estoque - Não Descontado**

**Arquivo:** `src/lib/vendas.ts`

**Validação de Produtos:**
```typescript
// ✅ Pular items manuais na validação de produtos
novaVenda.itens.forEach((item, index) => {
  if (item.isManual) return; // ✅ Não validar produto
  
  const produto = getProdutoPorId(item.produtoId!);
  if (!produto) {
    produtosInvalidos.push({ produtoId: item.produtoId!, index });
  }
});
```

**Desconto de Estoque:**
```typescript
// ✅ Validar estoque
for (const item of novaVenda.itens) {
  if (item.isManual) continue; // ✅ Pular item manual
  
  const produto = getProdutoPorId(item.produtoId!)!;
  // ... validar estoque normal
}

// ✅ Atualizar estoque
for (const item of novaVenda.itens) {
  if (item.isManual) continue; // ✅ Pular item manual
  
  const produto = getProdutoPorId(item.produtoId!);
  const novoEstoque = produto.estoque - item.quantidade;
  await atualizarProduto(produto.id, { estoque: novoEstoque });
}
```

**Resultado:**
- ✅ Items manuais **NÃO descontam estoque**
- ✅ Items cadastrados **descontam estoque** normalmente

---

### **6️⃣ Validação de Tipo - Atualizada**

**Arquivo:** `src/lib/validate.ts`

```typescript
export function isValidVenda(obj: any): obj is Venda {
  return (
    // ... validações padrão ...
    obj.itens.every((item: any) => {
      // ✅ produtoId é opcional para items manuais
      const hasValidId = !item.isManual ? typeof item.produtoId === 'string' : true;
      return (
        hasValidId &&
        typeof item.produtoNome === 'string' &&
        typeof item.quantidade === 'number' &&
        item.quantidade > 0 &&
        typeof item.precoUnitario === 'number' &&
        item.precoUnitario >= 0 &&
        typeof item.subtotal === 'number' &&
        item.subtotal >= 0
      );
    })
  );
}
```

---

## 🎨 **INTERFACE FINAL**

### **Modal de Venda:**

```
┌─────────────────────────────────────────────────────┐
│ ⚡ Nova Venda                                 [X]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 📦 Itens da Venda                                   │
│                                                     │
│ [+ Adicionar Item] [✏️ Item Manual]  ← NOVO!        │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ┌───────────────────────┬───┬────┬──────┬───┐  │ │
│ │ │ Produto               │Qtd│Preço│Total│ X │  │ │
│ │ ├───────────────────────┼───┼────┼──────┼───┤  │ │
│ │ │ [Cabo USB...]         │ 1 │10.00│10.00│ × │  │ ← Produto Cadastrado
│ │ ├───────────────────────┼───┼────┼──────┼───┤  │ │
│ │ │ Instalação Windows... │ 1 │80.00│80.00│ × │  │ ← Item Manual (borda laranja)
│ │ └───────────────────────┴───┴────┴──────┴───┘  │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ 💰 Total: R$ 90,00                                  │
│                                                     │
│ [Cancelar]                    [Finalizar Venda]    │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 **COMO USAR**

### **Passo 1: Abrir Venda Rápida**
```
1. Ir em "Vendas"
2. Clicar em "⚡ Venda Rápida"
```

### **Passo 2: Adicionar Item Manual**
```
1. Clicar em "✏️ Item Manual"
2. Digite o nome: "Instalação Windows"
3. Digite o preço: "80.00"
4. Ajuste quantidade se necessário
```

### **Passo 3: Adicionar Item Cadastrado** (Opcional)
```
1. Clicar em "+ Adicionar Item"
2. Selecionar produto do dropdown
3. Ajustar quantidade/preço se necessário
```

### **Passo 4: Finalizar Venda**
```
1. Escolher forma de pagamento
2. Clicar em "Finalizar Venda"
3. ✅ Item manual NÃO desconta estoque
4. ✅ Item cadastrado desconta estoque normalmente
```

---

## ✅ **COMPORTAMENTO**

### **Cenário 1: Item Manual**
```
AÇÃO: Vender "Instalação Windows" R$ 80,00

RESULTADO:
✅ Venda criada com sucesso
✅ Lançamento financeiro: +R$ 80,00
❌ Estoque NÃO descontado (item avulso)
✅ Item aparece na impressão
```

### **Cenário 2: Item Cadastrado + Manual**
```
AÇÃO: 
- 1x Cabo USB (cadastrado) R$ 10,00
- 1x Instalação Windows (manual) R$ 80,00

RESULTADO:
✅ Venda criada com sucesso
✅ Lançamento financeiro: +R$ 90,00
✅ Cabo USB: Estoque descontado -1
❌ Instalação: Estoque NÃO afetado
✅ Ambos aparecem na impressão
```

### **Cenário 3: Validação**
```
TENTATIVA: Item manual sem nome ou preço = 0

RESULTADO:
❌ "Items manuais devem ter nome e preço válidos!"
❌ Venda não é criada
```

---

## 🧪 **COMO TESTAR**

### **Teste 1: Item Manual Simples**
```bash
1. Abrir Venda Rápida
2. Clicar "✏️ Item Manual"
3. Nome: "Serviço de Instalação"
4. Preço: "50.00"
5. Finalizar Venda
6. ✅ Verificar: Venda criada
7. ✅ Verificar: Estoque de produtos não afetado
8. ✅ Verificar: Lançamento financeiro +R$ 50,00
```

### **Teste 2: Validação de Item Manual**
```bash
1. Adicionar Item Manual
2. Deixar nome vazio
3. Tentar finalizar
4. ✅ Verificar: Erro "Items manuais devem ter nome e preço válidos!"
```

### **Teste 3: Item Cadastrado + Manual**
```bash
1. Adicionar Item Cadastrado (ex: Cabo USB, estoque = 10)
2. Adicionar Item Manual (ex: Instalação, R$ 80)
3. Finalizar Venda
4. ✅ Verificar: Venda criada com 2 items
5. ✅ Verificar: Cabo USB estoque = 9
6. ✅ Verificar: Lançamento financeiro correto (soma dos dois)
```

### **Teste 4: Impressão**
```bash
1. Criar venda com item manual
2. Imprimir comprovante
3. ✅ Verificar: Item manual aparece na impressão
4. ✅ Verificar: Formatação correta
```

---

## 📋 **ARQUIVOS MODIFICADOS**

| Arquivo | Mudança | Status |
|---------|---------|--------|
| `src/types/index.ts` | `ItemVenda`: `produtoId` opcional, `isManual` novo | ✅ |
| `src/pages/VendasPage.tsx` | Botão "Item Manual", renderização condicional | ✅ |
| `src/lib/vendas.ts` | Pular items manuais no estoque | ✅ |
| `src/lib/validate.ts` | Validação aceita items manuais | ✅ |

---

## 💡 **VANTAGENS**

### **Para o Usuário:**
1. ✅ Vender serviços sem cadastrar produto
2. ✅ Vender items únicos rapidamente
3. ✅ Não poluir cadastro de produtos
4. ✅ Processo mais rápido (menos cliques)

### **Para o Sistema:**
1. ✅ Flexibilidade na venda
2. ✅ Separação clara: item manual vs cadastrado
3. ✅ Lógica de estoque preservada
4. ✅ Validação robusta

---

## 🔍 **CASOS DE USO**

### **1. Serviços Únicos**
```
- Instalação de software
- Configuração de rede
- Reparo pontual
- Consultoria
```

### **2. Produtos Não Recorrentes**
```
- Item usado (compra única)
- Produto especial do cliente
- Peça importada específica
```

### **3. Taxas e Adicionais**
```
- Taxa de entrega
- Taxa de urgência
- Adicional de feriado
```

---

## ⚠️ **OBSERVAÇÕES IMPORTANTES**

### **✅ O que items manuais FAZEM:**
- ✅ Aparecem na venda
- ✅ Geram lançamento financeiro
- ✅ São impressos no comprovante
- ✅ Entram no cálculo de total
- ✅ Podem ter desconto aplicado
- ✅ Podem ter taxa de cartão

### **❌ O que items manuais NÃO FAZEM:**
- ❌ Não descontam estoque
- ❌ Não têm custo rastreável
- ❌ Não geram relatório de produto específico
- ❌ Não têm histórico de vendas por produto

---

## 🎯 **CONCLUSÃO**

✅ **FEATURE IMPLEMENTADA COM SUCESSO!**

**Items Manuais agora:**
- ✅ Podem ser adicionados facilmente
- ✅ Têm validação robusta
- ✅ Não afetam estoque
- ✅ Geram lançamento financeiro normal
- ✅ Aparecem na impressão

**Usuário pode:**
- ✅ Vender serviços sem cadastro
- ✅ Misturar items cadastrados e manuais
- ✅ Ter controle total sobre nome e preço
- ✅ Trabalhar mais rápido em vendas avulsas
