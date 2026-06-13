# Auditoria rápida — Rotas, Login e Recuperação de Senha

## Achados críticos (impacto produção)
- AuthGuard podia ficar preso em "Carregando..." se qualquer promise lançasse erro ou ficasse pendurada (sem try/finally).
- Chamadas remotas (Supabase sessão/licença/rotas) sem timeout podiam congelar navegação em rede ruim.
- Reset de senha permitia abrir formulário mesmo sem sessão válida (link expirado), gerando falha/confusão.

## Correções aplicadas neste zip
- AuthGuard com try/catch/finally + timeouts (4s) para não travar UI.
- ResetSenhaPage detecta link inválido/expirado e mostra UI correta (sem travar).
- "Esqueci minha senha" com mensagem genérica (não vaza se e-mail existe / detalhes).

## O que testar após atualizar
1. Login email/senha (com e sem internet)
2. Troca de rotas (painel → vendas → financeiro etc.)
3. Link de reset de senha (válido e expirado)
4. Acesso sem store_id (deve redirecionar /setup ou /login conforme seu fluxo)
