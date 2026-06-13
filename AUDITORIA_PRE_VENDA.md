# 🔍 AUDITORIA PRÉ-VENDA - SISTEMA PDV (PC + MOBILE)

**Data:** 30/01/2026  
**Escopo:** Vendas, Compra Usados, PWA/Cache, Multi-tenant, Impressão/WhatsApp  
**Foco:** Problemas que causam perda de dados, duplicidade, inconsistência, falha de upload ou cache

---

## ⚠️ RESUMO EXECUTIVO

| Severidade | Quantidade | Categoria Principal |
|------------|------------|---------------------|
| 🔴 **BLOQUEIA VENDA** | 3 | Estoque, Upload, Cache |
| 🟠 **ALTO** | 5 | Duplicidade, Store_ID, PWA |
| 🟡 **MÉDIO** | 4 | Sincronização, Rollback |
| **TOTAL** | **12** | Problemas identificados |

---

## 🔴 **PROBLEMAS QUE BLOQUEIAM VENDA**

---

### 🔴 **PROBLEMA 1: Race Condition no Estoque (Vendas Concorrentes)**

**Severidade:** 🔴 **BLOQUEIA VENDA**  
**Arquivo:** `src/lib/vendas.ts` (linhas 162-187)  
**Impacto:** Estoque negativo, vendas duplicadas, perda de controle de estoque

#### **Código Atual:**
```typescript
// Linha 164-176: Validação e atualização de estoque
for (const item of novaVenda.itens) {
  const produto = getProdutoPorId(item.produtoId);
  
  if (!produto) {
    logger.error(`Produto ${item.produtoId} não encontrado`);
    return null;
  }

  // ❌ PROBLEMA: Validação não é atômica
  if (produto.estoque < item.quantidade) {
    logger.error(`Estoque insuficiente...`);
    return null;
  }

  // ❌ PROBLEMA: Atualização sem lock
  const novoEstoque = produto.estoque - item.quantidade;
  await atualizarProduto(produto.id, { estoque: novoEstoque });
}
```

#### **Cenário de Reprodução:**

**Dispositivo A (PC):**
```
1. Abre venda com Produto X (estoque = 5)
2. Adiciona 5 unidades
3. Clica "Finalizar" (validação passa: 5 >= 5) ✅
4. Estoque atualizado: 5 - 5 = 0
```

**Dispositivo B (Mobile) - SIMULTÂNEO:**
```
1. Abre venda com Produto X (estoque = 5, AINDA NÃO SINCRONIZOU)
2. Adiciona 3 unidades
3. Clica "Finalizar" (validação passa: 5 >= 3) ✅
4. Estoque atualizado: 5 - 3 = 2 ❌ (deveria dar erro)
```

**Resultado Final:**
- Dispositivo A: estoque = 0
- Dispositivo B: estoque = 2
- **Vendas reais:** 8 unidades
- **Estoque original:** 5 unidades
- **DIFERENÇA:** -3 unidades (estoque negativo oculto)

#### **Correção Proposta:**

**Opção 1: Lock Otimista com Timestamp**
```typescript
// Adicionar campo `estoque_version` no produto
interface Produto {
  // ...campos existentes
  estoque_version?: number; // Versão do estoque
}

// No momento da venda
const produtoAtual = getProdutoPorId(item.produtoId);
const versaoOriginal = produtoAtual.estoque_version || 0;

// Atualizar com validação de versão
const atualizado = await atualizarProdutoComVersao(produto.id, {
  estoque: novoEstoque,
  estoque_version: versaoOriginal + 1
}, versaoOriginal);

if (!atualizado) {
  // Outro dispositivo atualizou o estoque
  throw new Error('Estoque foi alterado. Tente novamente.');
}
```

