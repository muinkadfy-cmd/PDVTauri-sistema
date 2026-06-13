import type { ThermalReceiptModel } from '@/services/print/receipt-builders';
import type { ThermalPrintSettings } from '@/services/print/settings';
import './ThermalReceiptDocument.css';

interface ThermalReceiptDocumentProps {
  model: ThermalReceiptModel;
  settings: ThermalPrintSettings;
}

function parsePattern(value?: string): number[] {
  if (!value) return [];
  return Array.from(
    new Set(
      String(value)
        .split(/[^1-9]+/)
        .map((part) => Number(part))
        .filter((part) => Number.isInteger(part) && part >= 1 && part <= 9),
    ),
  );
}

function getPatternPointPosition(point: number) {
  const index = point - 1;
  return {
    col: index % 3,
    row: Math.floor(index / 3),
  };
}

function buildPatternOrderGrid(pattern: number[]): string[] {
  const grid = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ' '));
  pattern.forEach((point, index) => {
    const { col, row } = getPatternPointPosition(point);
    grid[row][col] = String(index + 1);
  });
  return grid.map((row) => row.map((cell) => cell.padStart(2, ' ')).join('  ').trimEnd());
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

export default function ThermalReceiptDocument({ model, settings }: ThermalReceiptDocumentProps) {
  const paperWidthMm = settings.paperWidth === '80' ? '80mm' : '58mm';
  const usefulWidthMm = `${settings.usefulWidthMm}mm`;
  const marginMm = `${settings.innerMarginMm}mm`;
  const checklistPattern = model.type === 'service-order-checklist'
    ? parsePattern(model.checklistPattern)
    : [];
  const checklistPatternGrid = buildPatternOrderGrid(checklistPattern);
  const densityVars = settings.printDensity === 'compact'
    ? {
        sectionGap: '0.72mm',
        headerGap: '0.55mm',
        itemsPad: '0.48mm',
        itemGap: '0.48mm',
        noteGap: '0.08mm',
        totalPad: '0.5mm',
        grandGap: '0.12mm',
        cutGap: '0.35mm',
        logoWidth: '12mm',
        logoHeight: '6mm',
        logoGap: '0.35mm',
        titleGap: '0.16mm',
        docGap: '0.2mm',
        rowGap: '1.1mm',
        storeBoost: '1px',
        detailAdjust: '-2px',
        grandBoost: '1px',
      }
    : settings.printDensity === 'dense'
      ? {
          sectionGap: '1.4mm',
          headerGap: '1.05mm',
          itemsPad: '1mm',
          itemGap: '1mm',
          noteGap: '0.18mm',
          totalPad: '1mm',
          grandGap: '0.3mm',
          cutGap: '0.8mm',
          logoWidth: '18mm',
          logoHeight: '9mm',
          logoGap: '0.9mm',
          titleGap: '0.35mm',
          docGap: '0.45mm',
          rowGap: '2.3mm',
          storeBoost: '3px',
          detailAdjust: '0px',
          grandBoost: '3px',
        }
      : {
          sectionGap: '1.1mm',
          headerGap: '0.8mm',
          itemsPad: '0.8mm',
          itemGap: '0.8mm',
          noteGap: '0.1mm',
          totalPad: '0.8mm',
          grandGap: '0.2mm',
          cutGap: '0.6mm',
          logoWidth: '16mm',
          logoHeight: '8mm',
          logoGap: '0.8mm',
          titleGap: '0.25mm',
          docGap: '0.35mm',
          rowGap: '1.8mm',
          storeBoost: '2px',
          detailAdjust: '-1px',
          grandBoost: '2px',
        };

  return (
    <div
      className="thermal-receipt"
      style={{
        ['--paper-width-mm' as any]: paperWidthMm,
        ['--useful-width-mm' as any]: usefulWidthMm,
        ['--inner-margin-mm' as any]: marginMm,
        ['--font-size-px' as any]: `${settings.fontSizePx}px`,
        ['--line-height' as any]: String(settings.lineHeight),
        ['--section-gap-mm' as any]: densityVars.sectionGap,
        ['--header-gap-mm' as any]: densityVars.headerGap,
        ['--items-pad-mm' as any]: densityVars.itemsPad,
        ['--item-gap-mm' as any]: densityVars.itemGap,
        ['--item-note-gap-mm' as any]: densityVars.noteGap,
        ['--totals-pad-mm' as any]: densityVars.totalPad,
        ['--grand-gap-mm' as any]: densityVars.grandGap,
        ['--cut-gap-mm' as any]: densityVars.cutGap,
        ['--logo-width-mm' as any]: densityVars.logoWidth,
        ['--logo-height-mm' as any]: densityVars.logoHeight,
        ['--logo-gap-mm' as any]: densityVars.logoGap,
        ['--title-gap-mm' as any]: densityVars.titleGap,
        ['--doc-gap-mm' as any]: densityVars.docGap,
        ['--row-gap-mm' as any]: densityVars.rowGap,
        ['--store-font-boost-px' as any]: densityVars.storeBoost,
        ['--detail-font-adjust-px' as any]: densityVars.detailAdjust,
        ['--grand-font-boost-px' as any]: densityVars.grandBoost,
      }}
    >
      <div className="thermal-receipt__inner">
        <header className="thermal-receipt__header thermal-receipt__brand">
          {settings.showLogo && model.company.logo_url ? (
            <img
              className="thermal-receipt__logo"
              src={model.company.logo_url}
              alt={model.company.nome}
              loading="eager"
              decoding="sync"
            />
          ) : null}
          <div className="thermal-receipt__store-name">{model.company.nome}</div>
          {model.company.cnpj ? <div className="thermal-receipt__company-line">CNPJ: {model.company.cnpj}</div> : null}
          {model.company.telefone ? <div className="thermal-receipt__company-line">Tel: {model.company.telefone}</div> : null}
          {[model.company.endereco, model.company.cidade, model.company.estado].filter(Boolean).length ? (
            <div className="thermal-receipt__company-line">
              {[model.company.endereco, model.company.cidade, model.company.estado].filter(Boolean).join(', ')}
            </div>
          ) : null}
        </header>

        <section className="thermal-receipt__meta">
          <div className="thermal-receipt__title">{model.title}</div>
          <div className="thermal-receipt__doc-number">{model.documentNumber}</div>
          <div className="thermal-receipt__meta-line">
            <span className="thermal-receipt__section-label">Data</span>
            <span className="thermal-receipt__meta-value">{model.dateLabel}</span>
          </div>
          {model.customerName ? (
            <div className="thermal-receipt__meta-line">
              <span className="thermal-receipt__section-label">Cliente</span>
              <span className="thermal-receipt__meta-value">{model.customerName}</span>
            </div>
          ) : null}
          {model.customerPhone ? (
            <div className="thermal-receipt__meta-line">
              <span className="thermal-receipt__section-label">Contato</span>
              <span className="thermal-receipt__meta-value">{model.customerPhone}</span>
            </div>
          ) : null}
          {model.customerAddress ? (
            <div className="thermal-receipt__meta-line">
              <span className="thermal-receipt__section-label">Endereco</span>
              <span className="thermal-receipt__meta-value">{model.customerAddress}</span>
            </div>
          ) : null}
        </section>

        <section className="thermal-receipt__items">
          {model.items.map((item, index) => (
            <article key={`${item.label}-${index}`} className="thermal-receipt__item">
              <div className="thermal-receipt__item-name">{item.label}</div>
              <div className="thermal-receipt__item-line">
                <span>
                  {item.quantity ? `${item.quantity}x` : ''}
                  {typeof item.unitPrice === 'number' ? ` ${formatCurrency(item.unitPrice)}` : ''}
                </span>
                <strong>{formatCurrency(item.total)}</strong>
              </div>
              {item.note ? <div className="thermal-receipt__item-note">{item.note}</div> : null}
            </article>
          ))}
        </section>

        <section className="thermal-receipt__totals">
          {typeof model.subtotal === 'number' ? (
            <div className="thermal-receipt__summary-row">
              <span className="thermal-receipt__summary-label">Subtotal</span>
              <span className="thermal-receipt__summary-value">{formatCurrency(model.subtotal)}</span>
            </div>
          ) : null}
          {typeof model.discount === 'number' && model.discount > 0 ? (
            <div className="thermal-receipt__summary-row">
              <span className="thermal-receipt__summary-label">Desconto</span>
              <span className="thermal-receipt__summary-value">- {formatCurrency(model.discount)}</span>
            </div>
          ) : null}
          {model.paymentLabel ? (
            <div className="thermal-receipt__summary-row">
              <span className="thermal-receipt__summary-label">Pagamento</span>
              <span className="thermal-receipt__summary-value">{model.paymentLabel}</span>
            </div>
          ) : null}
          {model.installmentsLabel ? (
            <div className="thermal-receipt__summary-row">
              <span className="thermal-receipt__summary-label">Parcelas</span>
              <span className="thermal-receipt__summary-value">{model.installmentsLabel}</span>
            </div>
          ) : null}
          <div className="thermal-receipt__summary-row thermal-receipt__summary-row--grand">
            <span className="thermal-receipt__summary-label">Total</span>
            <span className="thermal-receipt__summary-value">{formatCurrency(model.total)}</span>
          </div>
        </section>

        {model.type === 'service-order-checklist' && (model.checklistPassword || checklistPattern.length) ? (
          <section className="thermal-receipt__notes thermal-receipt__notes--checklist">
            <div className="thermal-receipt__section-label">Seguranca do aparelho</div>
            {model.checklistPassword ? (
              <div className="thermal-receipt__note">Senha: {model.checklistPassword}</div>
            ) : null}
            {checklistPattern.length ? (
              <div className="thermal-pattern" aria-label="Padrao de 9 pontos">
                <div className="thermal-pattern__label">Padrao 9 pontos</div>
                <pre className="thermal-pattern__numbers">
                  {checklistPatternGrid.join('\n')}
                </pre>
              </div>
            ) : null}
          </section>
        ) : null}

        {model.notes?.length ? (
          <section className="thermal-receipt__notes">
            <div className="thermal-receipt__section-label">Observacoes</div>
            {model.notes.map((note, index) => (
              <div key={`${note}-${index}`} className="thermal-receipt__note">{note}</div>
            ))}
          </section>
        ) : null}

        <footer className="thermal-receipt__footer">
          <div className="thermal-receipt__footer-message">{model.footerMessage}</div>
          {settings.showFooterCut ? <div className="thermal-receipt__cut">corte aqui</div> : null}
        </footer>
      </div>
    </div>
  );
}
