# 📸 GALERIA DE FOTOS - USADOS (TESTES)

**Data:** 30/01/2026  
**Status:** ✅ IMPLEMENTADO  
**Build:** ✅ PASSOU (7.76s)

---

## 🎯 **FUNCIONALIDADES IMPLEMENTADAS**

### **1. Serviço de Fotos** ✅

**Arquivo:** `src/lib/usados-fotos.ts`

```typescript
// Buscar fotos por usado_id
getFotosUsado(usadoId: string): UsadoArquivo[]

// Buscar primeira foto (miniatura)
getPrimeiraFoto(usadoId: string): UsadoArquivo | null

// Contar fotos
contarFotos(usadoId: string): number

// Gerar URL signed (bucket privado) ou public
gerarUrlFoto(arquivo: UsadoArquivo): Promise<string | null>

// Gerar URLs em paralelo (performance)
gerarUrlsFotos(arquivos: UsadoArquivo[]): Promise<Map<string, string>>

// Buscar fotos com URLs já prontas
getFotosComUrls(usadoId: string): Promise<Array<{ arquivo, url }>>
```

---

### **2. Componente Galeria** ✅

**Arquivo:** `src/components/GaleriaUsados.tsx`

**Features:**
- ✅ Modal com grid de fotos (miniaturas)
- ✅ Clique em miniatura → foto expandida (fullscreen)
- ✅ Navegação entre fotos (← →)
- ✅ Navegação por teclado (ESC, ArrowLeft, ArrowRight)
- ✅ Contador "N / Total"
- ✅ Nome do arquivo na foto expandida
- ✅ Overlay hover com "🔍 Ver"
- ✅ Loading state
- ✅ Empty state
- ✅ Responsivo (desktop/mobile)

---

### **3. Lista "Em Estoque"** ✅

**Arquivo:** `src/pages/CompraUsadosPage.tsx`

**Antes:**
```tsx
<ul className="usados-list">
  <li>
    <strong>{titulo}</strong>
    <span>{imei}</span>
  </li>
</ul>
```

**Depois:**
```tsx
<div className="usados-estoque-grid">
  <div className="usado-estoque-card">
    {/* Miniatura (primeira foto) */}
    <div className="usado-miniatura">
      <img src={miniatura} alt={titulo} />
    </div>
    
    {/* Informações */}
    <div className="usado-info">
      <h4>{titulo}</h4>
      <p>{imei}</p>
      <p>R$ {valorCompra}</p>
    </div>
    
    {/* Botão Ver Fotos */}
    <button onClick={() => abrirGaleria(usado)}>
      📸 Ver fotos ({numFotos})
    </button>
  </div>
</div>
```

**Features:**
- ✅ Grid responsivo (auto-fill, minmax)
- ✅ Miniatura ou placeholder (📱)
- ✅ Botão "Ver fotos (N)" com contador
- ✅ Se não tem fotos: "Sem fotos" (texto)
- ✅ Lazy load de URLs (paralelo)
- ✅ Atualiza após salvar novo usado

---

## 🧪 **COMO TESTAR**

### **Teste 1: Cadastrar Usado COM Fotos**

```
1. Abrir: /compra-usados
2. Preencher formulário:
   - Vendedor: "João Silva"
   - Título: "iPhone 12 Pro Max"
   - IMEI: 123456789
   - Valor: R$ 2.500,00
3. Adicionar fotos (2-3 fotos de celular)
4. Clicar "Salvar"
5. ✅ Toast: "Compra salva! Arquivos: 3 foto(s) enviada(s)"
6. ✅ Na lista "Em estoque":
   - Card com miniatura da 1ª foto
   - Botão "📸 Ver fotos (3)"
7. Clicar "Ver fotos (3)"
8. ✅ Modal abre com grid de 3 fotos
9. Clicar em uma foto
10. ✅ Foto expande (fullscreen)
11. ✅ Navegação funciona (← →)
12. ✅ ESC fecha
```

---

### **Teste 2: Cadastrar Usado SEM Fotos**

```
1. Abrir: /compra-usados
2. Preencher formulário:
   - Vendedor: "Maria Santos"
   - Título: "Samsung Galaxy S21"
   - IMEI: 987654321
   - Valor: R$ 1.800,00
3. NÃO adicionar fotos
4. Clicar "Salvar"
5. ✅ Toast: "Compra de Usado salva!"
6. ✅ Na lista "Em estoque":
   - Card com placeholder (📱)
   - Texto "Sem fotos" (sem botão)
```

---

### **Teste 3: Galeria com Muitas Fotos**

```
1. Cadastrar usado com 10+ fotos
2. Abrir galeria
3. ✅ Grid mostra todas as fotos
4. ✅ Scroll funciona
5. Clicar última foto
6. ✅ Expande corretamente
7. ✅ Navegação ← volta para penúltima
8. ✅ Navegação → volta para primeira (loop)
```

---

### **Teste 4: Navegação por Teclado**