**Opção 2: Reserva de Estoque (Simplificada)**
```typescript
// Antes de criar venda, reservar estoque
const reservas = JSON.parse(localStorage.getItem('reservas-estoque') || '{}');
const estoqueDisponivel = produto.estoque - (reservas[produto.id] || 0);

if (estoqueDisponivel < item.quantidade) {
  showToast('Estoque insuficiente (incluindo reservas pendentes)', 'error');
  return null;
}

// Adicionar reserva
reservas[produto.id] = (reservas[produto.id] || 0) + item.quantidade;
localStorage.setItem('reservas-estoque', JSON.stringify(reservas));

// Após venda concluída, limpar reserva
delete reservas[produto.id];
localStorage.setItem('reservas-estoque', JSON.stringify(reservas));
```

**Complexidade:** MÉDIO (1-2 horas)  
**Prioridade:** 🔴 **CRÍTICA**

---

### 🔴 **PROBLEMA 2: Upload Falha Silenciosamente sem Rollback**

**Severidade:** 🔴 **BLOQUEIA VENDA**  
**Arquivo:** `src/pages/CompraUsadosPage.tsx` (linhas 123-145)  
**Impacto:** Dados salvos no banco, mas fotos/documentos perdidos

#### **Código Atual:**
```typescript
// Linha 120-134
setLastCreated(usado);
setUsados(getUsadosEmEstoque());

// Uploads (online-only)
if ((photos.length || docs.length) && !navigator.onLine) {
  showToast('Sem internet: não foi possível enviar arquivos.', 'warning');
} else {
  for (const f of photos) {
    await uploadPhoto(usado.id, f);  // ❌ Se falhar, continua
  }
  for (const f of docs) {
    await uploadDocument(usado.id, f); // ❌ Se falhar, continua
  }
  showToast('Compra salva! Arquivos enviados.', 'success');
}

// Reset - LIMPA FOTOS MESMO SE FALHOU
setPhotos([]);
setDocs([]);
```

#### **Cenário de Reprodução:**

1. Usuário está online
2. Preenche compra de usado com 3 fotos
3. Clica "Salvar"
4. Foto 1: upload OK ✅
5. Foto 2: **falha de rede** (timeout) ❌
6. Foto 3: não executa
7. Sistema mostra: **"Compra salva! Arquivos enviados."** ✅ (MENTIRA)
8. Formulário limpa fotos
9. **Resultado:** Usado salvo com apenas 1 foto, usuário perdeu 2 fotos

#### **Correção Proposta:**

```typescript
// Adicionar try/catch individual com contagem de erros
const uploadResults = {
  photos: { success: 0, failed: 0, errors: [] as string[] },
  docs: { success: 0, failed: 0, errors: [] as string[] }
};

if ((photos.length || docs.length) && !navigator.onLine) {
  showToast('Sem internet: não foi possível enviar arquivos.', 'warning');
} else {
  // Upload de fotos
  for (const f of photos) {
    try {
      await uploadPhoto(usado.id, f);
      uploadResults.photos.success++;
    } catch (err: any) {
      uploadResults.photos.failed++;
      uploadResults.photos.errors.push(f.name);
      logger.error('[Upload] Erro ao enviar foto:', err);
    }
  }
  
  // Upload de documentos
  for (const f of docs) {
    try {
      await uploadDocument(usado.id, f);
      uploadResults.docs.success++;
    } catch (err: any) {
      uploadResults.docs.failed++;
      uploadResults.docs.errors.push(f.name);
      logger.error('[Upload] Erro ao enviar documento:', err);
    }
  }

  // Mensagem de resultado detalhada
  const totalSuccess = uploadResults.photos.success + uploadResults.docs.success;
  const totalFailed = uploadResults.photos.failed + uploadResults.docs.failed;
  
  if (totalFailed === 0) {
    showToast(`Compra salva! ${totalSuccess} arquivo(s) enviado(s).`, 'success');
    // Limpar apenas se TUDO deu certo
    setPhotos([]);
    setDocs([]);
  } else {
    showToast(
      `Compra salva, mas ${totalFailed} arquivo(s) falharam. Tente reenviar os arquivos que falharam.`,
      'warning'
    );
    // NÃO LIMPAR fotos/docs que falharam
    // Filtrar apenas os que foram enviados com sucesso
    const photoNamesSuccess = photos
      .filter((f, i) => !uploadResults.photos.errors.includes(f.name))
      .map(f => f.name);
    const docsNamesSuccess = docs
      .filter((f, i) => !uploadResults.docs.errors.includes(f.name))
      .map(f => f.name);
    
    setPhotos(photos.filter(f => uploadResults.photos.errors.includes(f.name)));
    setDocs(docs.filter(f => uploadResults.docs.errors.includes(f.name)));
  }
}
```

