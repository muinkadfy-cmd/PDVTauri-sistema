/**
 * HELPERS PARA TESTE DO BLOCO 1 — Auth/Login/Guards
 * 
 * Cole estes comandos no Console do navegador (DevTools) para simular cenários de teste.
 */

// ========================================
// TESTE 2: Limpar sessão e localStorage
// ========================================
function limparSessao() {
  localStorage.clear();
  sessionStorage.clear();
  console.log('✅ Sessão limpa. Recarregue a página (F5) para testar redirect.');
}

// ========================================
// TESTE 3: Forçar expiração da sessão
// ========================================
function expirarSessao() {
  try {
    const session = JSON.parse(localStorage.getItem('smart-tech:session'));
    if (!session) {
      console.error('❌ Nenhuma sessão encontrada. Faça login primeiro.');
      return;
    }
    
    // Expirar há 1 segundo atrás
    session.expiresAt = new Date(Date.now() - 1000).toISOString();
    localStorage.setItem('smart-tech:session', JSON.stringify(session));
    
    console.log('✅ Sessão expirada forçadamente:', session.expiresAt);
    console.log('🔄 Navegue para qualquer rota (ex: /vendas) para testar.');
  } catch (e) {
    console.error('❌ Erro ao expirar sessão:', e);
  }
}

// ========================================
// TESTE 4: Trocar store_id (simular troca de loja)
// ========================================
function trocarStoreId(novoStoreId = '00000000-0000-0000-0000-000000000000') {
  try {
    const url = new URL(window.location);
    url.searchParams.set('store', novoStoreId);
    window.history.pushState({}, '', url);
    
    console.log('✅ Store_id trocado para:', novoStoreId);
    console.log('🔄 Recarregue a página (F5) para testar.');
  } catch (e) {
    console.error('❌ Erro ao trocar store_id:', e);
  }
}

// ========================================
// VERIFICAR: Estado atual da sessão
// ========================================
function verificarSessao() {
  try {
    const sessionKey = 'smart-tech:session';
    const session = JSON.parse(localStorage.getItem(sessionKey));
    
    if (!session) {
      console.log('❌ Nenhuma sessão ativa.');
      return;
    }
    
    console.log('📊 Sessão atual:');
    console.table({
      userId: session.userId,
      username: session.username,
      role: session.role,
      storeId: session.storeId,
      expiresAt: session.expiresAt,
      expirado: new Date(session.expiresAt) < new Date() ? '❌ SIM' : '✅ NÃO'
    });
    
    const storeIdUrl = new URL(window.location).searchParams.get('store');
    const storeIdEnv = localStorage.getItem('smart-tech:store-id');
    
    console.log('\n📍 Store IDs:');
    console.table({
      'URL (?store)': storeIdUrl || '(vazio)',
      'localStorage': storeIdEnv || '(vazio)',
      'Sessão': session.storeId,
      'Compatível': storeIdUrl === session.storeId || storeIdEnv === session.storeId ? '✅ SIM' : '❌ NÃO'
    });
  } catch (e) {
    console.error('❌ Erro ao verificar sessão:', e);
  }
}

// ========================================
// MONITORAR: Detectar loops de re-render
// ========================================
let renderCount = 0;
let renderTimer = null;

function monitorarReRenders() {
  console.log('🔍 Monitorando re-renders do AuthGuard...');
  console.log('⏱️ Aguarde 5 segundos. Se o contador subir muito rápido (>50), há loop.');
  
  renderCount = 0;
  
  // Interceptar console.log/error para contar
  const originalLog = console.log;
  const originalError = console.error;
  
  console.log = function(...args) {
    if (args[0]?.includes?.('[AuthGuard]')) {
      renderCount++;
    }
    originalLog.apply(console, args);
  };
  
  console.error = function(...args) {
    if (args[0]?.includes?.('[AuthGuard]')) {
      renderCount++;
    }
    originalError.apply(console, args);
  };
  
  renderTimer = setTimeout(() => {
    console.log = originalLog;
    console.error = originalError;
    
    console.log('\n📊 Resultado do monitoramento (5 segundos):');
    if (renderCount === 0) {
      console.log('✅ Nenhum log de AuthGuard detectado (normal).');
    } else if (renderCount <= 5) {
      console.log(`✅ ${renderCount} logs de AuthGuard (normal - poucos re-renders).`);
    } else if (renderCount <= 20) {
      console.log(`⚠️ ${renderCount} logs de AuthGuard (suspeito - muitos re-renders).`);
    } else {
      console.log(`❌ ${renderCount} logs de AuthGuard (LOOP INFINITO detectado!).`);
    }
  }, 5000);
}

// ========================================
// TESTAR: Navegação sequencial
// ========================================
async function testarNavegacao() {
  const rotas = ['/painel', '/vendas', '/clientes', '/produtos', '/painel'];
  console.log('🔄 Testando navegação sequencial:', rotas);
  
  for (const rota of rotas) {
    console.log(`➡️ Navegando para ${rota}...`);
    window.history.pushState({}, '', rota);
    
    // Disparar evento de navegação do React Router
    window.dispatchEvent(new PopStateEvent('popstate'));
    
    // Aguardar 500ms entre navegações
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('✅ Navegação concluída. Verifique se todas as rotas carregaram sem travar.');
}

// ========================================
// RESUMO: Comandos disponíveis
// ========================================
console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🧪 HELPERS DE TESTE — BLOCO 1 (Auth/Login/Guards)         ║
╚══════════════════════════════════════════════════════════════╝

Cole no console do navegador:

1️⃣  limparSessao()          — Limpar localStorage e testar redirect
2️⃣  expirarSessao()         — Forçar expiração da sessão
3️⃣  trocarStoreId()         — Simular troca de loja
4️⃣  verificarSessao()       — Ver estado atual da sessão
5️⃣  monitorarReRenders()    — Detectar loops de re-render (5s)
6️⃣  testarNavegacao()       — Navegar entre rotas automaticamente

Exemplo:
> verificarSessao()
> expirarSessao()
> monitorarReRenders()
`);
