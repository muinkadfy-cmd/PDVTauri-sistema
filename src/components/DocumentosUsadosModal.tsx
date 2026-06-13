import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './ui/Modal';
import type { UsadoArquivo } from '@/types';
import { usadosArquivosRepo } from '@/lib/repositories';
import { downloadFile, getUsadoStorageLabel, isLocalUsadosBucket, openFileFromStorage, saveFileToDevice } from '@/lib/usados-uploads';
import { logger } from '@/utils/logger';
import { resolveRemoteUsadoPreviewUrl } from '@/lib/capabilities/usados-preview-remote-adapter';
import { showToast } from '@/components/ui/ToastContainer';
import './DocumentosUsadosModal.css';

type DocItem = { arquivo: UsadoArquivo; url: string; isObjectUrl?: boolean };

interface Props {
  usadoId: string;
  titulo: string;
  isOpen: boolean;
  onClose: () => void;
}

function isImage(mime?: string): boolean {
  return !!mime && mime.startsWith('image/');
}

function isPdf(mime?: string): boolean {
  return mime === 'application/pdf';
}

async function signedUrl(bucket: string, path: string): Promise<string | null> {
  return await resolveRemoteUsadoPreviewUrl(bucket, path, 60 * 60);
}

function isLocalBucket(bucket: string): boolean {
  return isLocalUsadosBucket(bucket);
}

async function resolveDocUrl(arquivo: UsadoArquivo): Promise<{ url: string; isObjectUrl?: boolean } | null> {
  // ✅ Offline/local: IndexedDB -> Blob -> ObjectURL
  if (isLocalBucket(arquivo.bucket)) {
    const blob = await downloadFile(arquivo.bucket, arquivo.path);
    const url = URL.createObjectURL(blob);
    return { url, isObjectUrl: true };
  }

  // ✅ Online (Supabase): usar signed URL (não baixa tudo)
  const url = await signedUrl(arquivo.bucket, arquivo.path);
  if (!url) return null;
  return { url, isObjectUrl: url.startsWith('blob:') };
}