**Complexidade:** BAIXO (30 minutos)  
**Prioridade:** 🔴 **CRÍTICA**

---

### 🔴 **PROBLEMA 3: Service Worker Antigo Bloqueia Atualização de Deploy**

**Severidade:** 🔴 **BLOQUEIA VENDA** (versão antiga com bugs)  
**Arquivo:** `vite.config.ts` (linhas 129-130)  
**Impacto:** Usuários ficam presos em versão antiga, correções não chegam

#### **Código Atual:**
```typescript
// vite.config.ts linha 129-130
skipWaiting: false,
clientsClaim: false,
```

#### **Cenário de Reprodução:**

1. Deploy versão 1.0.0 (com bug no estoque)
2. Usuário acessa sistema, PWA instala service worker
3. Deploy versão 1.0.1 (corrige bug no estoque)
4. Usuário volta ao sistema no dia seguinte
5. **Service worker mostra prompt:** "Atualização disponível. Deseja atualizar agora?"
6. Usuário clica **"Cancelar"** (não quer atualizar agora)
7. **Resultado:** Usuário continua com versão 1.0.0 (com bug) ❌
8. Usuário faz venda, **bug de estoque negativo acontece**

**Agravante:**
- Se usuário nunca clicar "OK" no prompt, **NUNCA atualiza**
- Sem mecanismo de forçar atualização após X dias
- Mobile (iOS): Prompt nativo pode ser ignorado facilmente

#### **Correção Proposta:**

**Opção 1: Atualização Automática Após Idle**
```typescript
// vite.config.ts
workbox: {
  // ...config existente
  skipWaiting: true,  // ✅ Aplicar update automaticamente
  clientsClaim: true, // ✅ Controlar clientes imediatamente
}
```

**Opção 2: Atualização Forçada com Timeout (Melhor)**
```typescript
// main.tsx
const updateSW = registerSW({
  onNeedRefresh() {
    const DAYS_OLD = 3; // Forçar após 3 dias
    const lastUpdateKey = 'last-sw-update';
    const lastUpdate = localStorage.getItem(lastUpdateKey);
    const now = Date.now();
    
    const shouldForce = !lastUpdate || 
      (now - parseInt(lastUpdate)) > (DAYS_OLD * 24 * 60 * 60 * 1000);
    
    if (shouldForce) {
      // Forçar atualização sem perguntar
      console.log('[PWA] Forçando atualização automática (versão antiga)');
      localStorage.setItem(lastUpdateKey, now.toString());
      updateSW(true);
    } else {
      // Perguntar ao usuário (versão recente)
      const ok = window.confirm(
        'Atualização disponível. Deseja atualizar agora?\n' +
        '(Atualização será automática em ' + DAYS_OLD + ' dias)'
      );
      if (ok) {
        localStorage.setItem(lastUpdateKey, now.toString());
        updateSW(true);
      }
    }
  },
  onOfflineReady() {
    if (import.meta.env.DEV) {
      console.log('[PWA] offline ready');
    }
  }
});
```

**Complexidade:** BAIXO (15 minutos)  
**Prioridade:** 🔴 **CRÍTICA**

---

## 🟠 **PROBLEMAS DE ALTA SEVERIDADE**

---

### 🟠 **PROBLEMA 4: Store_ID Pode Ser Alterado Durante Operação (Multi-tenant)**

**Severidade:** 🟠 **ALTO**  
**Arquivo:** `src/lib/vendas.ts` (linha 96), `src/lib/produtos.ts` (linha 57)  
**Impacto:** Venda salva em loja errada, dados corrompidos

#### **Código Atual:**
```typescript
// vendas.ts linha 96-101
const { STORE_ID, STORE_ID_VALID } = await import('@/config/env');
if (!STORE_ID_VALID || !STORE_ID) {
  const errorMsg = 'store_id não definido...';
  logger.error(`[Vendas] ❌ ${errorMsg}`);
  throw new Error(errorMsg);
}
```

