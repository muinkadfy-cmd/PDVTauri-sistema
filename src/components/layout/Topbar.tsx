import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppIcon } from '@/components/ui/AppIcon';
import { getCurrentUser } from '@/lib/auth-supabase';
import { isDesktopApp } from '@/lib/platform';
import { useAttentionCenter } from '@/hooks/useAttentionCenter';
import ProfileDropdown from './ProfileDropdown';
import TopbarAlertsPanel, { type TopbarPanelMode } from './TopbarAlertsPanel';
import './Topbar.css';

type RouteContext = {
  section: string;
  hint: string;
};

function getRouteContext(pathname: string): RouteContext {
  if (pathname.startsWith('/vendas')) return { section: 'Vendas', hint: 'Venda rápida e histórico' };
  if (pathname.startsWith('/clientes')) return { section: 'Clientes', hint: 'Cadastro e busca de clientes' };
  if (pathname.startsWith('/produtos')) return { section: 'Produtos', hint: 'Catálogo e estoque' };
  if (pathname.startsWith('/ordens')) return { section: 'Ordem de Serviço', hint: 'Atendimento técnico' };
  if (pathname.startsWith('/compra-usados')) return { section: 'Compra de usados', hint: 'Entrada e documentos' };
  if (pathname.startsWith('/venda-usados')) return { section: 'Venda de usados', hint: 'Garantia e histórico' };
  if (pathname.startsWith('/painel')) return { section: 'Painel', hint: 'Visão geral do sistema' };
  if (pathname.startsWith('/financeiro')) return { section: 'Financeiro', hint: 'Receitas e despesas' };
  if (pathname.startsWith('/fluxo-caixa')) return { section: 'Fluxo de Caixa', hint: 'Entradas, saídas e saldo' };
  if (pathname.startsWith('/cobrancas')) return { section: 'Cobranças', hint: 'Recebimentos e vencimentos' };
  if (pathname.startsWith('/encomendas')) return { section: 'Encomendas', hint: 'Pedidos e acompanhamento' };
  if (pathname.startsWith('/recibo')) return { section: 'Recibo', hint: 'Comprovantes rápidos' };
  if (pathname.startsWith('/devolucao')) return { section: 'Devolução', hint: 'Estorno e conferência' };
  if (pathname.startsWith('/fornecedores')) return { section: 'Fornecedores', hint: 'Contatos e compras' };
  if (pathname.startsWith('/configuracoes')) return { section: 'Configurações', hint: 'Empresa, impressão e preferências' };
  if (pathname.startsWith('/backup')) return { section: 'Backup', hint: 'Segurança dos dados locais' };
  if (pathname.startsWith('/atualizacoes')) return { section: 'Atualizar sistema', hint: 'Versão e atualização online/manual' };
  if (pathname.startsWith('/ajuda')) return { section: 'Ajuda', hint: 'Suporte e atalhos' };
  if (pathname.startsWith('/codigos')) return { section: 'Códigos', hint: 'Referência técnica rápida' };
  return { section: 'Smart Tech PDV', hint: 'Sistema local/offline' };
}

