import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getStoreId, setStoreId, isValidUUID } from '@/lib/store-id';

/**
 * Garante que exista um store_id configurado antes de entrar nas rotas protegidas.
 *
 * ✅ Resolve o caso do iPhone PWA:
 * - Quando o app é aberto pelo ícone, o iOS pode iniciar sem querystring (?store=...)
 * - Se o localStorage ainda não tiver store, o app precisa oferecer uma tela de configuração
 */
export function ClientIdGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Rotas públicas (não travar)
    const publicRoutes =
      location.pathname.startsWith('/login') ||
      location.pathname.startsWith('/setup') ||
      location.pathname.startsWith('/configurar-loja') ||
      location.pathname.startsWith('/s/');

    if (publicRoutes) return;

    // 1) Tenta resolver pela URL/localStorage (função centralizada)
    const resolved = getStoreId();
    const storeId = resolved.storeId?.trim() || '';

    // 2) Se existir e for UUID válido, persistir/normalizar (inclui legado)
    if (storeId && isValidUUID(storeId)) {
      setStoreId(storeId);
      return;
    }

    // 3) Se não tiver store configurado, manda para a tela de configuração
    console.warn('[ClientIdGuard] STORE_ID ausente/ inválido. Redirecionando para /configurar-loja');
    navigate('/configurar-loja', { replace: true });
  }, [navigate, location.pathname]);

  return children;
}

// ✅ Default export também (pra não quebrar outros lugares)
export default ClientIdGuard;