#### **Cenário de Reprodução:**

1. Usuário está na **Loja A** (STORE_ID = "abc-123")
2. Abre formulário de venda
3. Adiciona 5 produtos
4. **DURANTE a adição**, abre outra aba e muda para **Loja B** (STORE_ID = "xyz-789")
5. Volta à primeira aba
6. Clica "Finalizar Venda"
7. **Linha 96:** `import('@/config/env')` lê `STORE_ID` do localStorage
8. **Resultado:** Venda é salva na **Loja B** ❌ (mas produtos eram da Loja A)

**Problema Adicional:**
- `import('@/config/env')` é **assíncrono** e lê valor **atual** do localStorage
- Se store_id mudar entre início e fim da operação, dados ficam inconsistentes

#### **Correção Proposta:**

```typescript
// Importar STORE_ID no TOPO do arquivo (estático)
import { STORE_ID, STORE_ID_VALID } from '@/config/env';

// Dentro da função criarVenda (linha 66)
export async function criarVenda(venda: Omit<Venda, 'id' | 'data'>): Promise<Venda | null> {
  // ❌ REMOVER:
  // const { STORE_ID, STORE_ID_VALID } = await import('@/config/env');
  
  // ✅ USAR valor importado no topo (capturado no load do módulo)
  if (!STORE_ID_VALID || !STORE_ID) {
    const errorMsg = 'store_id não definido...';
    logger.error(`[Vendas] ❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  // Validar que store_id não mudou durante operação
  const { STORE_ID: CURRENT_STORE_ID } = await import('@/config/env');
  if (CURRENT_STORE_ID !== STORE_ID) {
    throw new Error('Store ID foi alterado durante a operação. Recarregue a página.');
  }
  
  // ... resto do código
}
```

**Aplicar em:**
- `src/lib/vendas.ts` (linha 96)
- `src/lib/produtos.ts` (linha 57)
- `src/lib/clientes.ts` (linha 23)
- `src/lib/ordens.ts` (aproximado linha 80)

**Complexidade:** MÉDIO (1 hora)  
**Prioridade:** 🟠 **ALTA**

---

### 🟠 **PROBLEMA 5: Vendas Não Sincronizam via Outbox (Linha Ignorada)**

**Severidade:** 🟠 **ALTO**  
**Arquivo:** `src/lib/repository/outbox.ts` (linhas 70-74)  
**Impacto:** Vendas offline não sincronizam, perda de dados entre dispositivos

#### **Código Atual:**
```typescript
// outbox.ts linha 70-74
// Regra: vendas são enviadas diretamente no fluxo de criação (evita loop de erro 400/429)
if (table === 'vendas') {
  logger.warn(`[OUTBOX] IGNORANDO sincronização para tabela 'vendas' via outbox (id local: ${clientGeneratedId})`);
  return item; // ❌ NÃO adiciona à outbox
}
```

#### **Cenário de Reprodução:**

**Dispositivo A (offline):**
```
1. Sem internet
2. Cria venda #001 (salva no localStorage)
3. Venda NÃO vai para outbox (linha ignorada)
4. Fica online
5. Sync engine roda, mas NÃO sincroniza vendas
```

**Dispositivo B (online):**
```
1. Não recebe venda #001 do Dispositivo A
2. Usuário não vê venda no Supabase
3. Relatórios inconsistentes
```

**Resultado:** Vendas offline **NUNCA** sincronizam com Supabase

#### **Análise do Código:**
```typescript
// vendas.ts linha 213
await trySyncVendaToSupabase(saved);

