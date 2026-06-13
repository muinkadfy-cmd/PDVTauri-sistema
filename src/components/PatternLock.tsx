/**
 * Pattern Lock Component
 * Grid 3x3 para desenhar padrão de desbloqueio estilo Android
 */

import { useState, useRef, useEffect } from 'react';
import './PatternLock.css';

interface PatternLockProps {
  value?: string; // Padrão numérico (ex: "6-0-8-2")
  onChange?: (pattern: string) => void;
  disabled?: boolean;
}

// Mapeamento: índice do grid -> número
const GRID_TO_NUMBER: { [key: number]: number } = {
  0: 0, 1: 1, 2: 2,
  3: 3, 4: 4, 5: 5,
  6: 6, 7: 7, 8: 8
};

export default function PatternLock({ value = '', onChange, disabled = false }: PatternLockProps) {
  const [selectedDots, setSelectedDots] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sincronizar com value externo
  useEffect(() => {
    if (value) {
      const numbers = value.split('-').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
      // Converter números para índices do grid
      const indices = numbers.map(num => {
        const entry = Object.entries(GRID_TO_NUMBER).find(([_, val]) => val === num);
        return entry ? parseInt(entry[0]) : -1;
      }).filter(idx => idx >= 0);
      setSelectedDots(indices);
    } else {
      setSelectedDots([]);
    }
  }, [value]);

  const getDotPosition = (index: number) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    return { row, col };
  };

  const getDotNumber = (index: number) => {
    return GRID_TO_NUMBER[index] ?? index;
  };

  const isDotSelected = (index: number) => {
    return selectedDots.includes(index);
  };

  const isDotActive = (index: number) => {
    if (selectedDots.length === 0) return false;
    return selectedDots[selectedDots.length - 1] === index;
  };

  const isDotStart = (index: number) => {
    return selectedDots.length > 0 && selectedDots[0] === index;
  };

  const isDotEnd = (index: number) => {
    return selectedDots.length > 0 && selectedDots[selectedDots.length - 1] === index;
  };

  const handleDotClick = (index: number) => {
    if (disabled) return;

    if (selectedDots.includes(index)) {
      return;
    }

    const newSelected = [...selectedDots, index];
    setSelectedDots(newSelected);
    
    const pattern = newSelected.map(idx => getDotNumber(idx)).join('-');
    onChange?.(pattern);
  };

  const handleMouseDown = (index: number) => {
    if (disabled) return;
    setIsDrawing(true);
    setSelectedDots([index]);
    const pattern = `${getDotNumber(index)}`;
    onChange?.(pattern);
  };

  const handleMouseEnter = (index: number) => {
    if (disabled || !isDrawing) return;
    
    if (!selectedDots.includes(index)) {
      const newSelected = [...selectedDots, index];
      setSelectedDots(newSelected);
      const pattern = newSelected.map(idx => getDotNumber(idx)).join('-');
      onChange?.(pattern);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    if (disabled) return;
    setSelectedDots([]);
    onChange?.('');
  };

  // Calcular linhas SVG entre pontos selecionados
  const getLines = () => {
    if (selectedDots.length < 2) return [];
    
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const dotSize = 32;
    const spacing = 48;
    
    for (let i = 0; i < selectedDots.length - 1; i++) {
      const dot1 = getDotPosition(selectedDots[i]);
      const dot2 = getDotPosition(selectedDots[i + 1]);
      
      const x1 = dot1.col * spacing + dotSize / 2;
      const y1 = dot1.row * spacing + dotSize / 2;
      const x2 = dot2.col * spacing + dotSize / 2;
      const y2 = dot2.row * spacing + dotSize / 2;
      
      lines.push({ x1, y1, x2, y2 });
    }
    
    return lines;
  };

  const lines = getLines();
  const dotSize = 32;
  const spacing = 48;
  const gridSize = spacing * 2 + dotSize;

  return (
    <div className="pattern-lock-container" ref={containerRef}>
      <div 
        className="pattern-lock-grid"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ 
          width: gridSize,
          height: gridSize,
          position: 'relative',
          touchAction: 'none'
        }}
      >
        {/* Linhas SVG conectando os pontos */}
        {lines.length > 0 && (
          <svg
            className="pattern-lock-lines"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1
            }}
          >
            {lines.map((line, idx) => (
              <line
                key={idx}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="var(--primary, #4CAF50)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            ))}
          </svg>
        )}

        {/* Grid de pontos */}
        {Array.from({ length: 9 }).map((_, index) => {
          const pos = getDotPosition(index);
          const x = pos.col * spacing;
          const y = pos.row * spacing;
          const selected = isDotSelected(index);
          const active = isDotActive(index);
          const isStart = isDotStart(index);
          const isEnd = isDotEnd(index);

          return (
            <div
              key={index}
              className={`pattern-lock-dot ${
                selected ? 'selected' : ''
              } ${active ? 'active' : ''} ${isStart ? 'start' : ''} ${isEnd ? 'end' : ''}`}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: `${dotSize}px`,
                height: `${dotSize}px`,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1
              }}
              onMouseDown={() => handleMouseDown(index)}
              onMouseEnter={() => handleMouseEnter(index)}
              onClick={() => handleDotClick(index)}
              onTouchStart={(e) => {
                e.preventDefault();
                handleMouseDown(index);
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                if (!containerRef.current) return;
                const rect = containerRef.current.getBoundingClientRect();
                const touch = e.touches[0];
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                
                // Encontrar o ponto mais próximo
                let closestIndex = -1;
                let minDist = Infinity;
                
                for (let i = 0; i < 9; i++) {
                  const pos = getDotPosition(i);
                  const dotX = pos.col * spacing + dotSize / 2;
                  const dotY = pos.row * spacing + dotSize / 2;
                  const dist = Math.sqrt(Math.pow(x - dotX, 2) + Math.pow(y - dotY, 2));
                  
                  if (dist < minDist && dist < dotSize) {
                    minDist = dist;
                    closestIndex = i;
                  }
                }
                
                if (closestIndex >= 0 && isDrawing) {
                  handleMouseEnter(closestIndex);
                }
              }}
              onTouchEnd={handleMouseUp}
            >
              <div className="pattern-lock-dot-inner">
                {isStart && <span className="pattern-lock-icon">▶</span>}
                {isEnd && <span className="pattern-lock-icon">✓</span>}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Display do padrão numérico e botão Limpar */}
      <div className="pattern-lock-display">
        <input
          type="text"
          value={selectedDots.map(idx => getDotNumber(idx)).join('-') || ''}
          readOnly
          className="pattern-lock-input"
          placeholder="Desenhe o padrão"
        />
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || selectedDots.length === 0}
          className="pattern-lock-clear"
        >
          Limpar
        </button>
      </div>
    </div>
  );
}
