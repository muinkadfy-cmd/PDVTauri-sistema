# 🗑️ EXCLUSÃO DE COMPRA/VENDA USADOS COM ESTORNO AUTOMÁTICO

**Data:** 30/01/2026  
**Versão:** 1.0

---

## 🎯 OBJETIVO

Implementar exclusão protegida por senha (1234) nas páginas de **Compra de Usados** e **Venda de Usados**, com **estorno automático no fluxo de caixa**.

---

## 🔐 FUNCIONALIDADES

### **1. Exclusão de Compra de Usados**
```
Ao excluir uma compra:
✅ Solicita senha (1234)
✅ Remove o usado do estoque
✅ Cria ENTRADA no fluxo de caixa (estorno da compra)
✅ Atualiza lista automaticamente
```

### **2. Exclusão de Venda de Usados**
```
Ao excluir uma venda:
✅ Solicita senha (1234)
✅ Remove o registro de venda
✅ Cria SAÍDA no fluxo de caixa (estorno da venda)
✅ Retorna o usado ao estoque
✅ Atualiza lista automaticamente
```

---

## 📂 ARQUIVOS MODIFICADOS

### **1. `src/lib/usados.ts`**

#### **Função: `deletarUsado(id)`**
```typescript
export async function deletarUsado(id: string): Promise<boolean> {
  const usado = usadosRepo.getById(id);
  
  if (!usado) {
    logger.error('[Usados] Usado não encontrado para exclusão');
    return false;
  }

  // Criar estorno no fluxo de caixa (ENTRADA, pois a compra foi uma SAÍDA)
  try {
    const usuario = 'Sistema';
    await createMovimentacao(
      'entrada', // Tipo: entrada (estorno da compra)
      usado.valorCompra || 0, // Valor que saiu originalmente
      usuario,
      `🔄 Estorno - Compra de usado "${usado.titulo}" excluída`,
      { origem_tipo: 'compra_usado', origem_id: usado.id, categoria: 'Estorno de Compra Usado' }
    );
    logger.log(`[Usados] ✅ Estorno criado para compra excluída: ${usado.titulo}`);
  } catch (error) {
    logger.error('[Usados] Erro ao criar estorno (exclusão continuou):', error);
  }

  // Remover o usado
  const removido = await usadosRepo.remove(id);

  // Disparar eventos para atualizar outras abas e componentes
  if (removido) {
    try {
      window.dispatchEvent(new CustomEvent('smart-tech-usado-deletado', { detail: { usadoId: id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-usados-updated',
        newValue: Date.now().toString()
      }));
    } catch (e) {
      // Ignorar erros ao disparar eventos
    }
  }

  return removido;
}
```

#### **Função: `deletarVendaUsado(vendaId)`**
```typescript
export async function deletarVendaUsado(vendaId: string): Promise<boolean> {
  const venda = usadosVendasRepo.getById(vendaId);
  
  if (!venda) {
    logger.error('[Usados] Venda não encontrada para exclusão');
    return false;
  }

  // Buscar o usado relacionado
  const usado = usadosRepo.getById(venda.usadoId);

  // Criar estorno no fluxo de caixa (SAÍDA, pois a venda foi uma ENTRADA)
  try {
    const usuario = 'Sistema';
    const tituloUsado = usado?.titulo || 'item usado';
    await createMovimentacao(
      'saida', // Tipo: saída (estorno da venda)
      venda.valorVenda || 0, // Valor que entrou originalmente
      usuario,
      `🔄 Estorno - Venda de usado "${tituloUsado}" excluída`,
      { origem_tipo: 'venda_usado', origem_id: venda.id, categoria: 'Estorno de Venda Usado' }
    );
    logger.log(`[Usados] ✅ Estorno criado para venda excluída: ${tituloUsado}`);
  } catch (error) {
    logger.error('[Usados] Erro ao criar estorno (exclusão continuou):', error);
  }

  // Remover a venda
  const removido = await usadosVendasRepo.remove(vendaId);

  // Retornar o usado para estoque se a exclusão foi bem-sucedida
  if (removido && usado && usado.status === 'vendido') {
    try {
      await atualizarUsado(usado.id, { status: 'em_estoque' });
      logger.log(`[Usados] ✅ Usado "${usado.titulo}" retornado ao estoque`);
    } catch (error) {
      logger.error('[Usados] Erro ao retornar usado ao estoque:', error);
    }
  }

  // Disparar eventos para atualizar outras abas e componentes
  if (removido) {
    try {
      window.dispatchEvent(new CustomEvent('smart-tech-venda-usado-deletada', { detail: { vendaId } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-usados-updated',
        newValue: Date.now().toString()
      }));
    } catch (e) {
      // Ignorar erros ao disparar eventos
    }
  }

  return removido;
}
```

