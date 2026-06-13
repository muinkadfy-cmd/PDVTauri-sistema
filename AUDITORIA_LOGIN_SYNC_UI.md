# Auditoria: Login, Sync e Polimento UI

## 1) Principais bugs encontrados e como foram resolvidos

| Bug | Causa | Resolução |
|-----|--------|-----------|
| **"Verificando acesso" pode travar** | `ensureSupabaseAuthenticated()` em ProtectedRoute sem timeout; Promise pendurada em rede lenta/429 | Timeout de 5s em `ensureSupabaseAuthenticated` no ProtectedRoute; após timeout segue com verificação local (getCurrentSession). |
| **setState após unmount** | Guards (AuthGuard, ClientIdGuard, ProtectedRoute) chamavam setState após navigate/unmount | Refs `isMountedRef` e cleanup no useEffect; só chamar setState quando `isMountedRef.current`. |
| **Timeout 8s vs estado "authenticated"** | Após 8s exibia "Não foi possível verificar", mas checkAuth ainda podia chamar setAuthState('authenticated') | Ref `timedOutRef`; só chamar setAuthState('authenticated') se `!timedOutRef.current`. |
| **Layout bloqueava sync por auth** | `ensureSupabaseAuthenticated()` no Layout sem timeout; se falhasse ou demorasse, sync não iniciava | `Promise.race` com 8s; em caso de timeout/erro, inicia sync engine mesmo assim (best-effort). |
| **Loading sem acessibilidade** | Telas "Verificando acesso/configuração" sem role/aria | `role="status"`, `aria-live="polite"`, `aria-busy="true"`, `aria-hidden` no spinner. |

## 2) Arquivos alterados e por quê

| Arquivo | Motivo |
|---------|--------|
| `src/routes/ProtectedRoute.tsx` | Timeout em ensureSupabaseAuthenticated; refs isMounted/timedOut/hasRedirected; evitar setState após unmount e race com timeout 8s. |
| `src/components/AuthGuard.tsx` | Ref isMountedRef e cleanup; setReady(true) só se montado; acessibilidade (role, aria-*) e padding no loading. |
| `src/components/ClientIdGuard.tsx` | Ref isMountedRef e cleanup; setReady(true) só se montado; acessibilidade e padding no loading. |
| `src/app/Layout.tsx` | Promise.race(ensureSupabaseAuthenticated, 8s); em timeout/erro inicia startSyncEngine(30000) mesmo assim. |
| `AUDITORIA_LOGIN_SYNC_UI.md` | Documentação desta auditoria. |

## 3) Riscos de regressão e mitigação

- **ProtectedRoute** não é usado nas rotas atuais (Layout usa ClientIdGuard + AuthGuard). Nenhuma mudança de comportamento para o fluxo atual; apenas deixa ProtectedRoute mais seguro se for usado no futuro.
- **Layout**: em ambiente sem Supabase ou com auth muito lenta, o sync passa a iniciar após 8s mesmo sem sessão. Pull/push podem falhar (401), mas não bloqueia mais a UI; comportamento já era "best-effort".
- **Guards**: lógica de redirect inalterada; apenas evita setState após unmount, reduzindo warnings e possíveis loops em edge cases.

## 4) Build final

- `npm run type-check`: OK  
- `npm run build`: OK (tsc && vite build)  
- `npm run lint`: ESLint não está instalado como dependência; script existe mas comando falha no ambiente. TypeScript e build cobrem erros de tipo.

## 5) Checklist técnico executado

- **A)** `npm run type-check` e `npm run build` — OK. Lint não disponível.
- **B)** Sessão: getCurrentSession é síncrono; estado "verificando" finaliza com timeout 8s ou ao concluir checkAuth; refs evitam setState após unmount; fallback para /login mantido.
- **C)** Auth: ensureSupabaseAuthenticated com timeout no ProtectedRoute e no Layout; sem novo AuthProvider (evitar breaking change).
- **D)** Sync: singleton (isStarted) e mutex (isSyncing) já existiam; Layout não bloqueia mais o início do sync por causa de auth.
- **E)** UI: loading com role/aria e padding; mobile já tinha estilos em layout.css e mobile.css; sem remoção de funcionalidades.
