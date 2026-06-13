import { useLocation, Link } from 'react-router-dom';

type Props = {
  title?: string;
  description?: string;
};

export default function DisabledFeaturePage({ title = 'Recurso desativado', description }: Props) {
  const loc = useLocation();
  const desc =
    description ||
    'Este recurso foi ocultado no modo 100% local (offline), para evitar qualquer dependência de internet, sincronização ou Supabase.';

  return (
    <div className="page-container" style={{ padding: '1.25rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>{title}</h1>
      <p style={{ opacity: 0.85, maxWidth: 720, lineHeight: 1.5 }}>{desc}</p>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to={`/painel${loc.search || ''}`} className="btn">
          Voltar ao Painel
        </Link>
        <Link to={`/configuracoes${loc.search || ''}`} className="btn btn-secondary">
          Ir para Configurações
        </Link>
      </div>

      <div style={{ marginTop: '1rem', opacity: 0.65, fontSize: '0.9rem' }}>
        Dica: se você quiser reativar isso no futuro, podemos criar um modo “Online opcional” com toggle e permissões.
      </div>
    </div>
  );
}
