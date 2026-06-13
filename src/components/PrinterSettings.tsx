import { useEffect, useMemo, useState } from "react";
import { invalidatePrintersCache, listPrinters, setDefaultPrinter } from "@/utils/printers";
import { loadPrintProfile, savePrintProfile, DEFAULT_PROFILE, type PrintProfile } from "@/print/printProfiles";

import "./PrinterSettings.css";

export default function PrinterSettings() {
  const [printers, setPrinters] = useState<Array<{ name: string; is_default: boolean }>>([]);
  const [profile, setProfile] = useState<PrintProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [settingWinDefault, setSettingWinDefault] = useState(false);
  const [winDefaultError, setWinDefaultError] = useState<string | null>(null);

  const current = useMemo(
    () => profile.printerName || printers.find((p) => p.is_default)?.name,
    [profile, printers]
  );

  useEffect(() => {
    setProfile(loadPrintProfile());
  }, []);

  async function loadPrintersNow(force = false) {
    if (loading) return;
    if (loaded && !force) return;
    setLoading(true);
    setWinDefaultError(null);
    try {
      const ps = await listPrinters({ force });
      setPrinters(ps);
      setLoaded(true);
    } catch (err: any) {
      console.error('[PrinterSettings] Falha ao listar impressoras:', err);
      setWinDefaultError('Não foi possível carregar as impressoras agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function update(patch: Partial<PrintProfile>) {
    const next = { ...profile, ...patch };
    setProfile(next);
    savePrintProfile(next);
  }

  function handleSelectPrinter(name: string) {
    update({ printerName: name });
    setWinDefaultError(null);
  }

  async function handleSetDefault(name: string) {
    setSettingWinDefault(true);
    setWinDefaultError(null);
    try {
      await setDefaultPrinter(name);
      invalidatePrintersCache();
      update({ printerName: name });
      await loadPrintersNow(true);
    } catch (err: any) {
      console.error('[PrinterSettings] Falha ao definir impressora padrão:', err);
      setWinDefaultError('Windows não permitiu definir como padrão. A seleção do sistema foi mantida.');
      try {
        await loadPrintersNow(true);
      } catch {
        // ignore
      }
    } finally {
      setSettingWinDefault(false);
    }
  }

  return (
    <div className="printer-settings">
      <div className="printer-settings__header">
        <div className="printer-settings__summary" aria-label="Resumo da impressora" style={{ width: '100%' }}>
          <span className="printer-settings__summary-label">Atual</span>
          <strong className="printer-settings__summary-value">{current || 'Nenhuma selecionada'}</strong>
          <span className="printer-settings__hint" style={{ marginTop: 8 }}>
            O perfil fica salvo mesmo sem carregar a lista pesada de impressoras do Windows.
          </span>
        </div>
      </div>

      {!loaded ? (
        <div className="printer-settings__grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Carregamento sob demanda</label>
            <div className="printer-settings__hint" style={{ marginBottom: 10 }}>
              Para deixar a aba mais leve, a lista de impressoras só é carregada quando você pedir.
            </div>
            <div className="printer-settings__actions">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => { void loadPrintersNow(true); }}
                disabled={loading}
              >
                {loading ? 'Carregando impressoras...' : 'Carregar impressoras e opções avançadas'}
              </button>
            </div>
            {winDefaultError && (
              <span className="printer-settings__error" role="status" aria-live="polite">
                {winDefaultError}
              </span>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="printer-settings__header">
            <div className="form-group printer-settings__printer">
              <label>Impressora</label>
              {loading ? (
                <div className="printer-settings__loading" aria-live="polite">Atualizando impressoras…</div>
              ) : (
                <select value={current || ''} onChange={(e) => { handleSelectPrinter(e.target.value); }}>
                  <option value="" disabled>Selecione…</option>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.is_default ? '⭐ ' : ''}{p.name}
                    </option>
                  ))}
                </select>
              )}
              <span className="printer-settings__hint">Selecione a impressora que o sistema vai usar. A estrela indica a padrão do Windows.</span>
              <div className="printer-settings__actions">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => { void loadPrintersNow(true); }}
                  disabled={loading || settingWinDefault}
                >
                  {loading ? 'Atualizando...' : 'Atualizar lista'}
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => { if (current) void handleSetDefault(current); }}
                  disabled={!current || loading || settingWinDefault}
                >
                  {settingWinDefault ? 'Definindo padrão...' : 'Definir como padrão do Windows'}
                </button>
                {winDefaultError && (
                  <span className="printer-settings__error" role="status" aria-live="polite">
                    {winDefaultError}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="printer-settings__grid">
            <div className="form-group">
              <label>Motor térmico</label>
              <input type="text" value="RAW/BT silencioso (monocromático)" readOnly />
              <span className="printer-settings__hint">
                Impressão térmica fixa em modo direto para POS 80mm e 58mm, sem janela de diálogo compatível.
              </span>
            </div>

            <div className="form-group">
              <label>Papel</label>
              <select value={profile.preset} onChange={(e) => update({ preset: e.target.value as any })}>
                <option value="80mm">80mm</option>
                <option value="58mm">58mm</option>
              </select>
            </div>

            <div className="form-group">
              <label>Escala</label>
              <input type="number" step="0.01" value={profile.scale} onChange={(e) => update({ scale: Number(e.target.value) || 1 })} />
            </div>

            <div className="form-group">
              <label>Offset Left (mm)</label>
              <input type="number" step="0.1" value={profile.offsetLeftMm} onChange={(e) => update({ offsetLeftMm: Number(e.target.value) || 0 })} />
            </div>

            <div className="form-group">
              <label>Offset Top (mm)</label>
              <input type="number" step="0.1" value={profile.offsetTopMm} onChange={(e) => update({ offsetTopMm: Number(e.target.value) || 0 })} />
            </div>
          </div>
        </>
      )}

      <p className="printer-settings__tip">
        Modo compatibilidade removido: a térmica trabalha sempre em <strong>RAW/BT</strong>, silencioso e monocromático.
      </p>

      <p className="printer-settings__tip">
        Dica: se estiver cortando o topo, coloque <strong>Offset Top</strong> positivo (ex: 1.0mm).
        Se estiver saindo para a direita/esquerda, ajuste <strong>Offset Left</strong>.
      </p>
    </div>
  );
}