```
1. Abrir galeria de um usado
2. Clicar em uma foto para expandir
3. Pressionar ArrowRight (→)
4. ✅ Vai para próxima foto
5. Pressionar ArrowLeft (←)
6. ✅ Volta para anterior
7. Pressionar ESC
8. ✅ Fecha foto expandida (volta para grid)
9. Pressionar ESC novamente
10. ✅ Fecha modal completamente
```

---

### **Teste 5: Responsivo Mobile**

```
1. Abrir Chrome DevTools (F12)
2. Ativar modo mobile (iPhone 12 Pro)
3. Abrir: /compra-usados
4. ✅ Grid de cards (1 coluna)
5. ✅ Miniaturas carregam
6. Clicar "Ver fotos"
7. ✅ Modal abre corretamente
8. ✅ Grid de fotos (2 colunas)
9. Clicar em foto
10. ✅ Foto expandida (fullscreen)
11. ✅ Botões navegação (← →) visíveis e acessíveis
12. ✅ Touch funciona (arrasto para navegar - não implementado, mas botões funcionam)
```

---

### **Teste 6: Múltiplos Usados**

```
1. Cadastrar 5 usados diferentes
2. Cada um com 1-5 fotos
3. ✅ Lista mostra 5 cards
4. ✅ Cada card tem sua miniatura correta
5. ✅ Botões mostram contadores corretos: (1), (3), (5)
6. Abrir galeria do usado #3
7. ✅ Modal mostra APENAS fotos do usado #3
8. Fechar e abrir galeria do usado #5
9. ✅ Modal mostra APENAS fotos do usado #5
```

---

### **Teste 7: Offline → Online**

```
1. Cadastrar usado COM fotos (online)
2. ✅ Fotos enviadas para Supabase
3. Desconectar internet
4. Recarregar página
5. ✅ Lista carrega (dados locais)
6. ✅ Miniaturas NÃO carregam (sem internet)
7. Reconectar internet
8. Recarregar página
9. ✅ Miniaturas carregam corretamente
10. ✅ Galeria funciona
```

---

### **Teste 8: Multi-tenant (store_id)**

```
Setup: 2 lojas (A e B)

1. Login Loja A
2. Cadastrar usado "iPhone" com 3 fotos
3. ✅ Fotos salvas com store_id da Loja A
4. Logout

5. Login Loja B
6. ✅ Loja B NÃO vê o usado da Loja A
7. Cadastrar usado "Samsung" com 2 fotos
8. ✅ Fotos salvas com store_id da Loja B

9. Voltar Loja A
10. ✅ Loja A vê APENAS seu usado (iPhone)
11. ✅ Galeria mostra APENAS 3 fotos (da Loja A)
```

---

### **Teste 9: Performance (10+ Usados)**

```
1. Cadastrar 10 usados com 3 fotos cada (30 fotos total)
2. Abrir: /compra-usados
3. ✅ Lista carrega rapidamente
4. ✅ Miniaturas carregam em paralelo (não travamento)
5. ✅ Page não congela
6. Clicar "Ver fotos" em qualquer usado
7. ✅ Modal abre rápido (< 1s)
8. ✅ Fotos carregam progressivamente
```

---

### **Teste 10: Buckets (Public vs Private)**

```
Configuração atual:
- Bucket: usados_aparelho_photos (privado)
- Strategy: createSignedUrl (1 hora)

1. Cadastrar usado com fotos
2. ✅ Fotos enviadas para bucket privado
3. Abrir galeria
4. ✅ URLs signed geradas
5. ✅ Fotos carregam (autenticado)
6. Copiar URL de uma foto
7. Abrir em aba anônima
8. ✅ Foto CARREGA (signed URL válida por 1h)
9. Aguardar 61 minutos
10. Recarregar URL
11. ✅ Foto expira (403 Forbidden) ← ESPERADO
12. Reabrir galeria (autenticado)
13. ✅ Nova signed URL gerada
14. ✅ Foto carrega novamente
```

---

## 📊 **ARQUITETURA**

### **Fluxo de Upload (Existente):**

```
CompraUsadosPage
  ↓
uploadPhoto(usadoId, file)
  ↓
supabase.storage.from('usados_aparelho_photos').upload(path, file)
  ↓
usadosArquivosRepo.upsert({
  id, usadoId, kind: 'photo',
  bucket, path, mimeType, originalName,
  storeId
})
```

### **Fluxo de Visualização (Novo):**

```
CompraUsadosPage (useEffect)
  ↓
getUsadosEmEstoque()
  ↓
Para cada usado:
  getPrimeiraFoto(usadoId) → UsadoArquivo | null
  gerarUrlFoto(arquivo) → signed URL
  ↓
setMiniaturas(Map<usadoId, url>)
  ↓
Renderizar grid com <img src={miniatura} />

Ao clicar "Ver fotos (N)":
  ↓
<GaleriaUsados usadoId={...} />
  ↓
getFotosComUrls(usadoId)
  ↓
Renderizar grid de miniaturas
  ↓
Ao clicar em miniatura:
  Expandir foto (fullscreen)
  Navegação (← →)
```

