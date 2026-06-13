# 🛠️ GUIA DE SUPORTE TÉCNICO

**PDV Smart Tech - Manual Interno de Atendimento**  
**Versão:** 1.0.0  
**Para uso da equipe de suporte**

---

## 🎯 OBJETIVO

Este guia ajuda a equipe de suporte a resolver problemas dos clientes de forma rápida e padronizada.

---

## 📋 PROTOCOLO DE ATENDIMENTO

### 1. **Recebimento do Chamado**

```
□ Cumprimentar o cliente
□ Pegar dados:
  - Nome
  - Empresa
  - Telefone
  - Descrição do problema
  - Quando começou
  - O que estava fazendo
□ Anotar número do chamado
□ Informar tempo estimado de resposta
```

### 2. **Classificação da Urgência**

| Nível | Descrição | Tempo de Resposta |
|-------|-----------|-------------------|
| 🔴 **CRÍTICO** | Sistema parado, não consegue vender | Imediato (até 1h) |
| 🟡 **ALTO** | Funcionalidade importante não funciona | Até 4h |
| 🟢 **MÉDIO** | Dúvida ou problema não bloqueante | Até 24h |
| ⚪ **BAIXO** | Sugestão ou melhoria | Até 48h |

### 3. **Diagnóstico**

```
□ Fazer perguntas direcionadas
□ Pedir screenshot (se possível)
□ Reproduzir o problema (se possível)
□ Identificar causa
```

### 4. **Resolução**

```
□ Aplicar solução
□ Testar com o cliente
□ Documentar solução
□ Confirmar satisfação
```

### 5. **Fechamento**

```
□ Perguntar se resolveu
□ Perguntar se tem mais alguma dúvida
□ Informar canais de contato
□ Agradecer
□ Registrar chamado como "Resolvido"
```

---

## 🔍 PROBLEMAS MAIS COMUNS E SOLUÇÕES

### **CATEGORIA: LOGIN E ACESSO**

---

#### ❌ **Problema: Esqueceu a senha**

**Sintomas:**
- Cliente não consegue fazer login
- "Senha incorreta"

**Diagnóstico:**
```
Perguntar:
- Qual usuário está usando?
- Tem certeza da senha?
- Está digitando maiúsculas/minúsculas corretas?
```

**Solução:**
```
1. Acessar sistema como admin
2. Menu → Usuários
3. Editar usuário do cliente
4. Redefinir senha temporária
5. Informar nova senha
6. Pedir para trocar após login
```

**Tempo:** 2-3 minutos

---

#### ❌ **Problema: "Usuário não encontrado"**

**Sintomas:**
- Mensagem "Usuário não encontrado"

**Diagnóstico:**
```
Perguntar:
- Qual usuário está digitando?
- Foi criado usuário para essa pessoa?
```

**Solução:**
```
1. Verificar se usuário existe no sistema
2. Se não existe: criar usuário
3. Se existe: verificar se está ativo
4. Confirmar credenciais
```

**Tempo:** 3-5 minutos

---

### **CATEGORIA: VENDAS**

---

#### ❌ **Problema: Não consegue adicionar produto na venda**

**Sintomas:**
- Produto não aparece ao buscar
- Campo de busca não funciona

**Diagnóstico:**
```
Perguntar:
- Produto está cadastrado?
- Como está digitando o nome?
```

**Solução:**
```
1. Verificar se produto existe (Menu → Produtos)
2. Se não existe: cadastrar produto
3. Se existe: verificar nome/código
4. Tentar buscar por parte do nome
5. Alternativa: usar "Produto Avulso"
```

**Tempo:** 2-5 minutos

---

#### ❌ **Problema: Venda não aparece nos relatórios**

**Sintomas:**
- Venda foi feita mas não aparece no relatório

**Diagnóstico:**
```
Perguntar:
- Quando foi feita a venda?
- Qual filtro de período está usando?
- Venda aparece na lista de vendas?
```

**Solução:**
```
1. Ir em Vendas → Verificar se venda está lá
2. Se está: problema é filtro de relatório
   - Mudar filtro para "Todos" ou "Período Personalizado"
3. Se não está: venda não foi finalizada
   - Refazer venda
```

**Tempo:** 3-5 minutos

---

#### ❌ **Problema: Estoque negativo**

**Sintomas:**
- Produto com estoque -5, -10, etc.

**Diagnóstico:**
```
Perguntar:
- Vendeu mais do que tinha em estoque?
- Esqueceu de atualizar entrada de estoque?
```

**Solução:**
```
1. Menu → Produtos
2. Editar produto com estoque negativo
3. Corrigir quantidade manualmente
4. Orientar: cadastrar entradas de estoque
```

**Tempo:** 2-3 minutos

---

### **CATEGORIA: ORDENS DE SERVIÇO**

---

#### ❌ **Problema: OS não entra no financeiro**

**Sintomas:**
- Finalizou OS mas não aparece no fluxo de caixa

