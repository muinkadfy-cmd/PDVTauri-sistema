import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import RouteError from '@/components/ui/RouteError';
import { isUpdateEnabled } from '@/lib/mode';
import { isDesktopApp } from '@/lib/platform';
import Layout from './Layout';
import PainelPage from '@/pages/Painel/PainelPage';
import ClientesPage from '@/pages/ClientesPage';
import VendasPage from '@/pages/VendasPage';
import ProdutosPage from '@/pages/ProdutosPage';
import OrdensPage from '@/pages/OrdensPage';
import SimularTaxasPage from '@/pages/SimularTaxasPage';
import AjudaPage from '@/pages/AjudaPage';
import SelfTestPage from '@/pages/SelfTestPage';
import AutoAjudaPage from '@/pages/AutoAjudaPage';
import FinanceiroPage from '@/pages/FinanceiroPage';
import RelatoriosPage from '@/pages/RelatoriosPage';
import FluxoCaixaPage from '@/pages/FluxoCaixaPage';
import DevolucaoPage from '@/pages/DevolucaoPage';
import CobrancasPage from '@/pages/CobrancasPage';
import ReciboPage from '@/pages/ReciboPage';
import EstoquePage from '@/pages/EstoquePage';
import EncomendasPage from '@/pages/EncomendasPage';
import FornecedoresPage from '@/pages/FornecedoresPage';
import CodigosPage from '@/pages/CodigosPage';
import BackupPage from '@/pages/BackupPage';
import AtualizacoesPage from '@/pages/AtualizacoesPage';
import ImeiPage from '@/pages/ImeiPage';
import ConfiguracoesPage from '@/pages/ConfiguracoesPage';
import ConfiguracoesTermosGarantiaPage from '@/pages/ConfiguracoesTermosGarantiaPage';
import LicencaMensalPage from '@/pages/LicencaMensalPage';
import LoginPage from '@/pages/LoginPage';
import UsuariosPage from '@/pages/UsuariosPage';
import CompraUsadosPage from '@/pages/CompraUsadosPage';
import VendaUsadosPage from '@/pages/VendaUsadosPage';

// ✅ P0 (Pré-login): páginas raras (feature desativada) não entram no bundle inicial.
const DisabledFeaturePage = lazy(() => import('@/pages/DisabledFeaturePage'));

// P11: fallback nulo para eliminar renderização falsa/skeleton nas rotas.
const RouteFallback = null;
const isDesktopBuild = import.meta.env.MODE === 'desktop';

function desktopOfflineDisabled(title: string, description?: string) {
  return (
    <DisabledFeaturePage
      title={title}
      description={description || 'Este recurso pertence ao modo online/Supabase e fica bloqueado no Desktop 100% offline para evitar troca de loja, sync remoto ou dependência de internet.'}
    />
  );
}

