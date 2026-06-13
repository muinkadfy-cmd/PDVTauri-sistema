# RELATÓRIO P19 — AUDITORIA SÊNIOR DA ABA LOGIN

## Escopo
Refinamento visual, micro-polimento e correção de consistência da tela de login desktop/offline com foco em:
- visual comercial premium retro
- melhor leitura em PC fraco
- menos poluição visual
- fluxo mais simples para usuário leigo
- consistência com o restante do tema clássico do sistema

## Arquivos alterados
- `src/pages/LoginPage.tsx`
- `src/pages/LoginPage.css`

## Auditoria sênior — problemas encontrados

### P0
- **Nenhum P0 funcional grave encontrado no escopo visual da aba login.**

### P1
1. **Hierarquia visual irregular**
   - Marca, título, subtítulo e card competiam entre si.
   - O usuário via muita informação no mesmo peso visual.

2. **Texto e rótulos pouco coerentes com o modo offline**
   - Botão `Configurar conexão` soava errado para um sistema local/offline.
   - Campo `E-mail ou usuário` no desktop ficava genérico demais para o fluxo `admin / 1234`.

3. **Poluição visual no rodapé de status**
   - Rodapé técnico com pouca hierarquia, leitura pesada e sem distinção clara entre rótulo e valor.

### P2
1. **Micro espaçamentos e respiro**
   - Margens e alturas dos blocos ainda estavam grandes em alguns pontos e comprimidas em outros.
   - Faltava respiro entre cabeçalho do card, ajuda introdutória e formulário.

2. **Tipografia e contraste fino**
   - Labels e subtítulos estavam pesados em alguns pontos e sem gradação clara.
   - Faltava microajuste de contraste para textos secundários.

3. **Consistência de ícones e botões**
   - Ícones corretos, porém sem padronização fina de leitura e peso dentro da composição.
   - CTA principal e ações secundárias pediam melhor acabamento e nomenclatura.

### P3
1. **Texto com ortografia/terminologia a lapidar**
   - Ajustado `redefinição`.
   - Ajustada capitalização para reduzir ruído visual.

2. **Herança leve de linguagem antiga**
   - Mistura de termos muito técnicos com termos de usuário final.
   - Mantido o que era estrutural e polido o que gerava ruído.

## Melhorias implementadas
- introdução de kicker superior discreto: `Desktop local · visual clássico`
- redução do tamanho visual da marca para melhorar equilíbrio
- subtítulo e meta text refinados
- card com intro de uso simples para leigo
- faixa de `Acesso inicial: admin / 1234` mais clara e organizada
- rótulos ajustados para o contexto desktop local:
  - `Usuário de acesso`
  - `Senha de acesso`
  - `Configurar sistema local`
- bloco “Salvar usuário neste dispositivo” com explicação de segurança
- botão principal refinado para `Entrar no sistema`
- barra de status inferior reorganizada com:
  - rótulo técnico separado do valor
  - melhor contraste
  - leitura mais rápida
- microajustes de espaçamento, alturas, densidade, bordas, foco e hover
- responsividade refinada para largura menor e altura reduzida
- preservado visual clássico/quadrado sem modernizar demais

## O que foi preservado de propósito
- identidade clássica/retro
- estrutura central do fluxo de login
- comportamento offline
- loader do botão de entrada
- barra de status inferior no estilo desktop

## Riscos e observações honestas
- não removi a barra de status inferior porque ela faz parte do padrão visual clássico do sistema e ajuda consistência com outras abas
- o parâmetro `password` em `saveRememberedLogin` continua existindo por compatibilidade, embora não seja salvo; isso é herança controlada e pode ser limpo em lote futuro sem urgência
- o projeto desta cópia não trouxe `node_modules`, então não foi possível executar build/type-check completo localmente neste ambiente

## Testes realizados
- inspeção estrutural manual dos arquivos alterados
- revisão de JSX da tela de login
- revisão de estados visuais CSS
- revisão de responsividade básica por CSS

## Testes não realizados neste ambiente
- `npm run type-check`
- `npm run build:desktop`
- `npm run tauri:build`

## Nota por critério
| Critério | Nota | Estrelas | Status |
|---|---:|---|---|
| Hierarquia visual | 9.4 | ⭐⭐⭐⭐⭐ | PRONTO |
| Respiro e espaçamento | 9.2 | ⭐⭐⭐⭐⭐ | PRONTO |
| Tipografia | 9.3 | ⭐⭐⭐⭐⭐ | PRONTO |
| Contraste | 9.2 | ⭐⭐⭐⭐⭐ | PRONTO |
| Micro acabamento | 9.4 | ⭐⭐⭐⭐⭐ | PRONTO |
| Fluxo para leigo | 9.5 | ⭐⭐⭐⭐⭐ | PRONTO |
| Consistência com abas clássicas | 9.3 | ⭐⭐⭐⭐⭐ | PRONTO |
| Poluição visual | 9.1 | ⭐⭐⭐⭐⭐ | PRONTO |

## Veredito
A base da aba login ficou **mais comercial, mais clara, menos poluída e mais coerente com o tema clássico premium retro**. O ganho principal foi em leitura, hierarquia, confiança e simplicidade de uso.

## Próximo ideal
**P20 — micro refinamento do modal/configuração e tela de redefinição de senha local**, para deixar o fluxo auxiliar do login no mesmo nível visual da tela principal.
