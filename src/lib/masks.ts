/**
 * Utilitários de máscara para inputs
 */

/**
 * Aplica máscara de telefone: (11) 98765-4321
 */
export function maskPhone(value: string): string {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 10) {
    // Telefone fixo: (11) 1234-5678
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  } else {
    // Celular: (11) 98765-4321
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  }
}

/**
 * Remove máscara de telefone
 */
export function unmaskPhone(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Aplica máscara de CPF: 123.456.789-00
 */
export function maskCPF(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  return numbers
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/**
 * Remove máscara de CPF
 */
export function unmaskCPF(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Aplica máscara de CNPJ: 12.345.678/0001-90
 */
export function maskCNPJ(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 14);
  return numbers
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

/**
 * Remove máscara de CNPJ
 */
export function unmaskCNPJ(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formata valor monetário: R$ 1.234,56
 */
export function maskCurrency(value: string | number): string {
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0 : value;
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numValue);
}

/**
 * Remove formatação monetária e retorna número
 */
export function unmaskCurrency(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

/**
 * Formata CEP: 12345-678
 */
export function maskCEP(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 8);
  return numbers.replace(/(\d{5})(\d)/, '$1-$2');
}

/**
 * Remove máscara de CEP
 */
export function unmaskCEP(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Hook para input com máscara
 */
export function useMaskedInput(
  maskFn: (value: string) => string,
  unmaskFn: (value: string) => string
) {
  const handleChange = (value: string, onChange: (value: string) => void) => {
    const unmasked = unmaskFn(value);
    const masked = maskFn(unmasked);
    onChange(masked);
  };

  return { handleChange };
}
