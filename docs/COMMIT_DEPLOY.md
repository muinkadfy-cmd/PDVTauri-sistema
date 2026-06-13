# Commit + Deploy (Cloudflare Pages)

## Commit (GitHub)

No terminal, dentro da pasta do projeto:

```bash
git status
git add .
git commit -m "test: add vitest + playwright + internal runner e2e"
git push
```

## Deploy (Cloudflare Pages)

1. Cloudflare Dashboard → **Pages** → seu projeto.
2. Confirme as configs:
   - **Build command**: `npm run build`
   - **Build output**: `dist`
   - **Node version**: 20 (recomendado)
3. Em **Environment Variables** (Production e Preview), confirme:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_STORE_ID` (opcional, se você usa o `store_id` pela URL)
4. Faça **Deploy**.

### Dica anti-cache (quando der “erro de atualização”)

Se o cliente reclamar que “travou / não atualiza”:

1. No app, usar o botão **"Limpar cache e recarregar"** (banner).
2. No celular: Configurações → Apps → (navegador/PWA) → Limpar dados.
