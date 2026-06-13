# Testes 10/10 (Smart Tech PDV)

Este projeto já possui uma **suíte interna** (rota `/testes` em modo DEV) e, agora, também inclui **testes automatizados**:

- ✅ **Unit tests (Vitest)**: valida regras críticas (store_id, outbox, storage prefix)
- ✅ **E2E (Playwright)**: smoke tests + execução da suíte interna

O objetivo é você conseguir validar rapidamente se está **tudo funcionando** antes de fazer deploy.

---

## 1) Rodar testes pelo navegador (mais fácil)

1. No terminal:

```bash
npm install
npm run dev
```

2. Abra:

- `http://localhost:5173/testes?store=SEU_STORE_ID`

3. Clique em **"Rodar Todos os Testes"**.

> Dica: deixe a opção **Supabase** desmarcada se estiver sem internet.

---

## 2) Unit tests (Vitest)

```bash
npm run test:unit
```

Saídas úteis:

- `coverage/` (relatório HTML)

---

## 3) E2E (Playwright)

```bash
npx playwright install
npm run test:e2e
```

O Playwright vai subir o `npm run dev` automaticamente na porta **4173**.

### Variáveis opcionais

Por padrão, os testes usam o `store_id` padrão do projeto. Se quiser forçar:

```bash
# Windows (PowerShell)
$env:E2E_STORE_ID="7371cfdc-7df5-4543-95b0-882da2de6ab9"; npm run test:e2e

# Linux/Mac
E2E_STORE_ID=7371cfdc-7df5-4543-95b0-882da2de6ab9 npm run test:e2e
```

---

## 4) Checklist manual (produção)

Use este checklist rápido sempre que publicar uma versão:

1. **Login**
   - Loga e cai no Painel sem travar.
2. **Offline**
   - Desligue internet.
   - Crie 1 cliente + 1 produto.
   - Confira que aparecem na lista.
3. **Outbox / Sync**
   - Ligue a internet.
   - Abra o Painel e confirme que o status muda para **Sincronizado**.
4. **Cache / Atualização**
   - Abra em uma aba, faça deploy, abra em outra aba.
   - Se travar, use o botão **"Limpar cache e recarregar"** (banner do app).
5. **Mobile/PWA**
   - Instale como PWA.
   - Abra pelo ícone e confirme que carrega e não perde o `store_id`.

---

## 5) Rodar tudo (pré-deploy)

```bash
npm run validate:full
```

Se quiser incluir E2E:

```bash
npm run validate:full:e2e
```
