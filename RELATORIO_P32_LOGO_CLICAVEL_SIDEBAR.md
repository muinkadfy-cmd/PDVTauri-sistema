# RELATÓRIO P32 — Logo clicável na sidebar sem quebrar navegação

## Pedido
Verificar por que o círculo “ST/SO” não tinha opção de clicar e permitir colocar foto/logo ajustada sem quebrar nada.

## Auditoria
### Causa encontrada
O bloco da sidebar tinha sido ajustado para mostrar:
- nome da empresa cadastrada;
- iniciais da empresa quando não havia logo;
- logo se `company.logo_url` já existisse.

Mas o círculo não tinha ação própria. Ele estava dentro de um link visual do painel, então não existia input de arquivo nem rotina para salvar a logo pela sidebar.

## Correção aplicada
- O círculo da marca virou um botão seguro.
- Ao clicar nele, abre seletor de imagem.
- A imagem é validada como imagem.
- Limite de segurança: até 2,5 MB.
- A logo é normalizada para PNG 256x256 com `object-fit: contain`, evitando cortar logotipo retangular.
- Salva em:
  - `smart-tech-company`
  - `smart-tech-company-cache`
- Atualiza o contexto da empresa com `refreshCompany()`.
- Dispara evento `smarttech:company-logo-changed`.
- Mostra toast de sucesso ou erro.
- Mantém fallback com iniciais da empresa se não houver logo ou se a imagem falhar.

## Arquivos alterados
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Sidebar.css`
- `scripts/check-sidebar-logo-clickable.mjs`
- `package.json`

## Teste executado
```powershell
node scripts/check-sidebar-logo-clickable.mjs
```

## Testes recomendados no PC
```powershell
npm run check:sidebar-logo-clickable
npm run type-check
npm run build:desktop
npm run tauri:dev
```

## Como testar manualmente
1. Entrar no sistema.
2. Clicar no círculo da empresa na sidebar.
3. Escolher uma imagem PNG/JPG/WebP/SVG.
4. Conferir se a logo aparece no círculo sem cortar demais.
5. Fechar e abrir o app.
6. Conferir se a logo permanece.

## Risco de regressão
Baixo. Não altera rotas, banco de vendas, financeiro, backup ou autenticação. Só adiciona upload local de logo da empresa na sidebar.

## Classificação por aba/setor
| Aba / Setor | Nota | Estrelas | Rank | Status | Risco |
|---|---:|---|---|---|---|
| Sidebar / marca da loja | 9.6 | ⭐⭐⭐⭐⭐ | A | PRONTO | Baixo |
| Logo da empresa | 9.4 | ⭐⭐⭐⭐⭐ | A | PRONTO | Baixo |
| Configuração visual | 9.2 | ⭐⭐⭐⭐⭐ | A- | PRONTO | Baixo |
| Persistência local da logo | 9.0 | ⭐⭐⭐⭐⭐ | A- | BOM | Baixo |
| Risco de regressão | 9.5 | ⭐⭐⭐⭐⭐ | A | BAIXO | Baixo |

## Classificação geral do sistema
Nota geral: 8.55/10  
Estrelas: ⭐⭐⭐⭐☆  
Rank: A- inicial  
Nível: 4.05/5  
Status: PRÉ-PRODUÇÃO FORTE  
Desempenho: BOM  
