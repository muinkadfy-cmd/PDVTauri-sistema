import './WhatsAppIcon.css';
import { openExternalUrl } from '@/lib/openExternalUrl';

interface WhatsAppIconProps {
  telefone: string;
  mensagem?: string;
  className?: string;
}

function WhatsAppIcon({ telefone, mensagem, className = '' }: WhatsAppIconProps) {
  const formatarTelefone = (tel: string) => {
    const numeros = tel.replace(/\D/g, '');
    const semZero = numeros.startsWith('0') ? numeros.slice(1) : numeros;
    return semZero.startsWith('55') ? semZero : `55${semZero}`;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const telefoneFormatado = formatarTelefone(telefone);
    const texto = mensagem ? encodeURIComponent(mensagem) : '';
    const url = `https://wa.me/${telefoneFormatado}${texto ? `?text=${texto}` : ''}`;

    void openExternalUrl(url);
  };

  if (!telefone) return null;

  return (
    <button
      type="button"
      className={`whatsapp-icon-btn ${className}`}
      onClick={handleClick}
      aria-label="Enviar mensagem no WhatsApp"
      title="Enviar mensagem no WhatsApp"
    >
      💬
    </button>
  );
}

export default WhatsAppIcon;
