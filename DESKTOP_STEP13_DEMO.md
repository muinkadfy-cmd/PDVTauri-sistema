# Step 13 — Modo DEMO (7 dias) + Bloqueio Automático (Desktop/PROD)

## Como funciona
- No **Desktop (Tauri) em PRODUÇÃO**, se não houver licença instalada, o sistema entra automaticamente em **MODO DEMO por 7 dias**.
- Durante o DEMO, o app funciona normalmente, mas mostra o status **🆓 DEMO**.
- Quando o DEMO expira, o acesso fica **bloqueado** e o usuário é enviado para **/ativacao** para instalar a licença.

## Anti-pirataria (anti “voltar relógio”)
- O sistema grava `trial_last_seen_ms` no banco global (SQLite/SQLCipher).
- Se detectar que o relógio do Windows voltou mais do que 6h, o app marca como **BLOQUEADO**.

## Onde fica gravado
- Desktop: tabela `kv` do banco global `__global__` (criptografado no Step12/SQLCipher).
- Web (se usar): localStorage.

## Como renovar / virar pago
- Gere a licença no **ADMIN MASTER** e envie o arquivo `.lic` para o cliente.
- O cliente importa em **Ativação do Sistema**.
