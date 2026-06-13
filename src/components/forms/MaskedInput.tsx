/**
 * Input com máscara reutilizável
 */

import { forwardRef, InputHTMLAttributes } from 'react';
import { maskPhone, maskCPF, maskCNPJ, maskCurrency, maskCEP } from '@/lib/masks';

interface MaskedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  mask?: 'phone' | 'cpf' | 'cnpj' | 'currency' | 'cep' | 'none';
  onChange?: (value: string) => void;
  onEnterPress?: () => void;
}

export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask = 'none', onChange, onEnterPress, onKeyDown, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;
      
      // Aplicar máscara
      switch (mask) {
        case 'phone':
          value = maskPhone(value);
          break;
        case 'cpf':
          value = maskCPF(value);
          break;
        case 'cnpj':
          value = maskCNPJ(value);
          break;
        case 'currency':
          // Para currency, manter apenas números e permitir formatação
          value = value.replace(/[^\d,.-]/g, '');
          break;
        case 'cep':
          value = maskCEP(value);
          break;
        default:
          break;
      }

      if (onChange) {
        onChange(value);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onEnterPress) {
        e.preventDefault();
        onEnterPress();
      }
      if (onKeyDown) {
        onKeyDown(e);
      }
    };

    // Ajustar inputMode para mobile
    const getInputMode = () => {
      switch (mask) {
        case 'phone':
        case 'cep':
          return 'tel';
        case 'cpf':
        case 'cnpj':
        case 'currency':
          return 'numeric';
        default:
          return props.inputMode || 'text';
      }
    };

    return (
      <input
        {...props}
        ref={ref}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        inputMode={getInputMode()}
      />
    );
  }
);

MaskedInput.displayName = 'MaskedInput';
