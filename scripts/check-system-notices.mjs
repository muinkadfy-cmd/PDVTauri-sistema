import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    failures.push(`Arquivo ausente: ${rel}`);
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

function expectIncludes(rel, content, tokens) {
  for (const token of tokens) {
    if (!content.includes(token)) {
      failures.push(`${rel}: token obrigatório ausente: ${token}`);
    }
  }
}

const systemNotices = read('src/lib/system-notices.ts');
expectIncludes('src/lib/system-notices.ts', systemNotices, [
  "type SystemNoticeType = 'alert' | 'notification' | 'message'",
  "type SystemNoticeStatus = 'unread' | 'read' | 'resolved'",
  'getSystemNotices',
  'getUnreadNoticeCount',
  'getAlertCount',
  'markNoticeRead',
  'markNoticesReadBySource',
  'markNoticesReadByRoute',
  'resolveNotice',
  'syncSystemNoticesFromRuntime',
  'onSystemNoticesChange',
  'kvSet(DESKTOP_KV_KEY',
  'safeSet(STORAGE_KEY',
]);

const topbar = read('src/components/layout/Topbar.tsx');
expectIncludes('src/components/layout/Topbar.tsx', topbar, [
  'const topbarAlertCount = attention.importantCount',
  'const topbarNotificationCount = attention.unreadNotificationCount',
  'mode="alerts"',
  'mode="notifications"',
  'mode="messages"',
]);
if (topbar.includes('attention.unreadNotificationCount + attention.totalCount')) {
  failures.push('src/components/layout/Topbar.tsx: sino ainda mistura notificações com pendências reais.');
}

const panel = read('src/components/layout/TopbarAlertsPanel.tsx');
expectIncludes('src/components/layout/TopbarAlertsPanel.tsx', panel, [
  'getSystemNotices',
  'markAllCommonNoticesRead',
  'markNoticeRead',
  'markNoticesReadByRoute',
  'resolveWhen',
  "mode === 'notifications'",
]);
if (panel.includes('NotificationsDropdown')) {
  failures.push('src/components/layout/TopbarAlertsPanel.tsx: componente legado NotificationsDropdown foi religado.');
}

const attention = read('src/lib/attention-center.ts');
expectIncludes('src/lib/attention-center.ts', attention, [
  'getUnreadNoticeCount',
  'mergeUnreadNoticeRoutes',
  'SYSTEM_NOTICES_CHANGED_EVENT',
]);

const sidebar = read('src/components/layout/Sidebar.tsx');
expectIncludes('src/components/layout/Sidebar.tsx', sidebar, [
  'attention.byPath[item.path]',
  'sidebar-attention-badge',
]);

const layout = read('src/app/Layout.tsx');
expectIncludes('src/app/Layout.tsx', layout, [
  'markNoticesReadByRoute',
  'markNoticesReadByRoute(location.pathname)',
]);

const produtos = read('src/pages/ProdutosPage.tsx');
expectIncludes('src/pages/ProdutosPage.tsx', produtos, [
  'photoPreview',
  'openProductPhotoPreview',
  'produto-photo-preview-modal',
  'aria-label={`Abrir foto de ${produto.nome}`}',
]);

if (failures.length) {
  console.error('[check-system-notices] FALHOU');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[check-system-notices] OK: notificações, badges e preview de produtos possuem os contratos estruturais esperados.');