// Telas raras/dev continuam lazy; abas principais são diretas para navegação desktop instantânea.
const SystemTestPage = lazy(() => import('@/pages/SystemTestPage'));
const DiagnosticoDadosPage = lazy(() => import('@/pages/DiagnosticoDadosPage'));
const ProdutosDiagnosticoPage = lazy(() => import('@/pages/ProdutosDiagnosticoPage'));
const AuditPage = lazy(() => import('@/pages/AuditPage'));
const SetupPage = lazy(() => import('@/pages/SetupPage'));
const CadastroLojaPage = lazy(() => import('@/pages/CadastroLojaPage'));
const WizardPage = lazy(() => import('@/pages/WizardPage'));
const ResetSenhaPage = lazy(() => import('@/pages/ResetSenhaPage'));
const ConfigurarLojaPage = lazy(() => import('@/pages/ConfigurarLojaPage'));
const ActivationPage = isDesktopBuild ? null : lazy(() => import('@/pages/ActivationPage'));
const BuyPage = isDesktopBuild ? null : lazy(() => import('@/pages/BuyPage'));
const LicensePage = isDesktopBuild ? null : lazy(() => import('@/pages/LicensePage'));
const LojasPage = isDesktopBuild ? null : lazy(() => import('@/pages/LojasPage'));
const StoreAccessPage = isDesktopBuild ? null : lazy(() => import('@/pages/StoreAccessPage'));
const StoreRedirectPage = isDesktopBuild ? null : lazy(() => import('@/pages/StoreRedirectPage'));
const SupabaseTestPage = isDesktopBuild ? null : lazy(() => import('@/pages/SupabaseTestPage'));
const SyncStatusPage = isDesktopBuild ? null : lazy(() => import('@/pages/SyncStatusPage'));
const DiagnosticoSyncPage = isDesktopBuild ? null : lazy(() => import('@/pages/DiagnosticoSyncPage'));
const PrintReceiptPage = lazy(() => import('@/pages/print/PrintReceiptPage'));
const HealthRoutesPage = lazy(() => import('@/pages/HealthRoutesPage'));
const DiagnosticoPage = lazy(() => import('@/pages/DiagnosticoPage'));
const DiagnosticoRotasPage = lazy(() => import('@/pages/DiagnosticoRotasPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

export const router = createBrowserRouter([
  {
    path: '/setup',
    element: (
      <Suspense fallback={RouteFallback}>
        <SetupPage />
      </Suspense>
    ),
  },
  {
    path: '/login',
    element: (
      <Suspense fallback={RouteFallback}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/cadastro',
    element: (
      <Suspense fallback={RouteFallback}>
        <CadastroLojaPage />
      </Suspense>
    ),
  },
  {
    path: '/s/:storeId',
    element: (
      <Suspense fallback={RouteFallback}>
        {isDesktopApp() || !StoreRedirectPage
          ? desktopOfflineDisabled('Link de loja online desativado', 'No Desktop offline, a loja é fixa por instalação. Links antigos /s/:storeId não podem trocar o banco local.')
          : <StoreRedirectPage />}
      </Suspense>
    ),
  },
  {
    path: '/comprar',
    element: (
      <Suspense fallback={RouteFallback}>
        {isDesktopApp() || !BuyPage
          ? desktopOfflineDisabled('Compra/licença desativada', 'Este Desktop é offline e sem licença obrigatória. Use Atualizar sistema para versões novas.')
          : <BuyPage />}
      </Suspense>
    ),
  },
  {
    path: '/ativacao',
    element: (
      <Suspense fallback={RouteFallback}>
        {isDesktopApp() || !ActivationPage
          ? desktopOfflineDisabled('Ativação desativada', 'Este Desktop é offline, sem Supabase e sem licença obrigatória.')
          : <ActivationPage />}
      </Suspense>
    ),
  },
  {
    path: '/wizard',
    element: (
      <Suspense fallback={RouteFallback}>
        <WizardPage />
      </Suspense>
    ),
  },
  {
    path: '/reset-senha',
    element: (
      <Suspense fallback={RouteFallback}>
        {isDesktopApp()
          ? desktopOfflineDisabled('Redefinição online desativada', 'No Desktop offline, a senha local deve ser redefinida por um administrador em Configurações > Usuários. Se perdeu o acesso admin, use a rotina de suporte/restauração local.')
          : <ResetSenhaPage />}
      </Suspense>
    ),
  },

  {
    path: '/print/:docType/:id',
    element: (
      <Suspense fallback={RouteFallback}>
        <PrintReceiptPage />
      </Suspense>
    ),
  },
  {
    path: '/configurar-loja',
    element: (
      <Suspense fallback={RouteFallback}>
        <ConfigurarLojaPage />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: (
      <Suspense fallback={RouteFallback}>
        <Layout />
      </Suspense>
    ),
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <Navigate to="/login" replace />,
      },
      {
        path: 'painel',
        element: <PainelPage />,
      },
      {
        path: 'clientes',
        element: <ClientesPage />,
      },
      {
        path: 'vendas',
        element: <VendasPage />,
      },
      {
        path: 'produtos',
        element: <ProdutosPage />,
      },
      {
        path: 'ordens',
        element: <OrdensPage />,
      },
      {
        path: 'simular-taxas',
        element: <SimularTaxasPage />,
      },
      {
        path: 'autoajuda',
        element: <AutoAjudaPage />,
      },
      {
        path: 'ajuda',
        element: <AjudaPage />,
      },
      {
        path: 'auto-teste',
        element: <SelfTestPage />,
      },
      {
        path: 'financeiro',
        element: <FinanceiroPage />,
      },
      {
        path: 'relatorios',
        element: <RelatoriosPage />,
      },
      {
        path: 'fluxo-caixa',
        element: <FluxoCaixaPage />,
      },
      {
        path: 'devolucao',
        element: <DevolucaoPage />,
      },
      {
        path: 'cobrancas',
        element: <CobrancasPage />,
      },
      {
        path: 'recibo',
        element: <ReciboPage />,
      },
      {
        path: 'estoque',
        element: <EstoquePage />,
      },
      {
        path: 'encomendas',
        element: <EncomendasPage />,
      },
      {
        path: 'fornecedores',
        element: <FornecedoresPage />,
      },
      {
        path: 'codigos',
        element: <CodigosPage />,
      },
      {
        path: 'backup',
        element: <BackupPage />,
      },
      {
        path: 'atualizacoes',
        element: isUpdateEnabled() ? <AtualizacoesPage /> : <DisabledFeaturePage title="Atualizações desativadas" />,
      },
      {
        path: 'imei',
        element: <ImeiPage />,
      },
      {
        path: 'configuracoes',
        element: <ConfiguracoesPage />,
      },
      {
        path: 'configuracoes-termos-garantia',
        element: <ConfiguracoesTermosGarantiaPage />,
      },
      {
        // Compat: link antigo (evita 404)
        path: 'configuracoes/termos-garantia',
        element: <Navigate to="/configuracoes-termos-garantia" replace />,
      },
      {
        path: 'usuarios',
        element: <UsuariosPage />,
      },
      {
        path: 'licenca',
        element: <LicencaMensalPage />,
      },
      {
        path: 'lojas',
        element: (
          <Suspense fallback={RouteFallback}>
            {isDesktopApp() || !LojasPage
              ? desktopOfflineDisabled('Multi-loja online desativado', 'Este Desktop usa uma loja única fixa por PC. O painel de lojas é legado do modo Web/Supabase e fica bloqueado para não abrir outro banco local.')
              : <LojasPage />}
          </Suspense>
        ),
      },
      {
        path: 'permissoes-loja',
        element: (
          <Suspense fallback={RouteFallback}>
            {isDesktopApp() || !StoreAccessPage
              ? desktopOfflineDisabled('Permissões de loja online desativadas', 'No Desktop offline, permissões remotas por loja/Supabase não são carregadas. Use Configurações > Usuários para usuários locais.')
              : <StoreAccessPage />}
          </Suspense>
        )
      },
      {
        path: 'compra-usados',
        element: <CompraUsadosPage />,
      },
      {
        path: 'venda-usados',
        element: <VendaUsadosPage />,
      },
      {
        path: 'supabase-test',
        element: (
          <Suspense fallback={RouteFallback}>
            {isDesktopApp() || !SupabaseTestPage
              ? desktopOfflineDisabled('Supabase desativado no Desktop', 'O produto Desktop oficial trabalha 100% local com SQLite. Testes de Supabase ficam somente para a versão Web/PWA futura.')
              : <SupabaseTestPage />}
          </Suspense>
        )
      },
      {
        path: 'sync-status',
        element: (
          <Suspense fallback={RouteFallback}>
            {isDesktopApp() || !SyncStatusPage
              ? desktopOfflineDisabled('Sincronização remota desativada', 'No Desktop offline, não há fila de envio para Supabase. Os dados oficiais ficam no SQLite local e no backup.')
              : <SyncStatusPage />}
          </Suspense>
        )
      },
      // Rotas de desenvolvimento apenas em dev
      ...(import.meta.env.DEV ? [
        {
          path: 'testes',
          element: <SystemTestPage />,
        },
        {
          path: 'diagnostico-dados',
          element: <DiagnosticoDadosPage />,
        },
        {
          path: 'produtos-diagnostico',
          element: <ProdutosDiagnosticoPage />,
        },
        {
          path: 'audit',
          element: <AuditPage />,
        },
        {
          path: 'health-routes',
          element: <HealthRoutesPage />,
        },
        {
          path: 'diagnostico',
          element: <DiagnosticoPage />,
        },
        {
          path: 'diagnostico-rotas',
          element: <DiagnosticoRotasPage />,
        },
        {
          path: 'diagnostico-sync',
          element: isDesktopApp() || !DiagnosticoSyncPage
            ? desktopOfflineDisabled('Diagnóstico de sync remoto desativado', 'Este diagnóstico é apenas para Supabase/Web. No Desktop offline, use Diagnóstico de Dados, Backup e logs locais.')
            : <DiagnosticoSyncPage />,
        }
      ] : []),
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
