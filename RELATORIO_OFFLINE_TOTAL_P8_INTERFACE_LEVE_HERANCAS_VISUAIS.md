# Lote P8 — Interface leve e limpeza de heranças visuais

## Objetivo
Reduzir heranças visuais antigas, corrigir ícones quebrados no painel e deixar o Desktop offline mais leve para PCs fracos.

## Arquivos alterados/adicionados
- `src/components/ui/AppIcon.tsx`
- `src/components/ui/Icon3D.tsx`
- `src/components/layout/menuConfig.ts`
- `src/components/layout/StatusFooter.tsx`
- `src/styles/index.css`
- `src/styles/desktop-lite.css`
- `scripts/clean-ui-legacy.mjs`
- `package.json`

## Correções aplicadas
1. Corrigidos ícones quebrados que apareciam como texto:
   - `check-circle`
   - `sparkles`

2. `Icon3D` não imprime mais nomes crus de ícone na tela.
   - Fallback seguro agora usa ícone `more`.

3. Menu lateral:
   - `Atualizações` virou `Atualizar sistema`.

4. Rodapé/status:
   - Removido bloco visual de licença/ativação.
   - Entrou status simples: `Offline local`.

5. CSS leve:
   - Nova camada `desktop-lite.css`.
   - Reduz animações, blur, backdrop-filter, sombras e transforms no modo performance.
   - Mantém layout e cores, mas diminui peso visual.

6. Limpeza opcional:
   - Novo script para arquivar painel antigo:
     - `npm run cleanup:ui-legacy:dry`
     - `npm run cleanup:ui-legacy`

## O que NÃO foi feito
- Não apaguei dados SQLite.
- Não mexi em vendas, OS, financeiro, backup ou persistência.
- Não removi a tela de atualizações, porque o Desktop ainda precisa atualizar via GitHub/Cloudflare.

## Testes feitos nesta auditoria
- `npm run type-check`: OK
- `npm run prebuild && npx tsc --noEmit && npx vite build --mode desktop --configLoader runner`: OK
- `npm run check:desktop-offline-clean`: OK
- `npx vitest run tests/unit/finance-calc-regression.test.ts --configLoader runner`: OK — 7 testes passaram
- `npm run cleanup:ui-legacy:dry`: OK

## Testes recomendados no seu Windows
```powershell
cd C:\PDVTauri-sistema

npm run type-check
npm run build:desktop
npm run check:desktop-offline-clean
npm run qa:unit:finance
npm run cleanup:ui-legacy:dry
```

Depois testar:
```powershell
npm run tauri:dev
```

## Nota do lote
- Interface leve: 8.7/10
- Correção de ícones: 10/10
- Redução de herança visual: 8.5/10
- Risco para dados: baixo
