# 📱 Resumo: Como Testar no Mobile

## 🚀 Início Rápido

### 1. Iniciar Servidor para Mobile

```bash
npm run dev:mobile
```

Isso inicia o servidor com `--host`, permitindo acesso via IP local.

### 2. Descobrir IP do Computador

**Windows:**
```powershell
ipconfig
# Procurar "IPv4 Address" (ex: 192.168.1.100)
```

**Linux/Mac:**
```bash
ifconfig
# ou
ip addr show
```

### 3. Acessar no Mobile

No navegador do celular, acessar:
```
http://SEU_IP:5173
```

Exemplo: `http://192.168.1.100:5173`

---

## ✅ Teste Básico (5 minutos)

1. **Abrir `/login`**
2. **Fazer login:**
   - Email: `admin@smarttech.com`
   - Senha: `admin123`
3. **Verificar:**
   - ✅ Redireciona para `/painel`
   - ✅ Não redireciona de volta para `/login`
4. **Navegar:**
   - Acessar `/clientes`
   - Acessar `/vendas`
   - Acessar `/produtos`
5. **Recarregar página:**
   - ✅ Permanece logado

---

## 🔍 Verificar Console (Opcional)

### Chrome DevTools Remote Debugging:

1. Conectar dispositivo via USB
2. Habilitar "Depuração USB" no Android
3. Chrome Desktop → `chrome://inspect`
4. Selecionar dispositivo
5. Verificar logs de `[Auth]` e `[LoginPage]`

---

## 📋 Checklist Rápido

- [ ] Servidor inicia com `npm run dev:mobile`
- [ ] Consegue acessar no mobile via IP
- [ ] Página de login carrega
- [ ] Login funciona
- [ ] Redireciona para `/painel` após login
- [ ] Consegue navegar entre rotas
- [ ] Sessão persiste após reload

---

## 🐛 Problemas Comuns

### Não consegue acessar no mobile:
- ✅ Verificar se está na mesma rede WiFi
- ✅ Verificar firewall do Windows
- ✅ Usar `npm run dev:mobile` (já tem `--host`)

### Web Crypto API não disponível:
- ⚠️ Acessar via `localhost` ou usar HTTPS
- ⚠️ IP local pode não funcionar (limitação do navegador)

### Sessão não persiste:
- ✅ Verificar console para erros
- ✅ Verificar se localStorage está habilitado

---

## 📝 Notas

- **Script:** `npm run dev:mobile` já inclui `--host`
- **Porta:** Padrão é `5173` (Vite)
- **Logs:** Apenas em modo DEV
- **Cache:** Sessão tem cache de 1 segundo

---

**Pronto para testar! 🎉**
