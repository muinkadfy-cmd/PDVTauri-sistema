import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isLicenseMandatory, isLicenseEnabled } from '@/lib/mode';
import { getLicenseStatusAsync } from '@/lib/license';
import { getCurrentStoreId } from '@/lib/store-id';

export default function ConfigurarLojaPage() {
  const navigate = useNavigate();
  const [storeId] = useState(() => getCurrentStoreId());

  useEffect(() => {
    const run = async () => {
      const required = isLicenseMandatory() || isLicenseEnabled();
      if (!required) return;
      const st = await getLicenseStatusAsync();
      if (st.status !== 'active' && st.status !== 'trial') {
        navigate('/ativacao', { replace: true, state: { from: '/configurar-loja' } });
      }
    };
    run().catch(() => undefined);
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--bg)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 560,
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>
            Loja única configurada
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.4 }}>
            Esta instalação do PDV utiliza uma <b>loja única interna</b>. 
            O identificador é gerado automaticamente no primeiro uso e não depende mais de URL ou parâmetros.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            padding: 12,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.03)',
            color: 'var(--text-secondary)',
            fontSize: 13,
            lineHeight: 1.5
          }}>
            <div style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
              Identificador interno da loja
            </div>
            <div>
              {storeId
                ? <code style={{ fontSize: 12 }}>{storeId}</code>
                : 'Será gerado automaticamente na primeira utilização.'}
            </div>
            <div style={{ marginTop: 8 }}>
              Não é mais necessário configurar links com <b>?store=</b> ou rotas <b>/s/:storeId</b>.
            </div>
          </div>

          <button
            onClick={() => navigate('/painel', { replace: true })}
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 12,
              border: 'none',
              background: 'var(--primary)',
              color: 'white',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Ir para o Painel
          </button>
        </div>
      </div>
    </div>
  );
}
