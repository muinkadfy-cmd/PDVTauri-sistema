import './SkeletonList.css';

interface SkeletonListProps {
  count?: number;
  variant?: 'card' | 'row';
}

export default function SkeletonList({ count = 6, variant = 'card' }: SkeletonListProps) {
  return (
    <div className={`st-skeleton-list st-skeleton-list--${variant}`} aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`st-skeleton-item st-skeleton-item--${variant}`}>
          <div className="st-skeleton-line st-w-60" />
          <div className="st-skeleton-line st-w-40" />
        </div>
      ))}
    </div>
  );
}
