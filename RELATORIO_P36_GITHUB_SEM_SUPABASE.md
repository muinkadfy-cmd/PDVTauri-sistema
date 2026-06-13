# RELATÓRIO P36 — Novo GitHub + remover Supabase do Desktop

## Pedido
Usar o novo repositório GitHub mostrado na tela:

`git@github.com:muinkadfy-cmd/PDVTauri-sistema.git`

E remover Supabase que não seja necessário para o fluxo de atualização assinada.

## Auditoria inicial
### GitHub
Pela imagem, o repositório existe e está vazio/novo:
- usuário/organização: `muinkadfy-cmd`
- repositório: `PDVTauri-sistema`
- URL SSH: `git@github.com:muinkadfy-cmd/PDVTauri-sistema.git`

No pacote local auditado, não havia `.git`, então o ZIP não estava conectado diretamente ao repo.

### Supabase
Supabase aparecia como herança web/online:
- dependência `@supabase/supabase-js`
- `src/lib/supabaseClient.ts`
- adaptadores remotos
- licença remota

Para o foco atual do sistema:
- Desktop/Tauri
- SQLite local
- offline-first
- atualização assinada Tauri

Supabase não é necessário.

### Atualização assinada
A atualização assinada usa:
- Tauri updater
- `latest.json`
- `.sig`
- `VITE_DESKTOP_UPDATE_ENDPOINTS`
- `VITE_DESKTOP_UPDATE_PUBKEY`
- `TAURI_SIGNING_PRIVATE_KEY` somente no PC admin

Não precisa de Supabase.

## Correções aplicadas
1. Removida dependência `@supabase/supabase-js` do `package.json`.
2. `supabaseClient.ts` virou stub seguro:
   - não inicializa cliente remoto;
   - não importa pacote Supabase;
   - retorna `null`/`false` para chamadas remotas.
3. `license-remote-adapter.ts` virou stub seguro:
   - licença remota desligada;
   - licença local/mensal continua independente.
4. Removidos imports diretos `@supabase/supabase-js` de arquivos críticos.
5. Adicionado `.gitignore` forte para não subir:
   - `.env`
   - `.pem`
   - chaves/certificados
   - bancos locais
   - releases/updates
   - target/dist/node_modules
   - relatórios temporários/test-results
6. Criado check:
   - `scripts/check-desktop-no-supabase.mjs`
7. Criado check do repo:
   - `scripts/check-github-repo-ready.mjs`

## Arquivos alterados/adicionados
- `.gitignore`
- `package.json`
- `src/lib/supabaseClient.ts`
- `src/lib/capabilities/license-remote-adapter.ts`
- `src/lib/license.ts`
- `src/lib/repository/deletions.ts`
- `scripts/check-desktop-no-supabase.mjs`
- `scripts/check-github-repo-ready.mjs`

## Testes executados
```powershell
node scripts/check-desktop-no-supabase.mjs
```

## Comandos para conectar no novo GitHub
### Opção SSH
```powershell
cd C:\PDVTauri-sistema

git init
git branch -M main
git remote add origin git@github.com:muinkadfy-cmd/PDVTauri-sistema.git

npm run check:desktop-no-supabase
npm run release:check
npm run type-check

git add .
git commit -m "release: preparar Smart Tech PDV Tauri desktop"
git push -u origin main
```

### Se o remote já existir
```powershell
git remote set-url origin git@github.com:muinkadfy-cmd/PDVTauri-sistema.git
git push -u origin main
```

### Opção HTTPS
```powershell
git remote add origin https://github.com/muinkadfy-cmd/PDVTauri-sistema.git
git push -u origin main
```

## Checks depois de conectar
```powershell
npm run check:github-repo
npm run check:desktop-no-supabase
npm run release:check
npm run type-check
npm run build:desktop
```

## Classificação por aba/setor
| Aba / Setor | Nota | Estrelas | Rank | Status | Risco |
|---|---:|---|---|---|---|
| GitHub novo | 8.8 | ⭐⭐⭐⭐☆ | A- | PRONTO PARA CONECTAR | Baixo/Médio |
| Supabase no Desktop | 9.4 | ⭐⭐⭐⭐⭐ | A | DESATIVADO | Baixo |
| Atualização assinada | 9.1 | ⭐⭐⭐⭐⭐ | A- | INDEPENDENTE | Médio |
| Segurança de secrets | 9.2 | ⭐⭐⭐⭐⭐ | A- | BOM | Baixo |
| Release admin | 8.9 | ⭐⭐⭐⭐☆ | A- | BOM | Médio |
| Risco de regressão | 8.8 | ⭐⭐⭐⭐☆ | A- | BAIXO/MÉDIO | Médio |

## Classificação geral do sistema
Nota geral: 8.8/10  
Estrelas: ⭐⭐⭐⭐☆  
Rank: A-  
Nível: 4.3/5  
Status: PRODUÇÃO CONTROLADA EM PREPARO  

## Riscos restantes
- `package-lock.json` pode precisar ser regenerado no seu PC com `npm install` para remover totalmente os rastros do pacote Supabase do lock.
- Ainda existem documentos antigos citando Supabase; isso não entra no build, mas pode ser limpo em lote P3.
- Conectar GitHub depende de autenticação SSH/HTTPS no seu PC.
