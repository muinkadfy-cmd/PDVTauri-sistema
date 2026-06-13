# Teste extremo (Passo 10) — PDV Offline

Este roteiro é para validar **velocidade em PC fraco**, **offline total**, **impressão** e **segurança de dados**.

## Preparação
1. Feche outros programas pesados.
2. Se possível, teste com o PC desconectado da internet (Wi‑Fi desligado / cabo removido).
3. Abra o sistema e aguarde o **Login** aparecer.

## A) Velocidade (PC fraco)
1. Login → entrar no sistema.
2. Abra **Painel** (deve ficar utilizável rápido).
3. Abra **Clientes** e digite na busca por 10–15 segundos.
4. Abra **Produtos** e repita (busca + filtros).
5. Abra **Vendas** e faça uma venda teste.

**Se travar:** vá em **Ajuda → Auto-teste** e depois baixe o **Pacote de Suporte**.

## B) Offline / internet intermitente
1. Com internet desligada, crie:
   - 1 cliente
   - 1 produto
   - 1 venda
   - 1 OS
2. Feche o app e abra de novo.
3. Confirme que os dados continuam lá.

## C) Queda de energia (simulação segura)
> NÃO puxe da tomada durante gravações. O teste seguro é “fechar o app à força”.

1. Faça uma venda teste.
2. Feche o app rapidamente (Alt+F4) logo após salvar.
3. Abra o app de novo e verifique se a venda existe.

Se o banco corromper, o sistema pode entrar em **Modo Recuperação**.

## D) Impressão (A4 e térmica)
1. Crie uma OS com bastante texto (observações grandes).
2. Imprima em A4:
   - verifique margens
   - assinatura não pode ser cortada
3. Imprima em térmica (58/80mm):
   - texto não pode sair fora do papel
   - QR (se houver) deve ler rápido

## E) Backup / Restore
1. Vá em **Backup** e gere um backup.
2. Confirme que o arquivo foi criado.
3. (Opcional) Teste restaurar o backup em uma máquina de teste.

## F) Suporte (o que enviar)
1. Abra **Ajuda → Auto-teste** e clique em **Executar auto-teste**.
2. Clique em **Baixar Pacote de Suporte (ZIP)**.
3. Envie o ZIP para o suporte.

---

### Resultado esperado
- Login aparece rápido.
- Busca em Clientes/Produtos não trava o teclado.
- Offline funciona (dados persistem).
- Impressão sai sem cortes.
- Backup é criado sem travar.

---

Data: (preencha ao testar)  
Máquina: (modelo/ram)  
