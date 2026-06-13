import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '@/components/ui/ToastContainer';
import { getWarrantySettings, upsertWarrantySettings } from '@/lib/settings';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import type { WarrantySettings } from '@/types';
import './ConfiguracoesTermosGarantiaPage.css';

function ConfiguracoesTermosGarantiaPage() {
  const navigate = useNavigate();

  const storeId = useMemo(() => getRuntimeStoreId() || '', []);
  const storeShort = storeId ? `${storeId.slice(0, 8)}...` : '—';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<WarrantySettings>({
    id: storeId || '',
    warranty_terms: '',
    warranty_terms_enabled: true,
    warranty_terms_pinned: false
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await getWarrantySettings();
      if (cancelled) return;
      if (!res.success || !res.data) {
        showToast(res.error || 'Erro ao carregar termos', 'error');
        setLoading(false);
        return;
      }
      setData(res.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await upsertWarrantySettings({
        warranty_terms: data.warranty_terms,
        warranty_terms_enabled: data.warranty_terms_enabled,
        warranty_terms_pinned: data.warranty_terms_pinned
      });
      if (res.success) {
        showToast('Termos de garantia salvos!', 'success');
      } else {
        showToast(res.error || 'Erro ao salvar', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container warranty-settings-page">
        <div className="warranty-loading">
          <div className="spinner" />
          <p>Carregando termos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container warranty-settings-page">
      <div className="page-header">
        <div className="warranty-header-row">
          <div>
            <h1>🧾 Termos de Garantia</h1>
            <p>Configure os termos que podem ser incluídos na impressão da OS</p>
          </div>
          <div className="warranty-header-actions">
            <button className="btn-secondary" onClick={() => navigate('/configuracoes')}>
              ← Voltar
            </button>
          </div>
        </div>
      </div>

      <div className="warranty-card">
        <div className="warranty-meta">
          <div>
            <strong>Store:</strong> <code>{storeShort}</code>
          </div>
        </div>

        <div className="warranty-toggles">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={data.warranty_terms_enabled}
              onChange={(e) => setData((prev) => ({ ...prev, warranty_terms_enabled: e.target.checked }))}
            />
            <span>Habilitar “Incluir termos” por padrão ao criar OS</span>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={data.warranty_terms_pinned}
              onChange={(e) => setData((prev) => ({ ...prev, warranty_terms_pinned: e.target.checked }))}
            />
            <span>Fixar termos (impede edição rápida na OS)</span>
          </label>
        </div>

        <div className="warranty-form">
          <label className="warranty-label">Texto dos termos</label>
          <textarea
            value={data.warranty_terms}
            onChange={(e) => setData((prev) => ({ ...prev, warranty_terms: e.target.value }))}
            placeholder="Digite aqui os termos de garantia..."
            rows={10}
          />

          <div className="warranty-actions">
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '⏳ Salvando...' : '💾 Salvar'}
            </button>
            <button
              className="btn-secondary"
              onClick={async () => {
                const res = await getWarrantySettings();
                if (res.success && res.data) {
                  setData(res.data);
                  showToast('Dados atualizados.', 'success');
                } else {
                  showToast(res.error || 'Erro ao atualizar', 'error');
                }
              }}
              disabled={saving}
            >
              🔄 Atualizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfiguracoesTermosGarantiaPage;

