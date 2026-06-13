import { useState, useEffect, useMemo, useRef, type ChangeEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useCompany, type CompanyData } from '@/contexts/CompanyContext';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { AppIcon, emojiToAppIcon, type AppIconName } from '@/components/ui/AppIcon';
import Tooltip from '@/components/ui/Tooltip';
import { getCurrentSession } from '@/lib/auth-supabase';
import { canAccessRoute } from '@/lib/permissions';
import { onStoreAccessChange } from '@/lib/store-access';
import { ALWAYS_VISIBLE_PATHS, PATHS_VENDAS_USADOS, menuGroups, type MenuItem } from './menuConfig';
import { getBackupAlertState, onBackupAlertChange } from '@/lib/auto-backup';
import { prepareRouteModuleForPathname, warmRouteModuleForPathname } from '@/lib/route-module-preload';
import { useAttentionCenter } from '@/hooks/useAttentionCenter';
import { showToast } from '@/components/ui/ToastContainer';
import { safeSet } from '@/lib/storage';
import { getCurrentStoreId } from '@/lib/store-id';
import './Sidebar.css';

// Lista plana para compatibilidade
const menuItems: MenuItem[] = menuGroups.flatMap((group) => group.items);

const COMPANY_LOCAL_KEY = 'smart-tech-company';
const COMPANY_CACHE_KEY = 'smart-tech-company-cache';
const MAX_LOGO_FILE_SIZE_BYTES = 2.5 * 1024 * 1024;

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Falha ao ler a imagem da logo.'));
    };
    reader.onerror = () => reject(new Error('Falha ao ler a imagem da logo.'));
    reader.readAsDataURL(file);
  });
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível processar a imagem da logo.'));
    img.src = src;
  });
}

function validateSidebarLogoFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione uma imagem válida para o logo.');
  }

  if (file.size > MAX_LOGO_FILE_SIZE_BYTES) {
    throw new Error('A imagem é muito grande. Use uma logo menor que 2,5 MB.');
  }
}

type SidebarLogoCropDraft = {
  src: string;
  fileName: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

async function renderSidebarLogoCrop(src: string, zoom: number, offsetX: number, offsetY: number): Promise<string> {
  const image = await loadImage(src);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a logo.');

  ctx.clearRect(0, 0, size, size);

  // Cover: preenche o quadro inteiro. O usuário ajusta o corte com zoom e posição.
  const scale = Math.max(size / image.width, size / image.height) * zoom;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const x = Math.round((size - width) / 2 + offsetX);
  const y = Math.round((size - height) / 2 + offsetY);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, x, y, width, height);

  return canvas.toDataURL('image/png');
}

function buildCompanyWithLogo(company: CompanyData | null, companyName: string, logoUrl: string): CompanyData {
  const now = new Date().toISOString();
  const storeId = company?.store_id || getCurrentStoreId() || 'local';
  return {
    id: company?.id || storeId,
    store_id: storeId,
    nome_fantasia: company?.nome_fantasia || companyName || 'Empresa cadastrada',
    razao_social: company?.razao_social || companyName || 'Empresa cadastrada',
    cnpj: company?.cnpj || '',
    telefone: company?.telefone || '',
    endereco: company?.endereco || '',
    cidade: company?.cidade || '',
    estado: company?.estado || '',
    cep: company?.cep || '',
    logo_url: logoUrl,
    mensagem_rodape: company?.mensagem_rodape || '',
    created_at: company?.created_at || now,
    updated_at: now,
  };
}

const APP_ICON_NAMES: Set<string> = new Set([
  'dashboard','users','shopping','box','wrench','banknote','cash','creditcard','receipt','settings','help','backup',
  'phone','truck','undo','clipboard','inbox','refresh','search','flask','more','menu','zap','maximize2','minimize2','x','bell','home'
]);

function resolveIconName(icon: string): AppIconName {
  if (APP_ICON_NAMES.has(icon)) return icon as AppIconName;
  const mapped = emojiToAppIcon[icon];
  if (mapped) return mapped;
  return 'more';
}