**Diagnóstico:**
```
Perguntar:
- Marcou pagamento como "Pago"?
- Qual status da OS?
```

**Solução:**
```
1. Abrir OS
2. Editar
3. Verificar "Status de Pagamento"
4. Se está "Pendente", mudar para "Pago"
5. Salvar
6. Sistema registra automaticamente
```

**Tempo:** 2-3 minutos

---

### **CATEGORIA: IMPRESSÃO**

---

#### ❌ **Problema: Impressão não funciona**

**Sintomas:**
- Clica em imprimir mas nada acontece
- Impressão sai cortada/errada

**Diagnóstico:**
```
Perguntar:
- Tipo de impressora? (Térmica 80mm ou Laser/Jato)
- Impressora está ligada e conectada?
- Consegue imprimir página de teste do Windows?
```

**Solução:**
```
Para impressora TÉRMICA (80mm):
1. Configurações → Impressora
2. Modo: "Compacto"
3. Salvar
4. Testar novamente

Para impressora LASER/JATO:
1. Configurações → Impressora
2. Modo: "Normal"
3. Salvar
4. Testar novamente

Se ainda não funcionar:
1. Verificar drivers da impressora
2. Testar imprimir do navegador (Ctrl+P)
3. Reiniciar computador
```

**Tempo:** 5-10 minutos

---

#### ❌ **Problema: Termos de garantia não aparecem**

**Sintomas:**
- Recibo não mostra termos de garantia

**Diagnóstico:**
```
Perguntar:
- Já configurou termos de garantia?
- Está habilitado?
```

**Solução:**
```
1. Configurações → Termos de Garantia
2. Verificar se "Habilitar exibição" está marcado
3. Salvar
4. Testar impressão novamente
```

**Tempo:** 2-3 minutos

---

### **CATEGORIA: FINANCEIRO**

---

#### ❌ **Problema: Valores do relatório não batem**

**Sintomas:**
- Cliente diz que faturou X mas relatório mostra Y

**Diagnóstico:**
```
Perguntar:
- Qual período está consultando?
- Está vendo "Total Bruto" ou "Total Líquido"?
- Todas as vendas foram registradas no sistema?
```

**Solução:**
```
1. Explicar diferença:
   - Total Bruto: soma de todas as vendas
   - Total Líquido: bruto menos taxas
   - Lucro Líquido: líquido menos custos

2. Verificar filtro de período

3. Conferir se todas as vendas estão registradas
   (Menu → Vendas → Listar todas)

4. Se necessário, refazer cálculos manualmente
```

**Tempo:** 5-10 minutos

---

### **CATEGORIA: BACKUP**

---

#### ❌ **Problema: Backup não baixa**

**Sintomas:**
- Clica em "Gerar Backup" mas arquivo não baixa

**Diagnóstico:**
```
Perguntar:
- Navegador que está usando?
- Bloqueador de pop-up ativo?
```

**Solução:**
```
1. Verificar se pop-ups estão bloqueados
2. Permitir download para o site
3. Tentar novamente
4. Se não funcionar: usar outro navegador (Chrome)
```

**Tempo:** 3-5 minutos

---

#### ❌ **Problema: Não consegue restaurar backup**

**Sintomas:**
- Erro ao restaurar arquivo de backup

**Diagnóstico:**
```
Perguntar:
- Qual arquivo está usando?
- É arquivo .json?
- Onde pegou esse arquivo?
```

**Solução:**
```
1. Verificar se arquivo é .json
2. Verificar se arquivo está corrompido
3. Tentar abrir em editor de texto (ver se tem conteúdo)
4. Se corrompido: usar backup anterior
5. Se não tem backup: ⚠️ dados perdidos
```

**Tempo:** 5-10 minutos

---

### **CATEGORIA: SISTEMA GERAL**

---

#### ❌ **Problema: Sistema lento**

**Sintomas:**
- Demora para carregar
- Trava ao usar

**Diagnóstico:**
```
Perguntar:
- Quando começou?
- Quantas abas abertas no navegador?
- Computador com quantos GB de RAM?
- Outros programas rodando?
```

**Solução:**
```
1. Fechar outras abas do navegador
2. Limpar cache:
   - Chrome: Ctrl + Shift + Del
   - Marcar "Imagens e arquivos em cache"
   - Limpar
3. Reiniciar navegador
4. Se persistir: reiniciar computador
5. Se ainda persistir: verificar hardware
```

**Tempo:** 5-15 minutos

---

#### ❌ **Problema: Tela fica em branco**

**Sintomas:**
- Página carrega mas fica branca
- Nada aparece

**Diagnóstico:**
```
Perguntar:
- Console do navegador mostra erro? (F12)
- Acontece em outro navegador também?
```

**Solução:**
```
1. Recarregar página (F5)
2. Limpar cache (Ctrl + Shift + Del)
3. Tentar outro navegador
4. Verificar console (F12) para erros
5. Se erro 404: verificar URL
6. Se erro 500: problema no servidor (escalar)
```

