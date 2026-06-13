# feat: force admin + polimento UI web/mobile

## 1) Modo ADMIN (VITE_FORCE_ADMIN)

- **Flag:** `VITE_FORCE_ADMIN=true` em `.env` / `.env.local`
- **Config:** `src/config/env.ts` – exporta `FORCE_ADMIN` (lê `VITE_FORCE_ADMIN`)
- **Auth:** `src/lib/auth-supabase.ts` – quando `FORCE_ADMIN` e `store_id` válido:
  - Se há sessão real: retorna sessão com `role: 'admin'`
  - Se não há sessão: retorna sessão sintética (admin, sem exigir login)
- **Rotas:** Não bloqueia por permissão (ROLE_ROUTES['admin'] já tem todas as rotas)
- **Badge:** Topbar exibe badge "ADMIN" no canto quando `FORCE_ADMIN` (opcional)
- **Escopo:** Apenas front; sem alteração de schema no Supabase

## 2) Polimento UI/UX (web + mobile)

- **Layout:** `src/styles/layout.css` – `overflow-x: hidden` e padding em `.main-content`, `.page-container`, `.app` no breakpoint mobile (480px)
- **Mobile:** `src/styles/mobile.css` – overflow em `.app`, `.main-content`, `.page-container`; `-webkit-text-size-adjust: 100%` no body
- **Componentes:** `src/styles/components.css` – regra para `.empty-state p` (mensagens vazio/erro)
- **Topbar:** `src/components/layout/Topbar.tsx` + `Topbar.css` – badge ADMIN e estilos responsivos do badge

## 3) Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/config/env.ts` | Exporta `FORCE_ADMIN` |
| `.env.example` | Comentário e exemplo `VITE_FORCE_ADMIN` |
| `src/lib/auth-supabase.ts` | Lógica force admin em `getCurrentSession()` |
| `src/components/layout/Topbar.tsx` | Badge ADMIN quando `FORCE_ADMIN` |
| `src/components/layout/Topbar.css` | Estilos `.topbar-badge-admin` |
| `src/styles/layout.css` | Overflow e padding mobile |
| `src/styles/mobile.css` | Overflow e text-size-adjust mobile |
| `src/styles/components.css` | Empty-state p |
| `FEAT_FORCE_ADMIN_POLIMENTO.md` | Este resumo |

## 4) Validação

- `npm run type-check`: OK
- `npm run build`: OK
- Login: com `VITE_FORCE_ADMIN=true` e `store_id` na URL/localStorage, não fica preso em "verificando acesso" (sessão sintética ou override de role).