function SidebarIcon({ icon, color }: { icon: string; color: MenuItem['color'] }) {
  const name = resolveIconName(icon);
  return (
    <span className={`sidebar-icon c-${color}`} aria-hidden="true">
      <AppIcon name={name} size={18} />
    </span>
  );
}

function getCompanyInitials(name?: string | null): string {
  const raw = String(name || '').trim();
  if (!raw) return 'ST';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function Sidebar() {
  const { company, refresh: refreshCompany } = useCompany();
  const companyName = useMemo(() => {
    const value = company?.nome_fantasia || company?.razao_social || '';
    return String(value || '').trim() || 'Empresa cadastrada';
  }, [company?.nome_fantasia, company?.razao_social]);
  const companyInitials = useMemo(() => getCompanyInitials(companyName), [companyName]);
  const [brandLogoFailed, setBrandLogoFailed] = useState(false);
  const [logoCropDraft, setLogoCropDraft] = useState<SidebarLogoCropDraft | null>(null);
  const [logoSaving, setLogoSaving] = useState(false);
  const brandLogoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setBrandLogoFailed(false);
  }, [company?.logo_url]);

  useEffect(() => {
    if (!logoCropDraft) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLogoCropEditor();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // sidebar-logo-crop-escape-listener
  }, [logoCropDraft, logoSaving]);

  const openSidebarLogoPicker = () => {
    brandLogoInputRef.current?.click();
  };

  const handleSidebarLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      validateSidebarLogoFile(file);
      const raw = await fileToDataUrl(file);
      await loadImage(raw);
      setLogoCropDraft({
        src: raw,
        fileName: file.name,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível abrir a logo.';
      showToast(message, 'error');
    } finally {
      event.target.value = '';
    }
  };

  const updateLogoCrop = (field: keyof SidebarLogoCropDraft, value: number | string) => {
    setLogoCropDraft((current) => current ? { ...current, [field]: value } : current);
  };

  const closeLogoCropEditor = () => {
    if (logoSaving) return;
    setLogoCropDraft(null);
  };

  const applySidebarLogoCrop = async () => {
    if (!logoCropDraft) return;

    setLogoSaving(true);
    try {
      const logoUrl = await renderSidebarLogoCrop(
        logoCropDraft.src,
        logoCropDraft.zoom,
        logoCropDraft.offsetX,
        logoCropDraft.offsetY
      );
      const nextCompany = buildCompanyWithLogo(company, companyName, logoUrl);

      safeSet(COMPANY_LOCAL_KEY, nextCompany);
      safeSet(COMPANY_CACHE_KEY, {
        nome: nextCompany.nome_fantasia || nextCompany.razao_social || 'Empresa cadastrada',
        cnpj: nextCompany.cnpj || undefined,
        telefone: nextCompany.telefone || undefined,
        endereco: nextCompany.endereco || undefined,
        cidade: nextCompany.cidade || undefined,
        estado: nextCompany.estado || undefined,
        logo_url: logoUrl,
        slogan: nextCompany.mensagem_rodape || undefined,
      });

      setBrandLogoFailed(false);
      setLogoCropDraft(null);
      await refreshCompany();
      window.dispatchEvent(new CustomEvent('smarttech:company-logo-changed'));
      showToast('Logo da empresa recortada e atualizada.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível aplicar o corte da logo.';
      showToast(message, 'error');
    } finally {
      setLogoSaving(false);
    }
  };

  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('smart-tech-sidebar-collapsed');
    return saved === 'true';
  });

  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 901;
  });

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 901;
      setIsDesktop(desktop);
      // No desktop, sempre expandir
      if (desktop) {
        setCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // No desktop, não salvar estado collapsed
    if (!isDesktop) {
      localStorage.setItem('smart-tech-sidebar-collapsed', collapsed.toString());
    }
  }, [collapsed, isDesktop]);

  const session = getCurrentSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [backupAlert, setBackupAlert] = useState(() => getBackupAlertState());
  const [accessVersion, setAccessVersion] = useState(0);
  const attention = useAttentionCenter();
  useEffect(() => onBackupAlertChange(setBackupAlert), []);
  useEffect(() => onStoreAccessChange(() => setAccessVersion((current) => current + 1)), []);

  // Filtrar itens do menu baseado no role; admin sempre vê Vendas, Compra (Usados), Venda (Usados).
  const filteredMenuGroups = useMemo(() => {
    if (!session) return [];

    const isVisible = (path: string) => {
      return (
        ALWAYS_VISIBLE_PATHS.has(path) ||
        (session.role === 'admin' && PATHS_VENDAS_USADOS.has(path)) ||
        canAccessRoute(path)
      );
    };

    return menuGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => isVisible(item.path)),
      }))
      .filter((group) => group.items.length > 0);
  }, [session?.userId, session?.role, accessVersion]);

  const visibleItems: MenuItem[] = useMemo(() => {
    if (!session) return [];

    const isVisible = (path: string) => {
      return (
        ALWAYS_VISIBLE_PATHS.has(path) ||
        (session.role === 'admin' && PATHS_VENDAS_USADOS.has(path)) ||
        canAccessRoute(path)
      );
    };

    return menuItems.filter((item) => isVisible(item.path));
  }, [session?.userId, session?.role, accessVersion]);

  // No desktop, sempre mostrar expandido
  const isExpanded = !collapsed || isDesktop;

  const warmItem = (path: string) => {
    try { warmRouteModuleForPathname(path, 'sidebar'); } catch {}
  };

  const handleNavigate = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    if (location.pathname === path) return;

    event.preventDefault();
    warmItem(path);

    void prepareRouteModuleForPathname(path, 'sidebar-click', 120).catch(() => undefined);
    navigate(path);
  };

  return (
    <aside className={`sidebar ${!isExpanded ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand" aria-label="Console da loja">
          <button
            type="button"
            className="sidebar-brand-mark sidebar-brand-mark--compact sidebar-brand-mark--clickable"
            onClick={openSidebarLogoPicker}
            title="Clique para trocar o logo da empresa"
            aria-label="Trocar logo da empresa"
          >
            {company?.logo_url && !brandLogoFailed ? (
              <img
                className="sidebar-brand-logo"
                src={company.logo_url}
                alt=""
                draggable={false}
                decoding="async"
                onError={() => setBrandLogoFailed(true)}
              />
            ) : (
              <span className="sidebar-brand-fallback">{companyInitials}</span>
            )}
          </button>
          <Link to="/painel" className="sidebar-brand-copy sidebar-brand-copy-link" aria-label="Ir para o painel da loja">
            <span className="sidebar-brand-kicker">Console Loja</span>
            <span className="sidebar-brand-text" title={companyName}>{companyName}</span>
          </Link>
          <input
            ref={brandLogoInputRef}
            className="sidebar-logo-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleSidebarLogoChange}
            aria-hidden="true"
            tabIndex={-1}
          />

          {logoCropDraft && typeof document !== 'undefined'
            ? createPortal(
              <div className="sidebar-logo-crop-overlay" role="presentation" onClick={closeLogoCropEditor}>
                <section
                  className="sidebar-logo-crop-box"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="sidebar-logo-crop-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header className="sidebar-logo-crop-header">
                    <div>
                      <strong id="sidebar-logo-crop-title">Ajustar corte da logo</strong>
                      <span>{logoCropDraft.fileName}</span>
                    </div>
                    <button type="button" className="sidebar-logo-crop-close" onClick={closeLogoCropEditor} aria-label="Fechar editor da logo">
                      ×
                    </button>
                  </header>

                  <div className="sidebar-logo-crop-preview-wrap">
                    <div className="sidebar-logo-crop-preview">
                      <img
                        src={logoCropDraft.src}
                        alt="Prévia da logo"
                        style={{
                          transform: `translate(${logoCropDraft.offsetX / 2}px, ${logoCropDraft.offsetY / 2}px) scale(${logoCropDraft.zoom})`,
                        }}
                      />
                    </div>
                    <small>Prévia aproximada do quadro da sidebar.</small>
                  </div>

                  <div className="sidebar-logo-crop-controls">
                    <label>
                      <span>Zoom</span>
                      <input
                        type="range"
                        min="1"
                        max="2.8"
                        step="0.05"
                        value={logoCropDraft.zoom}
                        onChange={(event) => updateLogoCrop('zoom', Number(event.target.value))}
                      />
                    </label>

                    <label>
                      <span>Horizontal</span>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="1"
                        value={logoCropDraft.offsetX}
                        onChange={(event) => updateLogoCrop('offsetX', Number(event.target.value))}
                      />
                    </label>

                    <label>
                      <span>Vertical</span>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="1"
                        value={logoCropDraft.offsetY}
                        onChange={(event) => updateLogoCrop('offsetY', Number(event.target.value))}
                      />
                    </label>
                  </div>

                  <footer className="sidebar-logo-crop-actions">
                    <button type="button" className="sidebar-logo-crop-secondary" onClick={() => setLogoCropDraft((current) => current ? { ...current, zoom: 1, offsetX: 0, offsetY: 0 } : current)}>
                      Centralizar
                    </button>
                    <button type="button" className="sidebar-logo-crop-secondary" onClick={closeLogoCropEditor}>
                      Cancelar
                    </button>
                    <button type="button" className="sidebar-logo-crop-primary" onClick={applySidebarLogoCrop} disabled={logoSaving}>
                      {logoSaving ? 'Aplicando...' : 'Aplicar logo'}
                    </button>
                  </footer>
                </section>
              </div>,
              document.body
            )
            : null}
        </div>
      </div>

      <nav className="sidebar-nav">
        {isExpanded ? (
          filteredMenuGroups.map((group) => (
            <div key={group.label} className="sidebar-group">
              {/* labels ocultos no CSS para ficar igual ao mock */}
              <div className="sidebar-group-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => {
                    const routeAttention = attention.byPath[item.path];
                    return [
                      'sidebar-item',
                      isActive ? 'active' : '',
                      routeAttention ? 'sidebar-item--attention' : '',
                      routeAttention ? `sidebar-item--attention-${routeAttention.tone}` : '',
                    ].filter(Boolean).join(' ');
                  }}
                  title={attention.byPath[item.path]?.title}
                  onMouseEnter={() => warmItem(item.path)}
                  onFocus={() => warmItem(item.path)}
                  onPointerDown={() => warmItem(item.path)}
                  onClick={(event) => handleNavigate(event, item.path)}
                >
                  <SidebarIcon icon={item.icon} color={item.color} />
                  <span className="sidebar-label">
                    {item.label}
                  </span>
                  {attention.byPath[item.path] ? (
                    <span className="sidebar-attention-badge" aria-label={`${attention.byPath[item.path].count} pendência(s)`}>
                      {attention.byPath[item.path].count > 99 ? '99+' : attention.byPath[item.path].count}
                    </span>
                  ) : item.path === '/backup' && backupAlert.showAlert ? (
                    <span className="sidebar-attention-badge" title={backupAlert.message}>!</span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))
        ) : (
          // Menu colapsado (apenas ícones) - apenas mobile
          visibleItems.map((item) => {
            const sidebarItem = (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => {
                  const routeAttention = attention.byPath[item.path];
                  return [
                    'sidebar-item',
                    isActive ? 'active' : '',
                    routeAttention ? 'sidebar-item--attention' : '',
                    routeAttention ? `sidebar-item--attention-${routeAttention.tone}` : '',
                  ].filter(Boolean).join(' ');
                }}
                title={attention.byPath[item.path]?.title || item.label}
                onMouseEnter={() => warmItem(item.path)}
                onFocus={() => warmItem(item.path)}
                onPointerDown={() => warmItem(item.path)}
                onClick={(event) => handleNavigate(event, item.path)}
              >
                <div style={{ position: 'relative' }}>
                  <SidebarIcon icon={item.icon} color={item.color} />
                  {attention.byPath[item.path] ? (
                    <span className="sidebar-attention-badge sidebar-attention-badge--compact">
                      {attention.byPath[item.path].count > 99 ? '99+' : attention.byPath[item.path].count}
                    </span>
                  ) : null}
                </div>
              </NavLink>
            );

            return (
              <Tooltip key={item.path} text={item.label} position="right">
                {sidebarItem}
              </Tooltip>
            );
          })
        )}
      </nav>

      {isExpanded ? (
        <div className="sidebar-footer">
          <div className="sidebar-copyright">
            <p className="copyright-main">Smart Tech Offline</p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

export default Sidebar;
