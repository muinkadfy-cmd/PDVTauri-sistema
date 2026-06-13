import { memo } from 'react';
import { ReactNode } from 'react'; // augmented
import './Tooltip.css';

interface TooltipProps {
  children: ReactNode;
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

function Tooltip({ children, text, position = 'right' }: TooltipProps) {
  return (
    <div className="tooltip-wrapper">
      {children}
      <span className={`tooltip tooltip-${position}`} role="tooltip">
        {text}
      </span>
    </div>
  );
}

export default memo(Tooltip);
