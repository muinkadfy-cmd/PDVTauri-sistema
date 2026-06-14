import { useMemo, useState } from 'react';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { useCompany } from '@/contexts/CompanyContext';
import { isDesktopApp } from '@/lib/platform';
import { openPrintTest } from '@/services/print/receipt-service';
import { THERMAL_PRINTER_PROFILES } from '@/services/print/thermalProfiles';
import './ThermalPrintSettings.css';

export default function ThermalPrintSettings() {
  const { settings, saving, update, applyProfile, saveCurrent } = usePrintSettings();
  const { company } = useCompany();
  const [section, setSection] = useState<'geral' | 'desktop' | 'visual'>('geral');

  const profileOptions = useMemo(() => Object.values(THERMAL_PRINTER_PROFILES), []);
  const economyModeActive = settings.printDensity === 'compact' && settings.fontSizePx <= 10 && settings.innerMarginMm <= 1.5;
  const activeProfile = THERMAL_PRINTER_PROFILES[settings.printerProfile];
  const logoStatus = !settings.showLogo
    ? 'Logo desativada nesta impressão'
    : company?.logo_url
      ? 'Logo encontrada e pronta para o cupom'
      : 'Sem logo cadastrada nos dados da empresa';

  async function handleApplyNormalMode() {
    const profile = THERMAL_PRINTER_PROFILES[settings.printerProfile];
    await update({
      printDensity: 'normal',
      innerMarginMm: profile?.innerMarginMm ?? 2,
      fontSizePx: profile?.fontSizePx ?? (settings.paperWidth === '80' ? 12 : 11),
      lineHeight: profile?.lineHeight ?? 1.22,
      showFooterCut: true,
    });
  }

  async function handleApplyReducedMode() {
    await update({
      printDensity: 'compact',
      innerMarginMm: 0.5,
      fontSizePx: settings.paperWidth === '80' ? 11 : 10,
      lineHeight: 1.04,
      showFooterCut: false,
    });
  }

  return (
    <section className="thermal-settings">
      <div className="thermal-settings__hero">
        <div>
          <strong>Impressão térmica profissional</strong>
          <p>Fluxo de impressão migrado para desktop Tauri com motor nativo silencioso, preservando o restante do sistema e a navegação atual.</p>
        </div>
        <span className="thermal-settings__badge">{saving ? 'Salvando...' : 'Desktop silencioso ativo'}</span>
      </div>

      <div className="thermal-settings__savebar">
        <div className="thermal-settings__savecopy">
          <strong>Salvar configurações da impressora</strong>
          <span>Tudo fica gravado localmente para o desktop continuar pronto, sem depender de serviços externos para imprimir.</span>
        </div>
        <div className="thermal-settings__saveactions">
          <button
            type="button"
            className="thermal-settings__testbtn"
            onClick={() => { void openPrintTest({ paperWidth: settings.paperWidth, label: `${settings.paperWidth}mm` }); }}
          >
            Impressão de teste
          </button>
          <button
            type="button"
            className="thermal-settings__savebtn"
            onClick={() => { void saveCurrent(); }}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </div>

      <div className="thermal-settings__summary">
        <div className="thermal-settings__summary-item">
          <span>Papel</span>
          <strong>{settings.paperWidth}mm</strong>
        </div>
        <div className="thermal-settings__summary-item">
          <span>Perfil</span>
          <strong>{activeProfile.label}</strong>
        </div>
        <div className="thermal-settings__summary-item">
          <span>Motor</span>
          <strong>{isDesktopApp() ? 'Nativo Tauri ESC/POS' : 'Rota de impressão web'}</strong>
        </div>
        <div className="thermal-settings__summary-item">
          <span>Modo</span>
          <strong>{economyModeActive ? 'Reduzido' : 'Normal/Denso'}</strong>
        </div>
        <div className="thermal-settings__summary-item">
          <span>Entrega térmica</span>
          <strong>{isDesktopApp() ? 'Silenciosa via desktop' : 'Compatível via navegador'}</strong>
        </div>
      </div>

      <div className="thermal-settings__tabs" role="tablist" aria-label="Seções da impressão térmica">
        <button
          type="button"
          role="tab"
          aria-selected={section === 'geral'}
          className={`thermal-settings__tab ${section === 'geral' ? 'is-active' : ''}`}
          onClick={() => setSection('geral')}
        >
          Geral
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === 'desktop'}
          className={`thermal-settings__tab ${section === 'desktop' ? 'is-active' : ''}`}
          onClick={() => setSection('desktop')}
        >
          Desktop
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === 'visual'}
          className={`thermal-settings__tab ${section === 'visual' ? 'is-active' : ''}`}
          onClick={() => setSection('visual')}
        >
          Aparência
        </button>
      </div>

      {section === 'geral' ? (
        <div className="thermal-settings__panel" role="tabpanel">
          <div className="thermal-settings__intro-card">
            <strong>Base da impressora</strong>
            <p>Escolha perfil e papel. No app Tauri a térmica usa motor nativo silencioso; no web o sistema mantém a rota de impressão compatível.</p>
          </div>

          <div className="thermal-settings__grid">
            <div className="form-group">
              <label>Motor de impressão</label>
              <input
                type="text"
                value={isDesktopApp() ? 'Tauri nativo RAW/BT silencioso' : 'Rota de impressão do navegador'}
                readOnly
              />
            </div>

            <div className="form-group">
              <label>Perfil da impressora</label>
              <select
                value={settings.printerProfile}
                onChange={(e) => { void applyProfile(e.target.value as any); }}
              >
                {profileOptions.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Papel térmico</label>
              <select
                value={settings.paperWidth}
                onChange={(e) => { void update({ paperWidth: e.target.value === '80' ? '80' : '58' }); }}
              >
                <option value="58">58mm</option>
                <option value="80">80mm</option>
              </select>
            </div>

            <div className="form-group">
              <label>Largura útil (mm)</label>
              <input
                type="number"
                min="40"
                max="72"
                step="1"
                value={settings.usefulWidthMm}
                onChange={(e) => { void update({ usefulWidthMm: Number(e.target.value) || settings.usefulWidthMm }); }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {section === 'desktop' ? (
        <div className="thermal-settings__panel" role="tabpanel">
          <div className="thermal-settings__intro-card">
            <strong>Desktop Tauri</strong>
            <p>O fluxo oficial agora é o desktop. A impressão térmica usa o motor nativo RAW/ESC-POS do aplicativo, sem ponte externa.</p>
          </div>

          <div className="thermal-settings__silent-card">
            <strong>Modo silencioso para térmicas</strong>
            <span>Com a impressora configurada no desktop, o cupom sai direto para a POS sem diálogo extra e sem depender do navegador.</span>
            <div className="thermal-settings__trust-list">
              <span>Sem ponte externa</span>
              <span>Desktop como principal</span>
              <span>Ideal para 58mm e 80mm</span>
              <span>Sem modo compatível visual</span>
            </div>
          </div>

          <div className="thermal-settings__trust-card is-ready">
            <strong>Motor desktop pronto para produção</strong>
            <span>O app usa spooler nativo no Windows e impressão RAW/ESC-POS no Tauri, reduzindo pontos de falha na operação do caixa.</span>
            <div className="thermal-settings__trust-list">
              <span>Sem assinatura remota</span>
              <span>Sem script externo</span>
              <span>Mais previsível no balcão</span>
            </div>
          </div>
        </div>
      ) : null}

      {section === 'visual' ? (
        <div className="thermal-settings__panel" role="tabpanel">
          <div className="thermal-settings__intro-card">
            <strong>Visual e acabamento</strong>
            <p>Ajuste o espaço interno, a densidade do texto e os elementos visuais do cupom para ficar limpo e econômico.</p>
          </div>

          <div className="thermal-settings__logo-status">
            <strong>Status da logo</strong>
            <span>{logoStatus}</span>
          </div>

          <div className="thermal-settings__mode-cards">
            <button
              type="button"
              className={`thermal-settings__mode-card ${!economyModeActive ? 'is-active' : ''}`}
              onClick={() => { void handleApplyNormalMode(); }}
            >
              <strong>Modo normal</strong>
              <span>Leitura mais confortável, com espaçamento padrão e linha de corte visível.</span>
            </button>
            <button
              type="button"
              className={`thermal-settings__mode-card ${economyModeActive ? 'is-active' : ''}`}
              onClick={() => { void handleApplyReducedMode(); }}
            >
              <strong>Modo reduzido</strong>
              <span>Economiza papel com fonte menor, margens mais curtas e cupom mais seco.</span>
            </button>
          </div>

          <div className="thermal-settings__grid">
            <div className="form-group">
              <label>Margem interna (mm)</label>
              <input
                type="number"
                min="0"
                max="6"
                step="0.5"
                value={settings.innerMarginMm}
                onChange={(e) => { void update({ innerMarginMm: Number(e.target.value) || 0 }); }}
              />
            </div>

            <div className="form-group">
              <label>Densidade / fonte</label>
              <select
                value={settings.printDensity}
                onChange={(e) => { void update({ printDensity: e.target.value as any }); }}
              >
                <option value="compact">Compacta</option>
                <option value="normal">Normal</option>
                <option value="dense">Densa</option>
              </select>
            </div>

            <div className="form-group">
              <label>Tamanho da fonte (px)</label>
              <input
                type="number"
                min="8"
                max="16"
                step="1"
                value={settings.fontSizePx}
                onChange={(e) => { void update({ fontSizePx: Number(e.target.value) || settings.fontSizePx }); }}
              />
            </div>
          </div>

          <div className="thermal-settings__toggles">
            <label className="thermal-settings__toggle">
              <input
                type="checkbox"
                checked={settings.showLogo}
                onChange={(e) => { void update({ showLogo: e.target.checked }); }}
              />
              <span>Exibir logo</span>
            </label>
            <label className="thermal-settings__toggle">
              <input
                type="checkbox"
                checked={settings.showQrCode}
                onChange={(e) => { void update({ showQrCode: e.target.checked }); }}
              />
              <span>Exibir QR Code</span>
            </label>
            <label className="thermal-settings__toggle">
              <input
                type="checkbox"
                checked={settings.showFooterCut}
                onChange={(e) => { void update({ showFooterCut: e.target.checked }); }}
              />
              <span>Mostrar linha de corte</span>
            </label>
            <label className="thermal-settings__toggle">
              <input
                type="checkbox"
                checked={settings.autoCloseAfterPrint}
                onChange={(e) => { void update({ autoCloseAfterPrint: e.target.checked }); }}
              />
              <span>Fechar após imprimir</span>
            </label>
          </div>
        </div>
      ) : null}

      <div className="thermal-settings__footnote">
        Base útil recomendada: 48mm para POS-58/Goldensky 58 e 72mm para 80mm/Epson TM-T20. A térmica ficou padronizada no motor nativo do desktop.
      </div>
    </section>
  );
}