// Função trySyncVendaToSupabase (linha 43-63)
async function trySyncVendaToSupabase(v: Venda): Promise<void> {
  try {
    // ...validações
    const { error } = await supabase.from('vendas').insert(payload);
    if (error) {
      // ❌ PROBLEMA: Se falhar, NÃO adiciona à outbox
      logger.error('[Vendas] Erro ao enviar venda ao Supabase (sem retry):', error);
    }
  } catch (e) {
    logger.error('[Vendas] Exceção ao enviar venda ao Supabase:', e);
    // ❌ PROBLEMA: Catch não adiciona à outbox
  }
}
```

**Fluxo Atual:**
```
Criar Venda → Salvar Local → trySyncVendaToSupabase()
                                  ↓
                              Falha de rede?
                                  ↓
                              ❌ Venda NÃO sincroniza
                              ❌ NÃO vai para outbox
                              ❌ Retry nunca acontece
```

#### **Correção Proposta:**

**Opção 1: Adicionar Vendas à Outbox em Caso de Falha**
```typescript
// outbox.ts - REMOVER ignorância de vendas
export function addToOutbox(
  table: string,
  operation: OutboxOperation,
  payload: Record<string, any>,
  clientGeneratedId: string
): OutboxItem {
  const item: OutboxItem = {
    id: generateId(),
    table,
    operation,
    payload,
    clientGeneratedId,
    createdAt: new Date().toISOString(),
    retries: 0
  };

  // ❌ REMOVER essa verificação:
  // if (table === 'vendas') {
  //   logger.warn(`[OUTBOX] IGNORANDO...`);
  //   return item;
  // }

  const items = getOutboxItems();
  items.push(item);
  saveOutboxItems(items);

  logger.log(`[OUTBOX] Item adicionado: ${operation} ${table} (${clientGeneratedId})`);
  return item;
}
```

**Opção 2: Adicionar Fallback no trySyncVendaToSupabase**
```typescript
// vendas.ts - Adicionar à outbox se falhar
async function trySyncVendaToSupabase(v: Venda): Promise<void> {
  try {
    if (!isSupabaseConfigured() || !supabase) return;

    const auth = await ensureSupabaseAuthenticated();
    if (!auth.success) {
      // Se falhar auth, adicionar à outbox
      addToOutbox('vendas', 'upsert', v as any, v.id);
      return;
    }

    const payload = toSupabaseVendaPayload(v);
    const { error } = await supabase.from('vendas').insert(payload);

    if (error) {
      // ✅ ADICIONAR: Se erro, adicionar à outbox para retry
      logger.error('[Vendas] Erro ao enviar venda, adicionando à outbox:', error);
      addToOutbox('vendas', 'upsert', v as any, v.id);
    }
  } catch (e) {
    // ✅ ADICIONAR: Se exceção, adicionar à outbox
    logger.error('[Vendas] Exceção ao enviar venda, adicionando à outbox:', e);
    addToOutbox('vendas', 'upsert', v as any, v.id);
  }
}
```

**Complexidade:** BAIXO (30 minutos)  
**Prioridade:** 🟠 **ALTA**

---

### 🟠 **PROBLEMA 6: LocalStorage Pode Exceder Limite (Quota Exceeded)**

**Severidade:** 🟠 **ALTO**  
**Arquivo:** `src/lib/storage.ts` (não tem tratamento de quota)  
**Impacto:** Sistema para de salvar dados, usuário perde vendas

#### **Cenário de Reprodução:**

1. Sistema em uso há 6 meses
2. **10.000 vendas** salvas no localStorage
3. **5.000 ordens de serviço**
4. **Outbox** com 500 itens pendentes
5. **Total:** ~8 MB de dados
6. Usuário tenta criar nova venda
7. `localStorage.setItem()` lança **QuotaExceededError**
8. **Resultado:** Venda NÃO é salva, dados perdidos ❌

**Agravante:**
- Limite do localStorage: **5-10 MB** (varia por navegador)
- Mobile (iOS): Limite pode ser **menor** (2-5 MB)
- Não há limpeza automática de dados antigos

#### **Correção Proposta:**

```typescript
// storage.ts - Adicionar tratamento de quota
export function safeSet<T>(key: string, value: T): StorageResult<T> {
  if (!isStorageAvailable()) {
    return {
      success: false,
      error: 'LocalStorage não está disponível'
    };
  }

  try {
    const prefixedKey = prefixStorageKey(key);
    const serialized = JSON.stringify(value);
    
    // ✅ Verificar tamanho antes de salvar
    const sizeInMB = new Blob([serialized]).size / 1024 / 1024;
    if (sizeInMB > 4) {
      logger.warn(`[Storage] Tentando salvar ${sizeInMB.toFixed(2)} MB. Próximo do limite.`);
    }
    
    localStorage.setItem(prefixedKey, serialized);
    
    return { success: true };
  } catch (error: any) {
    // ✅ ADICIONAR: Tratamento de QuotaExceededError
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      logger.error('[Storage] Limite de armazenamento excedido!', {
        key,
        errorName: error.name,
        errorCode: error.code
      });
      
      // Tentar limpar dados antigos
      try {
        cleanupOldData();
        // Tentar salvar novamente
        localStorage.setItem(prefixStorageKey(key), JSON.stringify(value));
        return { success: true };
      } catch (retryError) {
        return {
          success: false,
          error: 'Armazenamento cheio. Limpe dados antigos ou sincronize com servidor.'
        };
      }
    }
    
    return {
      success: false,
      error: `Erro ao salvar: ${error.message}`
    };
  }
}

