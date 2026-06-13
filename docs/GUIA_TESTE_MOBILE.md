# 📱 Guia de Teste Mobile - Smart Tech PDV

**Data:** 2026-01-23  
**Status:** ✅ Pronto para Teste

---

## 🎯 Objetivo

Testar o sistema completo no mobile (navegador e PWA) para garantir que:
- ✅ Login funciona corretamente
- ✅ Rotas funcionam após login
- ✅ Sessão persiste após reload
- ✅ Performance está otimizada

---

## 📋 Pré-requisitos

1. **Servidor rodando:**
   ```bash
   npm run dev
   ```

2. **Acesso ao servidor no mobile:**
   - **Opção 1:** Mesma rede WiFi + IP local (ex: `http://192.168.1.100:5173`)
   - **Opção 2:** Usar Chrome DevTools Remote Debugging
   - **Opção 3:** Usar ngrok/tunneling (para teste remoto)

3. **Navegador mobile:**
   - Chrome Android (recomendado)
   - Safari iOS
   - Ou Chrome DevTools em modo mobile

---

## 🧪 Teste 1: Login Básico

### Passo a Passo:

1. **Abrir aplicação no mobile:**
   - Acessar `http://SEU_IP:5173` ou `http://localhost:5173`
   - Deve carregar a página de login

2. **Verificar console (se possível):**
   - Abrir DevTools (Chrome: menu → Mais ferramentas → Ferramentas do desenvolvedor)
   - Verificar se há erros

3. **Fazer login:**
   - Email: `admin@smarttech.com`
   - Senha: `admin123`
   - Clicar em "Entrar"

4. **Verificar logs no console:**
   ```
   [LoginPage] Tentando fazer login...
   [Auth] Buscando usuário por email: admin@smarttech.com
   [Auth] Usuário encontrado: {...}
   [Auth] Verificando senha...
   [Auth] Senha válida: true
   [Auth] Salvando sessão: {...}
   [Auth] Sessão salva com sucesso
   [LoginPage] Login bem-sucedido, redirecionando para: /painel
   ```

5. **✅ Esperado:**
   - Redireciona para `/painel`
   - Não redireciona de volta para `/login`
   - Página carrega normalmente

---

## 🧪 Teste 2: Redirect com Rota Original

### Passo a Passo:

1. **Limpar sessão (se necessário):**
   - No console: `localStorage.clear()`
   - Recarregar página

2. **Tentar acessar rota protegida:**
   - Acessar diretamente: `http://SEU_IP:5173/clientes`
   - Deve redirecionar para `/login`

3. **Fazer login:**
   - Email: `admin@smarttech.com`
   - Senha: `admin123`

4. **✅ Esperado:**
   - Após login, redireciona para `/clientes` (não `/painel`)
   - Página de clientes carrega normalmente

---

## 🧪 Teste 3: Persistência de Sessão

### Passo a Passo:

1. **Fazer login:**
   - Login com credenciais padrão

2. **Navegar para diferentes rotas:**
   - `/painel`
   - `/clientes`
   - `/vendas`
   - `/produtos`
   - `/ordens`

3. **Recarregar página (F5 ou pull-to-refresh):**
   - Em qualquer rota, recarregar a página

4. **✅ Esperado:**
   - Permanece logado
   - Não redireciona para `/login`
   - Dados da página são mantidos

---

## 🧪 Teste 4: Performance e Cache

### Passo a Passo:

1. **Abrir console:**
   - Verificar logs de `[Auth]`

2. **Navegar entre rotas:**
   - Alternar entre `/painel`, `/clientes`, `/vendas`

3. **✅ Verificar logs:**
   - Logs de `[Auth] Obtendo sessão atual` aparecem **máximo 1 vez por segundo**
   - Não há logs repetidos excessivos
   - Performance está fluida

---

## 🧪 Teste 5: PWA (Progressive Web App)

### Passo a Passo:

1. **Abrir no Chrome Android:**
   - Acessar aplicação
   - Menu → "Adicionar à tela inicial"

2. **Instalar PWA:**
   - Confirmar instalação
   - Abrir PWA da tela inicial

3. **✅ Verificar:**
   - Abre em modo standalone (sem barra do navegador)
   - Login funciona
   - Rotas funcionam
   - Safe-area funciona (não fica atrás do notch)

---

## 🔍 Checklist de Validação

### Login:
- [ ] Página de login carrega
- [ ] Campos de email e senha funcionam
- [ ] Login com credenciais corretas funciona
- [ ] Login com credenciais incorretas mostra erro
- [ ] Após login, redireciona corretamente
- [ ] Não redireciona de volta para login

### Rotas:
- [ ] `/painel` funciona após login
- [ ] `/clientes` funciona após login
- [ ] `/vendas` funciona após login
- [ ] `/produtos` funciona após login
- [ ] `/ordens` funciona após login
- [ ] Rotas protegidas redirecionam para login se não autenticado

### Persistência:
- [ ] Sessão persiste após reload
- [ ] Sessão persiste ao navegar entre rotas
- [ ] Sessão expira após 24 horas (testar se possível)

### Performance:
- [ ] Logs não são excessivos (máximo 1 por segundo)
- [ ] Navegação é fluida
- [ ] Não há travamentos

### Mobile:
- [ ] Layout responsivo funciona
- [ ] Touch targets são grandes o suficiente (44px+)
- [ ] Safe-area funciona (não fica atrás do notch)
- [ ] BottomNav funciona
- [ ] Drawer menu funciona

---

## 🐛 Problemas Conhecidos e Soluções

### Problema: Não consegue acessar no mobile

**Solução:**
1. Verificar se servidor está rodando
2. Verificar IP do computador: `ipconfig` (Windows) ou `ifconfig` (Linux/Mac)
3. Verificar firewall não está bloqueando
4. Usar `--host` no Vite:
   ```bash
   npm run dev -- --host
   ```

### Problema: Web Crypto API não disponível

**Solução:**
- Usar HTTPS ou localhost
- No mobile, acessar via IP local pode não funcionar
- Usar tunneling (ngrok) ou configurar HTTPS local

### Problema: Sessão não persiste

**Solução:**
1. Verificar se localStorage está habilitado
2. Verificar console para erros de storage
3. Verificar se não há bloqueio de cookies/storage

### Problema: Logs excessivos

**Solução:**
- Já corrigido com cache
- Se ainda aparecer, verificar se cache está funcionando

---

## 📊 Resultados Esperados

### ✅ Sucesso:
- Login funciona no primeiro try
- Redireciona corretamente após login
- Sessão persiste após reload
- Rotas funcionam normalmente
- Performance está boa

### ❌ Falha:
- Login não funciona
- Redireciona de volta para login
- Sessão não persiste
- Rotas não funcionam
- Performance ruim

---

## 📝 Notas

- **Logs:** Em modo DEV, logs aparecem no console
- **Cache:** Cache de sessão tem TTL de 1 segundo
- **Storage:** Usa localStorage com prefixo CLIENT_ID
- **PWA:** Funciona melhor quando instalado

---

## 🚀 Próximos Passos

Após validar todos os testes:
1. ✅ Documentar resultados
2. ✅ Reportar problemas encontrados
3. ✅ Aplicar correções se necessário

---

**Boa sorte com os testes! 🎉**
