# 🧪 Script Rápido: Teste Mobile

## Iniciar Servidor com Host Público

```bash
# Windows PowerShell
npm run dev -- --host

# Ou modificar package.json para adicionar script:
# "dev:mobile": "vite --host"
```

## Acessar no Mobile

1. Descobrir IP do computador:
   ```bash
   # Windows
   ipconfig
   # Procurar por "IPv4 Address" (ex: 192.168.1.100)
   
   # Linux/Mac
   ifconfig
   # ou
   ip addr show
   ```

2. No mobile, acessar:
   ```
   http://SEU_IP:5173
   ```
   Exemplo: `http://192.168.1.100:5173`

## Teste Rápido

1. Abrir `/login`
2. Login: `admin@smarttech.com` / `admin123`
3. Verificar redirect para `/painel`
4. Navegar para `/clientes`, `/vendas`, `/produtos`
5. Recarregar página (F5)
6. Verificar se permanece logado

## Verificar Console (Chrome DevTools)

1. Conectar dispositivo via USB
2. Chrome → `chrome://inspect`
3. Selecionar dispositivo
4. Abrir DevTools
5. Verificar logs de `[Auth]` e `[LoginPage]`
