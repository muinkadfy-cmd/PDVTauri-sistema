import './LoadingState.css';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

function LoadingState({ message = 'Carregando...', size = 'md' }: LoadingStateProps) {
  return (
    <div className={`loading-state loading-state-${size}`} role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true"></div>
      <p className="loading-message">{message}</p>
    </div>
  );
}

export default LoadingState;
