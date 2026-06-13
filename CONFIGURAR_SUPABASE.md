# 🔧 Configurar Supabase

## ✅ Informações do Token

Do token JWT fornecido, extraímos:
- **Projeto ID:** `kcygzjfeafpsvbytpeso`
- **Role:** `anon` (chave pública - segura para frontend)
- **URL do Supabase:** `https://kcygzjfeafpsvbytpeso.supabase.co`

---

## 📝 Configuração do `.env.local`

Crie ou edite o arquivo `.env.local` na raiz do projeto com:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx
```

**⚠️ IMPORTANTE:** Substitua pelos valores reais do seu projeto Supabase (Dashboard → Settings → API).

---

## ⚠️ Importante

1. **Nunca commite o `.env.local` no Git**
   - O arquivo já deve estar no `.gitignore`
   - Contém informações sensíveis

2. **Service Role Key (sb_secret_...)**
   - ⚠️ **NÃO** use no frontend
   - Use apenas em backends seguros
   - Se você tem uma, mantenha-a segura

3. **Anon Key (eyJ...)** ✅
   - Esta é a chave correta para o frontend
   - Respeita RLS (Row Level Security)
   - Pode ser exposta no frontend (é pública)

---

## 🚀 Próximos Passos

1. **Criar `.env.local`** com as variáveis acima
2. **Executar SQL** `sql_completo_schema_rls.sql` no Supabase
3. **Reiniciar o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
4. **Testar sincronização** em `/sync-status`

---

## ✅ Verificar Configuração

Após configurar, você pode verificar se está funcionando:

1. Abra o console do navegador (F12)
2. Procure por: `[SyncEngine] Iniciado`
3. Acesse `/supabase-test` para testar conexão
4. Acesse `/sync-status` para ver status de sincronização

---

## 🐛 Problemas Comuns

### **"Supabase não configurado"**
- Verifique se `.env.local` existe na raiz do projeto
- Verifique se as variáveis começam com `VITE_`
- Reinicie o servidor após criar/editar `.env.local`

### **"Erro de conexão"**
- Verifique se a URL está correta
- Verifique se o projeto Supabase está ativo
- Verifique se as tabelas foram criadas (execute o SQL)

### **"Permission denied"**
- Execute o SQL `sql_completo_schema_rls.sql`
- Verifique se RLS está desabilitado ou políticas criadas

---

**Status:** ✅ **Configuração pronta!**