#### **Funções Auxiliares Adicionadas:**
```typescript
export function getVendasUsados(): UsadoVenda[] {
  const items = usadosVendasRepo.list();
  return filterValid(items, isValidUsadoVenda);
}

export function getVendaUsadoById(id: string): UsadoVenda | null {
  return usadosVendasRepo.getById(id);
}
```

---

### **2. `src/pages/CompraUsadosPage.tsx`**

#### **Imports Adicionados:**
```typescript
import { deletarUsado } from '@/lib/usados';
import PasswordPrompt, { usePasswordPrompt } from '@/components/ui/PasswordPrompt';
```

#### **Estado Adicionado:**
```typescript
const passwordPrompt = usePasswordPrompt();
const [usadoParaDeletar, setUsadoParaDeletar] = useState<string | null>(null);
```

#### **Funções de Exclusão:**
```typescript
const handleDeletar = (id: string) => {
  setUsadoParaDeletar(id);
  passwordPrompt.requestPassword(() => executarExclusao(id));
};

const executarExclusao = async (id: string) => {
  try {
    const usado = usados.find(u => u.id === id);
    const sucesso = await deletarUsado(id);
    if (sucesso) {
      showToast(`✅ Compra "${usado?.titulo || 'usado'}" excluída e estornada!`, 'success');
      carregarUsadosComMiniaturas();
    } else {
      showToast('❌ Erro ao excluir compra', 'error');
    }
  } catch (error) {
    showToast('❌ Erro ao excluir compra', 'error');
  } finally {
    setUsadoParaDeletar(null);
  }
};
```

#### **Botão de Exclusão (Adicionado em cada card de usado):**
```typescript
<button
  className="btn-danger"
  onClick={() => handleDeletar(u.id)}
  style={{ 
    padding: '0.5rem 1rem',
    background: 'var(--danger)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  }}
  title="Excluir compra (requer senha)"
>
  🗑️ Excluir
</button>
```

#### **Componente PasswordPrompt (Renderizado no final):**
```typescript
<PasswordPrompt
  isOpen={passwordPrompt.isOpen}
  onClose={passwordPrompt.handleClose}
  onConfirm={passwordPrompt.handleConfirm}
/>
```

---

### **3. `src/pages/VendaUsadosPage.tsx`**

#### **Imports Adicionados:**
```typescript
import { getVendasUsados, deletarVendaUsado } from '@/lib/usados';
import type { UsadoVenda } from '@/types';
import PasswordPrompt, { usePasswordPrompt } from '@/components/ui/PasswordPrompt';
```

#### **Estado Adicionado:**
```typescript
const passwordPrompt = usePasswordPrompt();
const [vendaParaDeletar, setVendaParaDeletar] = useState<string | null>(null);
const [vendas, setVendas] = useState<UsadoVenda[]>([]);
```

#### **Função de Carregamento:**
```typescript
const carregarDados = () => {
  setPessoas(getPessoas());
  setEstoque(getUsadosEmEstoque());
  setVendas(getVendasUsados());
};
```

#### **Funções de Exclusão:**
```typescript
const handleDeletar = (id: string) => {
  setVendaParaDeletar(id);
  passwordPrompt.requestPassword(() => executarExclusao(id));
};

const executarExclusao = async (id: string) => {
  try {
    const venda = vendas.find(v => v.id === id);
    const sucesso = await deletarVendaUsado(id);
    if (sucesso) {
      showToast(`✅ Venda excluída e estornada! Item retornado ao estoque.`, 'success');
      carregarDados();
    } else {
      showToast('❌ Erro ao excluir venda', 'error');
    }
  } catch (error) {
    showToast('❌ Erro ao excluir venda', 'error');
  } finally {
    setVendaParaDeletar(null);
  }
};
```

#### **Lista de Vendas Realizadas (Adicionada):**
```typescript
{vendas.length > 0 && (
  <div className="usados-card" style={{ marginTop: '2rem' }}>
    <h2>📋 Vendas Realizadas</h2>
    <div className="vendas-list">
      {vendas
        .sort((a, b) => (b.dataVenda || '').localeCompare(a.dataVenda || ''))
        .slice(0, 10)
        .map((venda) => {
          const usado = estoque.find(u => u.id === venda.usadoId);
          const comprador = pessoas.find(p => p.id === venda.compradorId);
          const dataVenda = venda.dataVenda ? new Date(venda.dataVenda).toLocaleDateString('pt-BR') : '';

          return (
            <div key={venda.id} className="venda-card">
              <div>
                <strong>{usado?.titulo || 'Item vendido'}</strong>
                <div>{comprador?.nome || 'Comprador não identificado'} • {dataVenda}</div>
                <div>R$ {(venda.valorVenda || 0).toFixed(2).replace('.', ',')}</div>
              </div>
              <button onClick={() => handleDeletar(venda.id)}>
                🗑️ Excluir
              </button>
            </div>
          );
        })}
    </div>
  </div>
)}
```

