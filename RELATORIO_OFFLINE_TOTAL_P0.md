# RELATÓRIO — Lote P0 Desktop Offline Total

## Objetivo
Transformar o Desktop/Tauri em modo oficial offline/local, reduzindo conflito com Supabase, PWA, multi-loja e updater antigo.

## Arquivos alterados
- src-tauri/src/lib.rs
- src-tauri/src/updater.rs
- src/lib/env.ts
- src/lib/auth-supabase.ts
- src/lib/rememberLogin.ts
- src/lib/pwa-register-desktop-shim.ts
- src/pages/LoginPage.tsx
- src/main.tsx
- vite.config.ts

## Correções aplicadas
1. Removida inicialização global do updater Tauri sem configuração fixa.
2. Corrigida API do updater: update.notes/pub_date -> update.body/date.
3. Desktop agora força Supabase desligado mesmo se .env.local tiver chaves antigas.
4. Login Desktop ficou local/offline, com texto correto para cliente.
5. Store ID no Desktop ficou somente leitura na tela de login.
6. Login bloqueia tentativa de entrar em Store ID diferente da instalação atual.
7. Cadastro local da loja usa o Store ID fixo já existente no Desktop.
8. Lembrar acesso não salva mais senha em base64 e limpa senha legada.
9. Device ID/Store ID/DesktopKV hidratam antes do React renderizar.
10. PWA/Service Worker não entra mais no build Desktop.
11. Criado shim para virtual:pwa-register no Desktop.
12. Build Desktop mudou para minify esbuild para evitar travamento no terser.

## Testes feitos
- npm install --ignore-scripts: OK
- npm run type-check: OK
- npm run build:desktop: OK

## Não testado aqui
- cargo check: não testado porque o ambiente não tem cargo instalado.
- npm run tauri:build/MSI: deve ser rodado no PC Windows com Rust/Tauri instalado.

## Comandos para testar no Windows PowerShell
cd C:\PDVTauri-sistema
npm run type-check
npm run build:desktop
cd C:\PDVTauri-sistema\src-tauri
cargo check
cd C:\PDVTauri-sistema
npm run tauri:dev
npm run tauri:build

## Status
P0 Desktop Offline: PARCIAL AVANÇADO / PRONTO PARA TESTE NO WINDOWS