interface TopbarProps {
  onMenuToggle?: () => void;
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" {...props}>
      <path d="M6.5 9.5a5.5 5.5 0 1 1 11 0v3.1l1.5 2.4v1H5v-1l1.5-2.4V9.5Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" {...props}>
      <path d="M12 3 3.8 18.5h16.4L12 3Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M12 9v4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M12 16.2h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function MessageIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" {...props}>
      <path d="M4 6.5h16v10H8l-4 3v-13Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M8 10h8M8 13h5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function TopbarQuickButton({
  mode,
  title,
  icon,
  badge = 0,
  tone = 'neutral',
  active = false,
  onToggle,
}: {
  mode: TopbarPanelMode;
  title: string;
  icon: React.ReactNode;
  badge?: number;
  tone?: 'neutral' | 'warn';
  active?: boolean;
  onToggle: (mode: TopbarPanelMode) => void;
}) {
  return (
    <button
      type="button"
      className={`topbar-quick-button topbar-quick-button--${tone} ${active ? 'topbar-quick-button--active' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={() => onToggle(mode)}
    >
      <span className="topbar-quick-button__icon" aria-hidden="true">{icon}</span>
      {badge > 0 ? <span className="topbar-quick-button__badge">{badge > 9 ? '9+' : badge}</span> : null}
    </button>
  );
}

function ClockPill() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // P9: minuto é suficiente para PDV e evita re-render a cada segundo.
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const time = useMemo(() => {
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }, [now]);

  const date = useMemo(() => {
    const d = now.getDate().toString().padStart(2, '0');
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const y = now.getFullYear();
    return `${d}/${m}/${y}`;
  }, [now]);

  return (
    <div className="topbar-clock topbar-clock--compact" title="Horário do sistema">
      <ClockIcon className="topbar-clock-icon" />
      <div className="clock-time">{time}</div>
      <div className="clock-date">{date}</div>
    </div>
  );
}

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const topbarRef = useRef<HTMLElement | null>(null);
  const currentSession = useMemo(() => getCurrentUser(), []);
  const desktopApp = useMemo(() => isDesktopApp(), []);
  const routeContext = useMemo(() => getRouteContext(location.pathname), [location.pathname]);
  const attention = useAttentionCenter();

  const topbarAlertCount = attention.importantCount;
  const topbarNotificationCount = attention.unreadNotificationCount;

  const userInitials = useMemo(() => {
    const label = String(currentSession?.nome || currentSession?.email || currentSession?.cargo || 'A').trim();
    const parts = label.split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part[0]).join('').toUpperCase() || 'A';
  }, [currentSession]);

  const [perfilOpen, setPerfilOpen] = useState(false);
  const [alertsPanelMode, setAlertsPanelMode] = useState<TopbarPanelMode | null>(null);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 901);
  const [logoOk, setLogoOk] = useState(true);

  const toggleTopbarPanel = (mode: TopbarPanelMode) => {
    setPerfilOpen(false);
    setAlertsPanelMode((current) => (current === mode ? null : mode));
  };

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 901);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const el = topbarRef.current;
    if (!el) return;

    const setVar = () => {
      const h = el.offsetHeight || 56;
      document.documentElement.style.setProperty('--topbar-height', `${h}px`);
    };

    requestAnimationFrame(setVar);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => setVar());
      ro.observe(el);
    }

    window.addEventListener('resize', setVar);
    return () => {
      window.removeEventListener('resize', setVar);
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = topbarRef.current;
    if (!el) return;
    const onScroll = () => el.classList.toggle('scrolled', (window.scrollY || 0) > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll as any);
  }, []);

  useEffect(() => {
    if (location.pathname === '/') navigate('/painel', { replace: true });
  }, [location.pathname, navigate]);

  useEffect(() => {
    setAlertsPanelMode(null);
  }, [location.pathname]);

  return (
    <header ref={topbarRef as any} className="topbar topbar-saas topbar-compact-offline">
      <div className="topbar-left topbar-left-saas">
        {!isDesktop && (
          <button className="menu-toggle" onClick={onMenuToggle} aria-label="Abrir menu">
            <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>☰</span>
          </button>
        )}

        <Link className="topbar-brand topbar-home-button" to="/painel" title="Ir para o painel" aria-label="Ir para o painel">
          <span className="logo-mark" aria-hidden="true">
            {logoOk ? (
              <img
                className="logo-image"
                src="/icons/icon-192.png"
                alt=""
                draggable={false}
                decoding="async"
                onError={() => setLogoOk(false)}
              />
            ) : (
              <span className="logo-fallback">ST</span>
            )}
          </span>
          <span className="topbar-brand-copy">
            <strong>SMART TECH PDV</strong>
            <span>Sistema de Gestão Comercial</span>
          </span>
        </Link>

        {isDesktop ? (
          <div className="topbar-mode-tabs" aria-label="Atalhos do sistema">
            <Link className="topbar-mode-tab topbar-mode-tab--active" to="/painel">
              <AppIcon name="dashboard" size={18} />
              <span>PAINEL</span>
            </Link>
            <span className="topbar-mode-tab">
              <AppIcon name="backup" size={18} />
              <span>{desktopApp ? 'OFFLINE' : 'ONLINE'}</span>
            </span>
          </div>
        ) : null}

        <div className="topbar-page-context" aria-label="Contexto da tela">
          <div className="topbar-page-row">
            <AppIcon name="settings" size={18} className="topbar-context-icon" />
            <span className="topbar-page-chip">{routeContext.hint}</span>
          </div>
          <div className="topbar-page-hint" title={routeContext.section}>{routeContext.section}</div>
        </div>
      </div>

      <div className="topbar-right topbar-right-saas topbar-right-compact">
        <TopbarQuickButton
          mode="alerts"
          title={topbarAlertCount > 0 ? `${topbarAlertCount} alerta(s) precisam de atenção` : 'Alertas do sistema'}
          icon={<AlertIcon />}
          badge={topbarAlertCount}
          tone={topbarAlertCount > 0 ? 'warn' : 'neutral'}
          active={alertsPanelMode === 'alerts'}
          onToggle={toggleTopbarPanel}
        />
        <TopbarQuickButton
          mode="notifications"
          title={topbarNotificationCount > 0 ? `${topbarNotificationCount} notificação(ões) não lida(s)` : 'Notificações e atualizações do sistema'}
          icon={<BellIcon />}
          badge={topbarNotificationCount}
          tone={topbarNotificationCount > 0 ? 'warn' : 'neutral'}
          active={alertsPanelMode === 'notifications'}
          onToggle={toggleTopbarPanel}
        />
        <TopbarQuickButton
          mode="messages"
          title="Mensagens e ajuda rápida"
          icon={<MessageIcon />}
          active={alertsPanelMode === 'messages'}
          onToggle={toggleTopbarPanel}
        />
        <TopbarAlertsPanel
          open={alertsPanelMode !== null}
          mode={alertsPanelMode || 'alerts'}
          onClose={() => setAlertsPanelMode(null)}
        />
        <ClockPill />
        <div className="profile-wrapper">
          <button
            type="button"
            className="avatar-button"
            onClick={() => setPerfilOpen((open) => !open)}
            title="Conta, sessão e logout"
            aria-label="Abrir menu da conta"
            aria-expanded={perfilOpen}
          >
            <span className="avatar-initials">{userInitials}</span>
          </button>
          <ProfileDropdown isOpen={perfilOpen} onClose={() => setPerfilOpen(false)} />
        </div>
      </div>
    </header>
  );
}