#### **Componente PasswordPrompt (Renderizado no final):**
```typescript
<PasswordPrompt
  isOpen={passwordPrompt.isOpen}
  onClose={passwordPrompt.handleClose}
  onConfirm={passwordPrompt.handleConfirm}
/>
```

---

## 🔔 EVENTOS DISPARADOS

| Ação | Evento | Atualiza |
|------|--------|----------|
| Criar Venda Usado | `smart-tech-venda-usado-criada` | Fluxo, Relatórios |
| Deletar Usado | `smart-tech-usado-deletado` | Estoque, Fluxo |
| Deletar Venda Usado | `smart-tech-venda-usado-deletada` | Estoque, Fluxo, Vendas |

Complementar: Todos também disparam `StorageEvent` com key `smart-tech-usados-updated`.

---

## 🧪 COMO TESTAR

### **Teste 1: Excluir Compra de Usado**
```
1. Ir em "Compra (Usados)"
2. Ver lista de usados em estoque
3. Clicar em "🗑️ Excluir" em um item
4. Digitar senha "1234"
5. ✅ Item removido do estoque
6. ✅ Estorno criado no fluxo de caixa (ENTRADA)
7. ✅ Toast de sucesso exibido
```

### **Teste 2: Excluir Venda de Usado**
```
1. Ir em "Venda (Usados)"
2. Criar uma venda (se não houver)
3. Rolar até "📋 Vendas Realizadas"
4. Clicar em "🗑️ Excluir" em uma venda
5. Digitar senha "1234"
6. ✅ Venda removida
7. ✅ Estorno criado no fluxo de caixa (SAÍDA)
8. ✅ Item retornado ao estoque
9. ✅ Toast de sucesso exibido
```

### **Teste 3: Senha Incorreta**
```
1. Tentar excluir qualquer item
2. Digitar senha errada (ex: "0000")
3. ✅ Mensagem de erro exibida
4. ✅ Contador de tentativas (1/3)
5. Digitar senha errada mais 2 vezes
6. ✅ Modal fecha automaticamente após 3 tentativas
```

### **Teste 4: Verificar Estorno no Fluxo de Caixa**
```
1. Ir em "Fluxo de Caixa"
2. Criar uma compra de usado (R$ 100,00)
3. Ver movimentação de SAÍDA de R$ 100,00
4. Excluir a compra
5. ✅ Nova movimentação de ENTRADA de R$ 100,00 (estorno)
6. ✅ Descrição: "🔄 Estorno - Compra de usado..."
```

### **Teste 5: Verificar Retorno ao Estoque**
```
1. Ir em "Venda (Usados)"
2. Ver estoque com 3 itens
3. Criar uma venda (estoque fica com 2 itens)
4. Excluir a venda criada
5. ✅ Estoque volta para 3 itens
6. ✅ Item retornado com status "em_estoque"
```

---

## 📊 LÓGICA DE ESTORNO

### **Compra de Usado:**
```
Ação Original:  SAÍDA de R$ 100,00 (pagamento ao vendedor)
Ao Excluir:     ENTRADA de R$ 100,00 (estorno)
Resultado:      Saldo volta ao estado anterior
```

### **Venda de Usado:**
```
Ação Original:  ENTRADA de R$ 200,00 (recebimento do comprador)
Ao Excluir:     SAÍDA de R$ 200,00 (estorno)
Resultado:      Saldo volta ao estado anterior + Item retorna ao estoque
```

---

## ✅ BENEFÍCIOS

```
✅ Exclusões protegidas por senha (1234)
✅ Estorno automático no fluxo de caixa
✅ Item retorna ao estoque (vendas)
✅ Eventos em tempo real
✅ UX com feedback visual
✅ Controle de tentativas (3 máximo)
✅ Histórico de vendas visível
✅ Logs detalhados no console
```

---

## 🎯 RESUMO

**ANTES:**
```
❌ Não havia opção de excluir compras/vendas de usados
❌ Não havia estorno automático
❌ Não havia controle por senha
```

**DEPOIS:**
```
✅ Exclusão com senha (1234)
✅ Estorno automático no fluxo de caixa
✅ Item retorna ao estoque (vendas)
✅ Eventos em tempo real
✅ UX profissional com feedback
```

---

## 📝 SENHA DE EXCLUSÃO

```
🔐 SENHA: 1234

Esta senha é fixa e está definida em:
src/components/ui/PasswordPrompt.tsx (const SENHA_EXCLUSAO = '1234')

Para alterar a senha, modifique a constante SENHA_EXCLUSAO.
```

---

**📅 Data:** 30/01/2026  
**🏆 Status:** IMPLEMENTADO  
**✅ Build:** OK

© 2026 - PDV Smart Tech - Deletion Protection v1.0
