import type { CSSProperties, ReactNode } from 'react';

/**
 * AppIcon
 *
 * Objetivo: padronizar ícones em Web/Mobile (PWA) e evitar variação de emojis por SO.
 * - Não depende de libs externas.
 * - Usa SVG inline (stroke currentColor) e funciona bem em temas claros/escuros.
 */

export type AppIconName =
  | 'dashboard'
  | 'users'
  | 'shopping'
  | 'box'
  | 'wrench'
  | 'banknote'
  | 'cash'
  | 'creditcard'
  | 'receipt'
  | 'settings'
  | 'help'
  | 'backup'
  | 'phone'
  | 'truck'
  | 'undo'
  | 'clipboard'
  | 'inbox'
  | 'refresh'
  | 'check-circle'
  | 'sparkles'
  | 'search'
  | 'flask'
  | 'more';

type Props = {
  name: AppIconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

function Svg({ size = 20, className, style, title, children }: { size?: number; className?: string; style?: CSSProperties; title?: string; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : 'presentation'}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function AppIcon({ name, size = 20, className, style, title }: Props) {
  switch (name) {
    case 'dashboard':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="8" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
          <rect x="13" y="13" width="8" height="8" rx="2" />
        </Svg>
      );
    case 'users':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <path d="M16 11a4 4 0 1 0-8 0" />
          <circle cx="12" cy="7" r="3" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </Svg>
      );
    case 'shopping':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <path d="M6 7h15l-1.2 13H6.8L6 7Z" />
          <path d="M9 7a3 3 0 0 1 6 0" />
        </Svg>
      );
    case 'box':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="M3.3 7.3 12 12l8.7-4.7" />
          <path d="M12 22V12" />
        </Svg>
      );
    case 'wrench':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <path d="M21 2v6l-3 3-3-3 3-3h-6" />
          <path d="M4.7 13.3 2 16l6 6 2.7-2.7" />
          <path d="M11 9l4 4" />
        </Svg>
      );
    case 'banknote':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <rect x="3" y="7" width="18" height="10" rx="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M7 10h0" />
          <path d="M17 14h0" />
        </Svg>
      );
    case 'cash':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <circle cx="8" cy="12" r="3" />
          <circle cx="16" cy="12" r="3" />
          <path d="M11 12h2" />
        </Svg>
      );
    case 'creditcard':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 14h4" />
        </Svg>
      );
    case 'receipt':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <path d="M6 2h12v20l-2-1-2 1-2-1-2 1-2-1-2 1V2Z" />
          <path d="M9 7h6" />
          <path d="M9 11h6" />
          <path d="M9 15h4" />
        </Svg>
      );
    case 'settings':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a7.8 7.8 0 0 0 .1-2l2-1.2-2-3.4-2.2.7a8.3 8.3 0 0 0-1.7-1l-.3-2.3H10.7l-.3 2.3a8.3 8.3 0 0 0-1.7 1L6.5 8.4l-2 3.4 2 1.2a7.8 7.8 0 0 0 .1 2l-2 1.2 2 3.4 2.2-.7a8.3 8.3 0 0 0 1.7 1l.3 2.3h4.6l.3-2.3a8.3 8.3 0 0 0 1.7-1l2.2.7 2-3.4-2-1.2Z" />
        </Svg>
      );
    case 'help':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4" />
          <path d="M12 17h.01" />
        </Svg>
      );
    case 'backup':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
          <path d="M12 3v12" />
          <path d="M7 8l5-5 5 5" />
        </Svg>
      );
    case 'phone':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M11 18h2" />
        </Svg>
      );
    case 'truck':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <path d="M3 7h11v10H3z" />
          <path d="M14 10h4l3 3v4h-7" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="18" cy="18" r="2" />
        </Svg>
      );
    case 'undo':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10a6 6 0 0 1 0 12h-2" />
        </Svg>
      );
    case 'clipboard':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <rect x="8" y="2" width="8" height="4" rx="1" />
          <path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
          <path d="M8 10h8" />
          <path d="M8 14h8" />
        </Svg>
      );
    case 'inbox':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <path d="M22 12l-3-8H5l-3 8v8h20v-8Z" />
          <path d="M2 12h6l2 3h4l2-3h6" />
        </Svg>
      );
    case 'refresh':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <path d="M21 12a9 9 0 0 1-15.4 6.4" />
          <path d="M3 12a9 9 0 0 1 15.4-6.4" />
          <path d="M21 12v-4h-4" />
          <path d="M3 12v4h4" />
        </Svg>
      );
    case 'check-circle':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l2.5 2.5L16.5 9" />
        </Svg>
      );
    case 'sparkles':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1L6.5 8.5l4.1-1.4L12 3Z" />
          <path d="M19 13l.8 2.2L22 16l-2.2.8L19 19l-.8-2.2L16 16l2.2-.8L19 13Z" />
          <path d="M5 14l.7 1.8L7.5 16.5l-1.8.7L5 19l-.7-1.8-1.8-.7 1.8-.7L5 14Z" />
        </Svg>
      );
    case 'search':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </Svg>
      );
    case 'flask':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <path d="M10 2v6L4 20a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2L14 8V2" />
          <path d="M8 8h8" />
        </Svg>
      );
    case 'more':
      return (
        <Svg size={size} className={className} style={style} title={title}>
          <circle cx="6" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="18" cy="12" r="1" />
        </Svg>
      );
    default:
      return null;
  }
}

export const emojiToAppIcon: Record<string, AppIconName> = {
  '📊': 'dashboard',
  '👥': 'users',
  '👤': 'users',
  '🛍️': 'shopping',
  '📦': 'box',
  '🔧': 'wrench',
  '💰': 'banknote',
  '💵': 'cash',
  '💳': 'creditcard',
  '🧾': 'receipt',
  '⚙️': 'settings',
  '❓': 'help',
  '💾': 'backup',
  '📱': 'phone',
  '🚚': 'truck',
  '↩️': 'undo',
  '📋': 'clipboard',
  '📬': 'inbox',
  '🆕': 'refresh',
  '✅': 'check-circle',
  '✨': 'sparkles',
  '🔍': 'search',
  '🧪': 'flask',
  '⋯': 'more'
};
