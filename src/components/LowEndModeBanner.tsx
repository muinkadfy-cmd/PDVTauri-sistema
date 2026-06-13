/**
 * LowEndModeBanner — Badge discreto em posição fixed
 * Não empurra layout, não invade páginas.
 * Banner de sugestão fica apenas na ConfiguracoesPage.
 */
import { useLowEndMode } from '@/hooks/useLowEndMode';
import { useEffect, useRef, useState } from 'react';

export function LowEndModeBanner() {
  const { isLowEnd } = useLowEndMode();
  const prev = useRef<boolean | null>(null);
  const [visible, setVisible] = useState(false);

  // Não deixa a mensagem ficar fixa para sempre.
  // Mostra como "toast" por alguns segundos quando o modo é ativado
  // (ou quando o app abre já com o modo ativado).
  useEffect(() => {
    const was = prev.current;
    prev.current = isLowEnd;

    // Desativou -> esconde imediatamente
    if (!isLowEnd) {
      setVisible(false);
      return;
    }

    // Ativou (ou primeiro render já ativo) -> mostra por alguns segundos
    if (was === null || was === false) {
      setVisible(true);
      const t = window.setTimeout(() => setVisible(false), 4500);
      return () => window.clearTimeout(t);
    }
  }, [isLowEnd]);

  if (!isLowEnd || !visible) return null;

  return (
    <div
      className="low-end-badge"
      role="status"
      title="Recomendado para computadores com hardware limitado."
    >
      <span>🐢</span>
      <span>Modo fraco ativado para melhorar a estabilidade.</span>
    </div>
  );
}
