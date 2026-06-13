# 🧪 TESTE BLOCO 1 — Auth/Login/Guards

## ✅ Objetivo
Validar que as correções eliminaram os loops infinitos de "Verificando acesso..." e "Verificando configuração...".

---

## 🎯 Cenários de Teste

### Teste 1: Login normal (caminho feliz)
**Objetivo:** Verificar que login funciona sem trava.

**Passos:**
1. Abrir o app em `http://localhost:5173`
2. Fazer login com credenciais válidas
3. Verificar que entra no painel SEM ficar travado em "Verificando acesso..."

**Resultado esperado:**
- ✅ Redireciona para `/painel` imediatamente
- ✅ Menu lateral carrega normalmente
- ✅ NÃO fica preso em spinner "Verificando acesso..."

**Status:** [ ] Passou [ ] Falhou

---

### Teste 2: Acesso sem login (redirect para login)
**Objetivo:** Verificar que redirect para login não trava.

**Passos:**
1. Limpar localStorage: `localStorage.clear()` no console
2. Tentar acessar diretamente `http://localhost:5173/vendas`
3. Observar o comportamento

**Resultado esperado:**
- ✅ Redireciona para `/login` SEM travar
- ✅ NÃO fica preso em "Verificando acesso..."
- ✅ Mostra tela de login normalmente

**Status:** [ ] Passou [ ] Falhou

---

### Teste 3: Sessão expirada (getCurrentSession retorna null)
**Objetivo:** Verificar que sessão expirada não causa deslog inesperado múltiplo.

**Passos:**
1. Fazer login normalmente
2. No console do navegador:
   ```javascript
   // Forçar expiração da sessão
   const session = JSON.parse(localStorage.getItem('smart-tech:session'));
   session.expiresAt = new Date(Date.now() - 1000).toISOString(); // 1 segundo atrás
   localStorage.setItem('smart-tech:session', JSON.stringify(session));
   ```
3. Navegar para qualquer rota (ex: `/vendas`)
4. Observar comportamento

**Resultado esperado:**
- ✅ Redireciona para `/login` UMA vez
- ✅ NÃO fica em loop de redirects
- ✅ NÃO trava em "Verificando acesso..."
- ✅ Console NÃO mostra múltiplos `logout()` ou erros

**Status:** [ ] Passou [ ] Falhou

---

### Teste 4: Store_id incompatível (troca de loja)
**Objetivo:** Verificar que trocar store_id não causa loop.

**Passos:**
1. Fazer login normalmente
2. No console do navegador:
   ```javascript
   // Simular troca de store_id (mudar URL ou localStorage)
   const url = new URL(window.location);
   url.searchParams.set('store', '00000000-0000-0000-0000-000000000000'); // UUID fake
   window.history.pushState({}, '', url);
   window.location.reload();
   ```
3. Observar comportamento

**Resultado esperado:**
- ✅ Redireciona para `/login` UMA vez
- ✅ NÃO fica em loop
- ✅ NÃO trava em "Verificando acesso..."

**Status:** [ ] Passou [ ] Falhou

---

### Teste 5: Acesso sem permissão (role bloqueado)
**Objetivo:** Verificar que falta de permissão não trava.

**Passos:**
1. Fazer login como `atendente` (não admin)
2. Tentar acessar rota de admin (ex: `/usuarios` ou `/licenca`)
3. Observar comportamento

**Resultado esperado:**
- ✅ Redireciona para `/painel` SEM travar
- ✅ NÃO fica preso em "Verificando acesso..."
- ✅ Mostra conteúdo do painel normalmente

**Status:** [ ] Passou [ ] Falhou

---

### Teste 6: CLIENT_ID não configurado (ClientIdGuard)
**Objetivo:** Verificar que falta de CLIENT_ID não trava.

**Passos:**
1. No `.env`, comentar ou remover `VITE_CLIENT_ID`
2. Reiniciar o servidor dev: `npm run dev`
3. Abrir `http://localhost:5173`
4. Observar comportamento

**Resultado esperado:**
- ✅ Redireciona para `/setup` SEM travar
- ✅ NÃO fica preso em "Verificando configuração..."
- ✅ Mostra tela de setup normalmente

**Status:** [ ] Passou [ ] Falhou

---

### Teste 7: Navegação entre rotas (múltiplas páginas)
**Objetivo:** Verificar que navegar entre rotas não causa re-renders infinitos.

**Passos:**
1. Fazer login normalmente
2. Abrir DevTools → Console
3. Navegar entre rotas: `/painel` → `/vendas` → `/clientes` → `/produtos` → `/painel`
4. Observar console

**Resultado esperado:**
- ✅ Navegação funciona normalmente
- ✅ Console NÃO mostra warnings de "too many re-renders"
- ✅ NÃO fica travado em nenhuma tela
- ✅ Loading aparece brevemente e desaparece

**Status:** [ ] Passou [ ] Falhou

---

### Teste 8: Refresh (F5) em rota protegida
**Objetivo:** Verificar que dar F5 não causa loop.

**Passos:**
1. Fazer login normalmente
2. Navegar para `/vendas`
3. Pressionar **F5** (refresh)
4. Observar comportamento

**Resultado esperado:**
- ✅ Página recarrega normalmente
- ✅ NÃO trava em "Verificando acesso..."
- ✅ Mostra conteúdo da página imediatamente

**Status:** [ ] Passou [ ] Falhou

---

## 🔍 Validações Técnicas (DevTools)

### Console do navegador
Durante todos os testes, verificar que:
- ✅ NÃO aparecem erros vermelhos relacionados a auth
- ✅ NÃO aparecem warnings de "Maximum update depth exceeded"
- ✅ NÃO aparecem múltiplos logs de `[AuthGuard]` repetidos infinitamente

### React DevTools (se instalado)
- ✅ Componente `AuthGuard` NÃO re-renderiza infinitamente
- ✅ Estado `ready` muda de `false` → `true` rapidamente

### Network Tab
- ✅ NÃO há chamadas repetidas ao Supabase em loop
- ✅ Requisições de autenticação são feitas UMA vez

---

## 📊 Resumo de Resultados

Total de testes: 8

- ✅ Passou: ____ / 8
- ❌ Falhou: ____ / 8

---

## 🐛 Problemas Encontrados

Se algum teste falhou, anote aqui:

```
Teste #: [número do teste que falhou]
Problema: [descrição do que aconteceu]
Console logs: [copiar erros do console]
```

---

## ✅ Critério de Sucesso

**Bloco 1 está validado se:**
- ✅ Todos os 8 testes passaram
- ✅ Nenhum loading infinito em "Verificando acesso..." ou "Verificando configuração..."
- ✅ Console sem erros/warnings de re-render

---

## 🚀 Próximos Passos

Após validar o Bloco 1:
- [ ] Testar em produção (build + deploy)
- [ ] Prosseguir para Bloco 2 (PWA/Deploy)
- [ ] Prosseguir para Bloco 3 (Performance/Menu)