export default function DocumentosUsadosModal({ usadoId, titulo, isOpen, onClose }: Props) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DocItem | null>(null);

  const docsRef = useRef<DocItem[]>([]);

  const documentos = useMemo(() => {
    return usadosArquivosRepo
      .list()
      .filter(a => a.usadoId === usadoId && a.kind === 'document')
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  }, [usadoId, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      // ✅ Limpa URLs de preview criadas (evita vazamento de memória)
      for (const d of docsRef.current) {
        if (d.isObjectUrl) URL.revokeObjectURL(d.url);
      }
      docsRef.current = [];

      setDocs([]);
      setSelected(null);
      setLoading(true);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        // ✅ Revoke previews anteriores antes de recarregar
        for (const d of docsRef.current) {
          if (d.isObjectUrl) URL.revokeObjectURL(d.url);
        }
        docsRef.current = [];

        const items: DocItem[] = [];
        for (const a of documentos) {
          const resolved = await resolveDocUrl(a);
          if (resolved?.url) {
            const item: DocItem = { arquivo: a, url: resolved.url, isObjectUrl: resolved.isObjectUrl };
            items.push(item);
          }
        }

        docsRef.current = items;
        setDocs(items);
      } catch (e) {
        logger.error('[DocumentosUsadosModal] Erro ao carregar documentos', e);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      // ✅ cleanup quando trocar usado/fechar
      for (const d of docsRef.current) {
        if (d.isObjectUrl) URL.revokeObjectURL(d.url);
      }
      docsRef.current = [];
    };
  }, [isOpen, usadoId, documentos]);

  const previewDoc = (item: DocItem) => {
    setSelected(item);
  };

  const openDoc = async (item: DocItem) => {
    try {
      await openFileFromStorage(item.arquivo.bucket, item.arquivo.path, item.arquivo.originalName || undefined);
    } catch (e) {
      logger.error('[DocumentosUsadosModal] Erro ao abrir documento', e);
      showToast('Não foi possível abrir o documento.', 'error');
    }
  };

  const saveDoc = async (item: DocItem) => {
    try {
      const saved = await saveFileToDevice(item.arquivo.bucket, item.arquivo.path, item.arquivo.originalName || undefined);
      if (saved) {
        showToast('Documento salvo.', 'success');
      }
    } catch (e) {
      logger.error('[DocumentosUsadosModal] Erro ao baixar documento', e);
      showToast('Não foi possível salvar o documento.', 'error');
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`📄 Documentos - ${titulo}`} size="lg">
        <div className="docs-usados">
          {loading && <div className="docs-loading">⏳ Carregando documentos...</div>}

          {!loading && docs.length === 0 && (
            <div className="docs-empty">📄 Nenhum documento disponível</div>
          )}

          {!loading && docs.length > 0 && (
            <div className="docs-grid">
              {docs.map((d) => (
                <div
                  key={d.arquivo.id}
                  role="button"
                  tabIndex={0}
                  className={'docs-item' + (selected?.arquivo.id === d.arquivo.id ? ' docs-item-active' : '')}
                  onClick={() => previewDoc(d)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      previewDoc(d);
                    }
                  }}
                  title={d.arquivo.originalName || 'Documento'}
                >
                  <div className="docs-icon">
                    {isPdf(d.arquivo.mimeType) ? '📄' : isImage(d.arquivo.mimeType) ? '🖼️' : '📎'}
                  </div>
                  <div className="docs-meta">
                    <div className="docs-name">{d.arquivo.originalName || 'Sem nome'}</div>
                    <div className="docs-sub">
                      {(d.arquivo.sizeBytes ? `${(d.arquivo.sizeBytes / 1024 / 1024).toFixed(2)}MB` : '')}
                      {d.arquivo.mimeType ? ` • ${d.arquivo.mimeType}` : ''}
                    </div>
                    <div
                      className={`docs-storage-badge ${isLocalUsadosBucket(d.arquivo.bucket) ? 'is-local' : 'is-remote'}`}
                      title={isLocalUsadosBucket(d.arquivo.bucket) ? 'Documento salvo apenas localmente/offline e incluído no backup.' : 'Documento salvo no Supabase Storage da loja.'}
                    >
                      {getUsadoStorageLabel(d.arquivo.bucket)}
                    </div>
                  </div>
                  <div className="docs-item-actions">
                    <button
                      type="button"
                      className="docs-btn docs-btn-compact"
                      onClick={(event) => {
                        event.stopPropagation();
                        previewDoc(d);
                      }}
                    >
                      Visualizar
                    </button>
                    <button
                      type="button"
                      className="docs-btn docs-btn-compact"
                      onClick={(event) => {
                        event.stopPropagation();
                        void openDoc(d);
                      }}
                    >
                      Abrir
                    </button>
                    <button
                      type="button"
                      className="docs-btn docs-btn-compact"
                      onClick={(event) => {
                        event.stopPropagation();
                        void saveDoc(d);
                      }}
                    >
                      Salvar como
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && docs.length > 0 && (
            <div className="docs-footer">
              <p>Selecione um arquivo para visualizar ou use Salvar como para escolher uma pasta.</p>
            </div>
          )}
        </div>
      </Modal>

      {selected && (
        <div className="docs-preview-backdrop" onClick={() => setSelected(null)}>
          <div className="docs-preview-card" onClick={(e) => e.stopPropagation()}>
            <div className="docs-preview-header">
              <div className="docs-preview-title-wrap">
                <div className="docs-preview-title">{selected.arquivo.originalName || 'Documento'}</div>
                <div className={`docs-storage-badge ${isLocalUsadosBucket(selected.arquivo.bucket) ? 'is-local' : 'is-remote'}`}>
                  {getUsadoStorageLabel(selected.arquivo.bucket)}
                </div>
              </div>
              <div className="docs-preview-actions">
                <button type="button" className="docs-btn" onClick={() => void saveDoc(selected)}>Salvar como</button>
                <button type="button" className="docs-btn" onClick={() => void openDoc(selected)}>Abrir</button>
                <button type="button" className="docs-btn docs-btn-close" onClick={() => setSelected(null)}>✕</button>
              </div>
            </div>

            <div className="docs-preview-body">
              {isImage(selected.arquivo.mimeType) && (
                <img className="docs-preview-img" src={selected.url} alt={selected.arquivo.originalName || 'Imagem'} />
              )}

              {isPdf(selected.arquivo.mimeType) && (
                <iframe className="docs-preview-iframe" src={selected.url} title="PDF" />
              )}

              {!isImage(selected.arquivo.mimeType) && !isPdf(selected.arquivo.mimeType) && (
                <div className="docs-preview-unknown">
                  Não foi possível pré-visualizar este tipo de arquivo. Clique em <b>Abrir</b>.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
