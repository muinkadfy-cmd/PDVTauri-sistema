import { memo } from 'react';
import { openExternalUrl } from '@/lib/openExternalUrl';
import './WhatsAppButton.css';

interface WhatsAppButtonProps {
  telefone: string;
  mensagem?: string;
  className?: string;
}

function WhatsAppButton({ telefone, mensagem, className = '' }: WhatsAppButtonProps) {
  const formatarTelefone = (tel: string): string | null => {
    // Remove tudo que não é número
    let numeros = tel.replace(/\D/g, '');
    
    // Validar se tem conteúdo mínimo
    if (!numeros || numeros.length < 10) {
      return null; // Telefone inválido
    }
    
    // Remover zero inicial (ex: "043999998888" → "43999998888")
    if (numeros.startsWith('0')) {
      numeros = numeros.slice(1);
    }
    
    // Se já começar com 55, verificar se tem DDD+telefone válido
    if (numeros.startsWith('55')) {
      // Remover 55 temporariamente para validar
      const semCodigo = numeros.slice(2);
      
      // Deve ter 10 ou 11 dígitos (DDD + telefone)
      if (semCodigo.length === 10 || semCodigo.length === 11) {
        return numeros; // Já está no formato correto
      }
      
      // Se tiver mais ou menos dígitos, remover 55 e validar novamente
      numeros = semCodigo;
    }
    
    // Validar formato final: deve ter 10 ou 11 dígitos (DDD + telefone)
    if (numeros.length < 10 || numeros.length > 11) {
      return null; // Telefone inválido
    }
    
    // Adicionar código do Brasil
    return `55${numeros}`;
  };

  const telefoneFormatado = formatarTelefone(telefone);
  
  // Não renderiza se telefone inválido
  if (!telefoneFormatado) return null;

  const handleClick = () => {
    const texto = mensagem ? encodeURIComponent(mensagem) : '';
    const url = `https://wa.me/${telefoneFormatado}${texto ? `?text=${texto}` : ''}`;
    void openExternalUrl(url);
  };

  return (
    <button
      className={`whatsapp-button ${className}`}
      onClick={handleClick}
      aria-label="Enviar mensagem no WhatsApp"
      title="Enviar mensagem no WhatsApp"
    >
      <span className="whatsapp-icon">💬</span>
      <span className="whatsapp-text">WhatsApp</span>
    </button>
  );
}

export default memo(WhatsAppButton);
