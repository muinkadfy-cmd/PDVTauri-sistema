import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { upsertStoreAccess, fetchStoreAccess, type StoreAccessRoutes } from '@/lib/store-access';
import { ROLE_ROUTES, type UserRole } from '@/types';
import { getCurrentSession } from '@/lib/auth-supabase';
import { isSuperAdminSession } from '@/lib/access-control';


function isSystemSuperAdmin(): boolean {
  // Fonte de verdade: sessão atual (hard-coded por ID/email)
  return isSuperAdminSession(getCurrentSession());
}

function useQueryStoreId(): string {
  const location = useLocation();
  return useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return (sp.get('store') || '').trim();
  }, [location.search]);
}

export default function StoreAccessPage() {
  const storeFromQuery = useQueryStoreId();

  const [storeId, setStoreId] = useState(storeFromQuery);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [routes, setRoutes] = useState<StoreAccessRoutes>({});

  const superadmin = isSystemSuperAdmin();

  const baseRoutes = ROLE_ROUTES.admin || [];

  useEffect(() => {
    setStoreId(storeFromQuery);
  }, [storeFromQuery]);

  const load = async () => {
    setError(null);
    setSuccess(null);
    const sid = storeId.trim();
    if (!sid) {
      setError('Informe um Store ID.');
      return;
    }
    setLoading(true);
    try {
      const row = await fetchStoreAccess(sid);
      setRoutes(row?.routes || {});
      setSuccess('Permissões carregadas.');
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  const toggleRoute = (role: UserRole, route: string) => {
    setRoutes((prev) => {
      const current = Array.isArray(prev[role]) ? prev[role] : [];
      const set = new Set(current);
      if (set.has(route)) set.delete(route);
      else set.add(route);
      return { ...prev, [role]: Array.from(set) };
    });
  };

  const save = async () => {
    setError(null);
    setSuccess(null);
    const sid = storeId.trim();
    if (!sid) {
      setError('Informe um Store ID.');
      return;
    }
    setSaving(true);
    try {
      const res = await upsertStoreAccess(sid, routes);
      if (!res.ok) throw new Error(res.error || 'Erro ao salvar');
      setSuccess('Permissões salvas com sucesso.');
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (!superadmin) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Permissões por Loja</h1>
        <p className="mt-2 text-slate-600">Acesso restrito: apenas o <b>SuperAdmin</b> pode acessar esta página.</p>
      </div>
    );
  }

  const adminSelected = new Set(Array.isArray(routes.admin) ? routes.admin : baseRoutes);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Permissões por Loja</h1>
          <p className="text-slate-600">Escolha quais abas/rotas o <b>Admin</b> da loja poderá acessar.</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <input
            className="w-full md:flex-1 rounded-lg border px-3 py-2"
            placeholder="Store ID (UUID)"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          />
          <button
            className="rounded-lg border px-4 py-2 hover:bg-slate-50 disabled:opacity-60"
            onClick={load}
            disabled={loading}
          >
            {loading ? 'Carregando...' : 'Carregar'}
          </button>
          <button
            className="rounded-lg bg-green-600 text-white px-4 py-2 hover:bg-green-700 disabled:opacity-60"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
        {success ? <div className="mt-3 text-sm text-green-700">{success}</div> : null}
      </div>

      <div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold">Rotas do Admin</h2>
          <div className="text-sm text-slate-500">Marcadas: {adminSelected.size}/{baseRoutes.length}</div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {baseRoutes.map((r) => (
            <label key={r} className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={adminSelected.has(r)}
                onChange={() => toggleRoute('admin', r)}
              />
              <span className="font-mono text-sm">{r}</span>
            </label>
          ))}
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Dica: para “resetar” e voltar ao padrão, marque tudo (ou apague a linha no banco).
        </p>
      </div>
    </div>
  );
}
