import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import ThermalReceiptDocument from '@/components/print/ThermalReceiptDocument';
import { resolveReceiptPrintData, type PrintableReceiptType } from '@/services/print/receipt-builders';
import { loadThermalPrintSettings, type ThermalPrintSettings } from '@/services/print/settings';
import { isValidUUID, setStoreId } from '@/lib/store-id';

const PAGE_STYLE_ID = 'smart-tech-thermal-page-style';

async function waitForReceiptAssets(): Promise<void> {
  const images = Array.from(document.querySelectorAll('.thermal-receipt img')) as HTMLImageElement[];
  if (!images.length) return;

  await Promise.all(images.map((img) => new Promise<void>((resolve) => {
    if (img.complete) {
      resolve();
      return;
    }

    const done = () => resolve();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    window.setTimeout(done, 1800);
  })));
}

function updateThermalPageStyle(paperWidth: '58' | '80', paperHeightMm: number) {
  const widthMm = paperWidth === '80' ? 80 : 58;
  const safeHeight = Math.max(22, Number.isFinite(paperHeightMm) ? paperHeightMm : 80);
  const css = `@page { size: ${widthMm}mm ${safeHeight.toFixed(2)}mm; margin: 0; }`;

  let styleEl = document.getElementById(PAGE_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = PAGE_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}

export default function PrintReceiptPage() {
  const { docType, id } = useParams<{ docType: PrintableReceiptType; id: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<Awaited<ReturnType<typeof resolveReceiptPrintData>>>(null);

  const settings = useMemo<ThermalPrintSettings>(() => {
    const base = loadThermalPrintSettings();
    const paper = searchParams.get('paper');
    const profile = searchParams.get('profile');
    return {
      ...base,
      paperWidth: paper === '80' ? '80' : paper === '58' ? '58' : base.paperWidth,
      printerProfile: (profile as any) || base.printerProfile,
    };
  }, [searchParams]);

  useEffect(() => {
    let alive = true;

    void (async () => {
      if (!docType || !id) {
        setError('Documento de impressão inválido.');
        setLoading(false);
        return;
      }

      const requestedStore = searchParams.get('store')?.trim() || '';
      if (requestedStore && isValidUUID(requestedStore)) {
        setStoreId(requestedStore, { force: true, reason: 'print-route-bootstrap' });
      }

      const tryResolve = async () => {
        for (let attempt = 0; attempt < 12; attempt++) {
          const resolvedTry = await resolveReceiptPrintData(docType, id);
          if (resolvedTry) return resolvedTry;
          await new Promise((resolve) => window.setTimeout(resolve, 180));
        }
        return null;
      };

      const resolved = await tryResolve();
      if (!alive) return;

      if (!resolved) {
        setError('Não foi possível carregar os dados do cupom.');
        setLoading(false);
        return;
      }

      setModel(resolved);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [docType, id, searchParams]);

  useEffect(() => {
    if (loading || error || !model) return;

    const autoClose = settings.autoCloseAfterPrint;
    const returnTo = searchParams.get('returnTo')?.trim() || '';
    const onAfterPrint = () => {
      if (autoClose) {
        setTimeout(() => {
          if (window.opener && !window.opener.closed) {
            window.close();
            return;
          }
          if (returnTo) {
            window.location.replace(returnTo);
            return;
          }
          if (window.history.length > 1) {
            window.history.back();
          }
        }, 220);
      }
    };

    window.addEventListener('afterprint', onAfterPrint, { once: true });

    let cancelled = false;
    const runPrint = async () => {
      await waitForReceiptAssets();
      if (cancelled) return;

      const receipt = document.querySelector('.thermal-receipt__inner') as HTMLElement | null;
      if (receipt) {
        const heightPx = receipt.scrollHeight;
        const pxToMm = 25.4 / 96;
        const extraTailMm = settings.printDensity === 'compact'
          ? (settings.showFooterCut ? 1.4 : 0.8)
          : settings.printDensity === 'dense'
            ? (settings.showFooterCut ? 2.8 : 1.5)
            : (settings.showFooterCut ? 2.2 : 1.2);
        const totalHeightMm = (heightPx * pxToMm) + extraTailMm;
        updateThermalPageStyle(settings.paperWidth, totalHeightMm);
        document.documentElement.style.setProperty('--thermal-paper-height-mm', `${totalHeightMm.toFixed(2)}mm`);
      }

      window.setTimeout(() => {
        if (cancelled) return;
        window.focus();
        window.print();
      }, 120);
    };

    void runPrint();

    return () => {
      cancelled = true;
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [loading, error, model, searchParams, settings.autoCloseAfterPrint, settings.showFooterCut, settings.paperWidth, settings.printDensity]);

  if (loading) {
    return <div className="thermal-print-page"><div className="thermal-print-page__status">Preparando cupom…</div></div>;
  }

  if (error || !model) {
    return <div className="thermal-print-page"><div className="thermal-print-page__status">{error || 'Cupom indisponível.'}</div></div>;
  }

  return (
    <div className="thermal-print-page">
      <ThermalReceiptDocument model={model.thermalModel} settings={settings} />
      <div className="thermal-print-page__status">
        Cupom {settings.paperWidth}mm pronto para impressão
      </div>
    </div>
  );
}
