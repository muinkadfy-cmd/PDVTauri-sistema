import './InlineLoader.css';

interface InlineLoaderProps {
  label?: string;
  compact?: boolean;
}

/**
 * InlineLoader — loading simples (sem skeleton).
 * Ideal para PCs fracos: não usa shimmer, não cria muitos nodes.
 */
export default function InlineLoader({ label = 'Carregando…', compact = false }: InlineLoaderProps) {
  return (
    <div className={`st-inline-loader ${compact ? 'st-inline-loader--compact' : ''}`} aria-busy="true" aria-live="polite">
      <span className="st-inline-loader__spinner" aria-hidden="true" />
      <span className="st-inline-loader__label">{label}</span>
    </div>
  );
}
