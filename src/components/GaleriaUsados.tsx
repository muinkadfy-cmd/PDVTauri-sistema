import { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import { getFotosComUrls } from '@/lib/usados-fotos';
import type { UsadoArquivo } from '@/types';
import { getUsadoStorageLabel, isLocalUsadosBucket, saveFileToDevice } from '@/lib/usados-uploads';
import './GaleriaUsados.css';

interface GaleriaUsadosProps {
  usadoId: string;
  titulo: string;
  isOpen: boolean;
  onClose: () => void;
}

interface FotoComUrl {
  arquivo: UsadoArquivo;
  url: string;
  isObjectUrl?: boolean;
}

function GaleriaUsados({ usadoId, titulo, isOpen, onClose }: GaleriaUsadosProps) {
  const [fotos, setFotos] = useState<FotoComUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [fotoExpandida, setFotoExpandida] = useState<FotoComUrl | null>(null);
  const [indexExpandida, setIndexExpandida] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      for (const foto of fotos) {
        if (foto.isObjectUrl) {
          URL.revokeObjectURL(foto.url);
        }
      }
      setFotos([]);
      setFotoExpandida(null);
      setLoading(true);
      return;
    }

    carregarFotos();
  }, [isOpen, usadoId]);

  const carregarFotos = async () => {
    setLoading(true);
    try {
      for (const foto of fotos) {
        if (foto.isObjectUrl) {
          URL.revokeObjectURL(foto.url);
        }
      }
      const fotosComUrls = await getFotosComUrls(usadoId);
      setFotos(fotosComUrls);
    } catch (error) {
      console.error('[GaleriaUsados] Erro ao carregar fotos:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirExpandida = (foto: FotoComUrl, index: number) => {
    setFotoExpandida(foto);
    setIndexExpandida(index);
  };

  const fecharExpandida = () => {
    setFotoExpandida(null);
  };

  const navegarFoto = (direcao: 'anterior' | 'proxima') => {
    if (!fotoExpandida || fotos.length === 0) return;

    let novoIndex = indexExpandida;
    if (direcao === 'anterior') {
      novoIndex = indexExpandida > 0 ? indexExpandida - 1 : fotos.length - 1;
    } else {
      novoIndex = indexExpandida < fotos.length - 1 ? indexExpandida + 1 : 0;
    }

    setIndexExpandida(novoIndex);
    setFotoExpandida(fotos[novoIndex]);
  };

  const baixarFoto = async (foto: FotoComUrl) => {
    await saveFileToDevice(foto.arquivo.bucket, foto.arquivo.path, foto.arquivo.originalName || undefined);
  };

  useEffect(() => {
    return () => {
      for (const foto of fotos) {
        if (foto.isObjectUrl) {
          URL.revokeObjectURL(foto.url);
        }
      }
    };
  }, [fotos]);

  // Navegação por teclado
  useEffect(() => {
    if (!fotoExpandida) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        fecharExpandida();
      } else if (e.key === 'ArrowLeft') {
        navegarFoto('anterior');
      } else if (e.key === 'ArrowRight') {
        navegarFoto('proxima');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fotoExpandida, indexExpandida, fotos]);

  return (
    <>
      {/* Modal Principal: Grid de Fotos */}
      <Modal isOpen={isOpen} onClose={onClose} title={`📸 Fotos - ${titulo}`} size="lg">
        <div className="galeria-usados">
          {loading && (
            <div className="galeria-loading">
              <p>⏳ Carregando fotos...</p>
            </div>
          )}

          {!loading && fotos.length === 0 && (
            <div className="galeria-empty">
              <p>📷 Nenhuma foto disponível</p>
            </div>
          )}

          {!loading && fotos.length > 0 && (
            <div className="galeria-grid">
              {fotos.map((foto, index) => (
                <div
                  key={foto.arquivo.id}
                  className="galeria-item"
                  onClick={() => abrirExpandida(foto, index)}
                >
                  <img
                    src={foto.url}
                    alt={foto.arquivo.originalName || `Foto ${index + 1}`}
                    className="galeria-thumbnail"
                  />
                  <div className="galeria-overlay">
                    <span>🔍 Ver</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && fotos.length > 0 && (
            <div className="galeria-footer">
              <p>💡 Clique em uma foto para ampliar</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Secundário: Foto Expandida com Navegação */}
      {fotoExpandida && (
        <div className="galeria-fullscreen" onClick={fecharExpandida}>
          <div className="galeria-fullscreen-header">
            <div className="galeria-header-main">
              <span className="galeria-contador">
                {indexExpandida + 1} / {fotos.length}
              </span>
              <span className={`galeria-storage-badge ${isLocalUsadosBucket(fotoExpandida.arquivo.bucket) ? 'is-local' : 'is-remote'}`}>
                {getUsadoStorageLabel(fotoExpandida.arquivo.bucket)}
              </span>
            </div>
            <div className="galeria-header-actions">
              <button
                className="galeria-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  void baixarFoto(fotoExpandida);
                }}
                aria-label="Baixar foto"
              >
                Baixar
              </button>
              <button
                className="galeria-close-btn"
                onClick={fecharExpandida}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="galeria-fullscreen-content" onClick={(e) => e.stopPropagation()}>
            {fotos.length > 1 && (
              <button
                className="galeria-nav-btn galeria-nav-prev"
                onClick={(e) => {
                  e.stopPropagation();
                  navegarFoto('anterior');
                }}
                aria-label="Foto anterior"
              >
                ‹
              </button>
            )}

            <img
              src={fotoExpandida.url}
              alt={fotoExpandida.arquivo.originalName || 'Foto ampliada'}
              className="galeria-fullscreen-img"
            />

            {fotos.length > 1 && (
              <button
                className="galeria-nav-btn galeria-nav-next"
                onClick={(e) => {
                  e.stopPropagation();
                  navegarFoto('proxima');
                }}
                aria-label="Próxima foto"
              >
                ›
              </button>
            )}
          </div>

          <div className="galeria-fullscreen-footer">
            <p>{fotoExpandida.arquivo.originalName || 'Sem nome'}</p>
            <p className="galeria-hint">
              ← → Para navegar | ESC para fechar
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default GaleriaUsados;