**Tempo:** 5-10 minutos

---

## 📞 SCRIPTS DE ATENDIMENTO

### **Script 1: Atendimento Inicial (WhatsApp)**

```
Olá [NOME]! 👋

Obrigado por entrar em contato com o suporte do PDV Smart Tech.

Como posso te ajudar hoje?

Por favor, descreva o problema ou dúvida que está tendo.
```

---

### **Script 2: Coletando Informações**

```
Entendi! Para te ajudar melhor, preciso de algumas informações:

1. Qual seu nome e empresa?
2. O que exatamente está acontecendo?
3. Quando começou o problema?
4. O que você estava fazendo quando aconteceu?

Isso vai me ajudar a resolver mais rápido! 😊
```

---

### **Script 3: Problema Resolvido**

```
Ótimo! Problema resolvido! 🎉

Resumo da solução:
[Descrever o que foi feito]

Está tudo funcionando agora?

Se tiver qualquer outra dúvida, é só chamar!

Tenha um ótimo dia! 😊
```

---

### **Script 4: Precisa Escalar**

```
[NOME], entendi a situação.

Vou precisar verificar isso com mais detalhes.
Vou encaminhar para nossa equipe técnica e 
retorno em até [TEMPO] com uma solução.

Pode aguardar? 🙏
```

---

### **Script 5: Problema Conhecido**

```
Ah, sim! Esse é um problema conhecido.

A solução é:
[Passo a passo]

Já corrigimos isso na última atualização.
Se quiser, posso te ajudar a atualizar o sistema agora.

Quer que eu te ajude?
```

---

## 📊 REGISTRO DE CHAMADOS

### **Template de Registro:**

```
CHAMADO #_____
Data: ____/____/______
Hora: ____:____

CLIENTE:
Nome: _____________________________
Empresa: __________________________
Telefone: _________________________

PROBLEMA:
Descrição: ________________________
____________________________________
____________________________________

Urgência: □ Crítico □ Alto □ Médio □ Baixo

DIAGNÓSTICO:
____________________________________
____________________________________

SOLUÇÃO APLICADA:
____________________________________
____________________________________

TEMPO GASTO: _____ minutos

STATUS: □ Resolvido □ Em andamento □ Escalado

SATISFAÇÃO: □ 😊 Satisfeito □ 😐 Neutro □ 😞 Insatisfeito
```

---

## 📈 MÉTRICAS DE SUPORTE

### **KPIs Importantes:**

```
□ Tempo médio de resposta
□ Tempo médio de resolução
□ Taxa de resolução no primeiro contato
□ Satisfação do cliente (NPS)
□ Chamados por categoria
□ Chamados por urgência
```

---

## 🎓 TREINAMENTO CONTÍNUO

### **Checklist de Conhecimento:**

```
□ Conhece todas as funcionalidades do sistema
□ Sabe fazer uma venda completa
□ Sabe criar uma OS completa
□ Sabe resolver 90% dos problemas comuns
□ Sabe quando escalar para técnico
□ Tem acesso a documentação completa
□ Assistiu todos os vídeos tutoriais
```

---

## 🚨 QUANDO ESCALAR PARA TÉCNICO

### **Escalar quando:**

```
□ Problema de código (bug)
□ Erro de banco de dados
□ Sistema completamente parado
□ Perda de dados
□ Problema de segurança
□ Solicitação de customização
□ Integração com terceiros
```

---

## 💡 DICAS PARA SUPORTE EFICAZ

### **Boas Práticas:**

✅ **Seja educado e empático**  
✅ **Ouça antes de falar**  
✅ **Use linguagem simples**  
✅ **Confirme se resolveu**  
✅ **Documente tudo**  
✅ **Aprenda com cada chamado**  

### **Evite:**

❌ **Culpar o cliente**  
❌ **Usar termos técnicos demais**  
❌ **Prometer o que não pode cumprir**  
❌ **Demorar para responder**  
❌ **Ficar na defensiva**  

---

## 📞 CANAIS DE SUPORTE

### **WhatsApp:**
- Resposta rápida
- Ideal para problemas simples
- Pode enviar screenshots

### **Email:**
- Documentação formal
- Ideal para solicitações complexas
- Histórico registrado

### **Telefone:**
- Urgências
- Explicações detalhadas
- Cliente sem familiaridade digital

### **Remoto (TeamViewer/AnyDesk):**
- Problemas complexos
- Treinamento adicional
- Configuração avançada

---

## ✅ CHECKLIST DE FECHAMENTO

```
□ Problema resolvido
□ Cliente confirmou que funciona
□ Solução documentada
□ Chamado registrado
□ Satisfação anotada
□ Follow-up agendado (se necessário)
```

---

**🛠️ GUIA DE SUPORTE TÉCNICO - PDV SMART TECH**  
**Versão:** 1.0.0  
**Última atualização:** Janeiro 2026

**💪 Suporte de qualidade = Clientes satisfeitos!**

© 2026 - Todos os direitos reservados.