// ✅ ADICIONAR: Função de limpeza
function cleanupOldData(): void {
  // Limpar vendas com mais de 90 dias
  const vendas = safeGet<any[]>('smart-tech-vendas', []).data || [];
  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  const vendasRecentes = vendas.filter(v => {
    const dataVenda = new Date(v.data);
    return dataVenda > threeMonthsAgo;
  });
  
  if (vendasRecentes.length < vendas.length) {
    logger.log(`[Storage] Limpando ${vendas.length - vendasRecentes.length} vendas antigas`);
    safeSet('smart-tech-vendas', vendasRecentes);
  }
  
  // Repetir para outras entidades grandes (ordens, outbox)
}
```

**Complexidade:** MÉDIO (1 hora)  
**Prioridade:** 🟠 **ALTA**

---

### 🟠 **PROBLEMA 7: Impressão Usa Dados Desatualizados (Cache de Cliente)**

**Severidade:** 🟠 **ALTO**  
**Arquivo:** `src/pages/VendasPage.tsx` (linha 238-245)  
**Impacto:** Comprovante impresso com endereço/telefone errado

**OBS:** Este problema já foi **PARCIALMENTE corrigido** na última alteração (telefone usa snapshot), mas **endereço ainda está vulnerável**.

#### **Código Atual (Após Correção Anterior):**
```typescript
// VendasPage.tsx linha 237-245
const handleImprimir = (venda: Venda) => {
  const cliente = venda.clienteId ? clientes.find(c => c.id === venda.clienteId) : null;
  
  // Montar endereço do cliente
  const enderecoCliente = cliente
    ? [cliente.endereco, cliente.cidade, cliente.estado] // ❌ DADOS ATUAIS
        .filter(Boolean)
        .join(', ')
    : '';
```

#### **Cenário de Reprodução:**

1. Venda criada em 01/01/2026:
   - Cliente: João Silva
   - Endereço: Rua A, 123

2. Cliente atualiza cadastro em 15/01/2026:
   - Endereço: Rua B, 456

3. Impressão da venda em 20/01/2026:
   - Mostra: **Rua B, 456** ❌ (endereço atual)
   - Deveria mostrar: **Rua A, 123** (endereço da época da venda)

#### **Correção Proposta:**

**Adicionar Snapshot de Endereço na Venda:**

```typescript
// types/index.ts - Adicionar campos de snapshot
export interface Venda {
  // ...campos existentes
  clienteTelefone?: string; // ✅ Já adicionado
  clienteEndereco?: string; // ✅ ADICIONAR
  clienteCidade?: string;   // ✅ ADICIONAR
  clienteEstado?: string;   // ✅ ADICIONAR
}

// VendasPage.tsx - Capturar snapshot ao criar venda
const resultado = await criarVenda({
  clienteId: formData.clienteId || undefined,
  clienteNome: cliente?.nome,
  clienteTelefone: cliente?.telefone,
  clienteEndereco: cliente?.endereco, // ✅ ADICIONAR
  clienteCidade: cliente?.cidade,     // ✅ ADICIONAR
  clienteEstado: cliente?.estado,     // ✅ ADICIONAR
  itens,
  // ...
});

// VendasPage.tsx - Usar snapshot na impressão
const enderecoCliente = [
  venda.clienteEndereco ?? cliente?.endereco,
  venda.clienteCidade ?? cliente?.cidade,
  venda.clienteEstado ?? cliente?.estado
]
  .filter(Boolean)
  .join(', ');
```

**Complexidade:** BAIXO (30 minutos)  
**Prioridade:** 🟠 **ALTA**

---

### 🟠 **PROBLEMA 8: WhatsApp Formata Telefone Incorretamente (Casos Edge)**

**Severidade:** 🟠 **ALTO**  
**Arquivo:** `src/components/ui/WhatsAppButton.tsx` (linhas 10-17)  
**Impacto:** Link WhatsApp quebrado, mensagem não enviada

#### **Código Atual:**
```typescript
const formatarTelefone = (tel: string) => {
  const numeros = tel.replace(/\D/g, '');
  const semZero = numeros.startsWith('0') ? numeros.slice(1) : numeros;
  return semZero.startsWith('55') ? semZero : `55${semZero}`;
};
```

#### **Casos de Falha:**
```javascript
formatarTelefone("999998888")        // "55999998888" ❌ (DDD ausente)
formatarTelefone("55 43 99999-8888") // "555543999998888" ❌ (55 duplicado)
formatarTelefone("+55 43 99999-8888")// "555543999998888" ❌ (+ removido, 55 duplicado)
formatarTelefone("")                 // "55" ❌ (vazio)
formatarTelefone("43999998888")      // "5543999998888" ✅ (11 dígitos OK)
formatarTelefone("(43) 99999-8888")  // "5543999998888" ✅ (OK)
```

#### **Correção Proposta:**

```typescript
const formatarTelefone = (tel: string) => {
  // Remover tudo que não é número
  let numeros = tel.replace(/\D/g, '');
  
  // Validar se tem conteúdo
  if (!numeros || numeros.length < 10) {
    return null; // ❌ Telefone inválido
  }
  
  // Remover zero inicial (ex: "043999998888" → "43999998888")
  if (numeros.startsWith('0')) {
    numeros = numeros.slice(1);
  }
  
  // Se já começar com 55, verificar se tem DDD+telefone válido
  if (numeros.startsWith('55')) {
    // Remover 55 temporariamente para validar
    const semCodigo = numeros.slice(2);
    
    // Deve ter 10 ou 11 dígitos (DDD + telefone)
    if (semCodigo.length === 10 || semCodigo.length === 11) {
      return numeros; // ✅ Já está no formato correto
    }
    
    // Se tiver mais ou menos dígitos, remover 55 e validar novamente
    numeros = semCodigo;
  }
  
  // Validar formato final: deve ter 10 ou 11 dígitos (DDD + telefone)
  if (numeros.length < 10 || numeros.length > 11) {
    return null; // ❌ Telefone inválido
  }
  
  // Adicionar código do Brasil
  return `55${numeros}`;
};

// Atualizar componente para não renderizar se telefone inválido
function WhatsAppButton({ telefone, mensagem, className = '' }: WhatsAppButtonProps) {
  const telefoneFormatado = formatarTelefone(telefone);
  
  if (!telefoneFormatado) return null; // ✅ Não renderiza se inválido
  
  const handleClick = () => {
    const texto = mensagem ? encodeURIComponent(mensagem) : '';
    const url = `https://wa.me/${telefoneFormatado}${texto ? `?text=${texto}` : ''}`;
    window.open(url, '_blank');
  };

  return (
    <button
      className={`whatsapp-button ${className}`}
      onClick={handleClick}
      aria-label="Enviar mensagem no WhatsApp"
      title="Enviar mensagem no WhatsApp"
    >
      <span className="whatsapp-icon">💬</span>
      <span className="whatsapp-text">WhatsApp</span>
    </button>
  );
}
```

**Complexidade:** BAIXO (20 minutos)  
**Prioridade:** 🟠 **ALTA**

---

## 🟡 **PROBLEMAS DE SEVERIDADE MÉDIA**

---

### 🟡 **PROBLEMA 9: Outbox Não Limpa Itens Sincronizados com Sucesso**

**Severidade:** 🟡 **MÉDIO**  
**Arquivo:** `src/lib/repository/sync-engine.ts` (aproximado linha 150-200)  
**Impacto:** Outbox cresce infinitamente, localStorage cheio

**Correção:** Adicionar `removeFromOutbox(item.id)` após sync bem-sucedido.

**Complexidade:** BAIXO (15 minutos)

---

### 🟡 **PROBLEMA 10: Upload de Arquivo Grande Trava UI (Sem Progresso)**

**Severidade:** 🟡 **MÉDIO**  
**Arquivo:** `src/pages/CompraUsadosPage.tsx` (linha 127-132)  
**Impacto:** Tela congela, usuário pensa que travou

**Correção:** Adicionar indicador de progresso por arquivo.

**Complexidade:** MÉDIO (1 hora)

---

### 🟡 **PROBLEMA 11: Store_ID Não Valida UUID no Bootstrap**

**Severidade:** 🟡 **MÉDIO**  
**Arquivo:** `src/lib/bootstrap-store.ts` (aproximado)  
**Impacto:** Sistema inicia com store_id inválido

**Correção:** Validar UUID antes de usar store_id.

**Complexidade:** BAIXO (15 minutos)

---

### 🟡 **PROBLEMA 12: Sync Engine Pode Executar Múltiplas Vezes Simultaneamente**

**Severidade:** 🟡 **MÉDIO**  
**Arquivo:** `src/lib/repository/sync-engine.ts` (aproximado linha 50)  
**Impacto:** Duplicação de requisições, 429 (rate limit)

**Correção:** Adicionar flag `isSyncing` para prevenir execução concorrente.

**Complexidade:** BAIXO (20 minutos)

---

## 📊 **PLANO DE AÇÃO RECOMENDADO**

### **Fase 1: BLOQUEADORES (1-2 dias)**
1. ✅ Problema 1: Race Condition no Estoque
2. ✅ Problema 2: Upload sem Rollback
3. ✅ Problema 3: Service Worker Antigo

### **Fase 2: ALTOS (2-3 dias)**
4. ✅ Problema 4: Store_ID Dinâmico
5. ✅ Problema 5: Vendas não Sincronizam
6. ✅ Problema 6: LocalStorage Quota
7. ✅ Problema 7: Impressão com Dados Desatualizados
8. ✅ Problema 8: WhatsApp Formatação

### **Fase 3: MÉDIOS (1 dia)**
9. ✅ Problema 9: Outbox Limpeza
10. ✅ Problema 10: Upload Progresso
11. ✅ Problema 11: Store_ID Validação
12. ✅ Problema 12: Sync Concorrente

---

## 🎯 **CRITÉRIOS DE ACEITAÇÃO**

### **Vendas:**
- [ ] Estoque nunca fica negativo (mesmo com vendas concorrentes)
- [ ] Vendas offline sincronizam com Supabase
- [ ] Snapshot de telefone/endereço funciona na impressão

### **Compra Usados:**
- [ ] Upload falho não limpa arquivos do formulário
- [ ] Mensagem de erro detalha quais arquivos falharam

### **PWA/Cache:**
- [ ] Atualização automática após 3 dias
- [ ] Service worker atualiza sem ficar preso

### **Multi-tenant:**
- [ ] Store_ID fixo durante operação (não muda)
- [ ] Validação de UUID em todas operações

### **Impressão/WhatsApp:**
- [ ] Snapshot de endereço completo na venda
- [ ] WhatsApp valida telefone antes de renderizar botão

---

**Total de Horas Estimadas:** 6-9 dias (48-72 horas)  
**Complexidade Geral:** MÉDIO-ALTO  
**ROI:** MUITO ALTO (previne perda de dados e inconsistências críticas)

---

**✅ Auditoria concluída. Pronto para correções.**