---

## 🔧 **ESTRUTURA DE ARQUIVOS**

```
src/
├── lib/
│   ├── usados-uploads.ts         (existente - upload)
│   └── usados-fotos.ts           (NOVO - visualização)
│
├── components/
│   ├── GaleriaUsados.tsx         (NOVO - modal + grid + zoom)
│   └── GaleriaUsados.css         (NOVO - estilos responsivos)
│
└── pages/
    ├── CompraUsadosPage.tsx      (ATUALIZADO - integração galeria)
    └── UsadosPages.css           (ATUALIZADO - grid cards)
```

---

## 🎨 **UI/UX**

### **Lista "Em Estoque":**
```
┌─────────────────────────────────────────┐
│  📋 Em estoque                          │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ [FOTO]  │  │ [FOTO]  │  │  📱     │ │
│  │         │  │         │  │Sem foto │ │
│  ├─────────┤  ├─────────┤  ├─────────┤ │
│  │ iPhone  │  │ Samsung │  │ Xiaomi  │ │
│  │ IMEI... │  │ IMEI... │  │ IMEI... │ │
│  │R$ 2.500 │  │R$ 1.800 │  │R$ 1.200 │ │
│  ├─────────┤  ├─────────┤  ├─────────┤ │
│  │📸 Ver   │  │📸 Ver   │  │Sem fotos│ │
│  │fotos(3) │  │fotos(5) │  │         │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### **Modal Galeria:**
```
┌────────────────────────────────────────────┐
│  📸 Fotos - iPhone 12 Pro Max        [ X ] │
├────────────────────────────────────────────┤
│                                            │
│   ┌───┐  ┌───┐  ┌───┐  ┌───┐  ┌───┐      │
│   │ 1 │  │ 2 │  │ 3 │  │ 4 │  │ 5 │      │
│   └───┘  └───┘  └───┘  └───┘  └───┘      │
│                                            │
│   💡 Clique em uma foto para ampliar      │
│                                            │
└────────────────────────────────────────────┘
```

### **Foto Expandida:**
```
┌────────────────────────────────────────────┐
│  3 / 5                            [ X ]    │
│                                            │
│           ┌─────────────┐                  │
│     ◄     │             │      ►           │
│           │   [FOTO]    │                  │
│           │  EXPANDIDA  │                  │
│           │             │                  │
│           └─────────────┘                  │
│                                            │
│  IMG_20260130_123456.jpg                   │
│  ← → Para navegar | ESC para fechar        │
└────────────────────────────────────────────┘
```

---

## ✅ **CHECKLIST FINAL**

```
✅ Serviço completo (usados-fotos.ts)
✅ Componente galeria (GaleriaUsados.tsx)
✅ CSS responsivo e profissional
✅ Integração CompraUsadosPage
✅ Grid de cards com miniaturas
✅ Botão "Ver fotos (N)" com contador
✅ Modal com grid de fotos
✅ Foto expandida (fullscreen)
✅ Navegação ← → (mouse + teclado)
✅ ESC para fechar
✅ URLs signed (bucket privado)
✅ Lazy load (parallel)
✅ Multi-tenant (store_id)
✅ Loading states
✅ Empty states
✅ Performance otimizada
✅ Build passou (7.76s)
✅ Commit realizado
```

---

## 🚀 **DEPLOY**

```bash
# Build passou
✓ built in 7.76s

# Commit
git add -A
git commit -m "feat(usados): galeria de fotos..."
git push origin main

# Aguardar Cloudflare (2-3 min)
# URL: https://98c6c993.pdv-duz.pages.dev

# Testar:
1. /compra-usados
2. Cadastrar usado + fotos
3. Ver miniatura + botão
4. Abrir galeria
5. Expandir foto
6. Navegar (← →)
7. ✅ GALERIA FUNCIONANDO!
```

---

## 📝 **OBSERVAÇÕES**

### **Buckets:**
- **usados_aparelho_photos**: PRIVADO (signed URLs, 1h)
- **usados_documentos**: PRIVADO (signed URLs, 1h)

### **Fallbacks:**
- Se `createSignedUrl` falhar → tenta `getPublicUrl`
- Se não tem internet → não carrega URLs (mas não quebra)
- Se não tem fotos → mostra placeholder (📱)

### **Performance:**
- URLs geradas em paralelo (`Promise.all`)
- Miniaturas carregadas apenas 1x (memoização)
- Modal só carrega fotos quando abre

### **Multi-tenant:**
- `usadosArquivosRepo.list()` já filtra por `store_id`
- Queries Supabase Storage usam paths com `storeId/usadoId/...`

---

**📝 Implementação concluída:** 30/01/2026  
**⏱️ Tempo:** ~1 hora  
**✅ Build:** PASSOU  
**🚀 Pronto para uso!** 🎉
