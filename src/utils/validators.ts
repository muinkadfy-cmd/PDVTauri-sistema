/**
 * Utilitários de validação de formato
 */

/**
 * Valida formato de email
 */
export function isValidEmail(email: string): boolean {
  if (!email || !email.trim()) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Valida formato de telefone brasileiro
 * Aceita: (11) 98765-4321, 11987654321, (11) 987654321, etc.
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || !phone.trim()) return false;
  // Remove caracteres não numéricos
  const digits = phone.replace(/\D/g, '');
  // Telefone deve ter 10 ou 11 dígitos (fixo ou celular)
  return digits.length >= 10 && digits.length <= 11;
}

/**
 * Formata telefone para exibição: (11) 98765-4321
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

/**
 * Valida CPF brasileiro
 * Verifica formato e dígitos verificadores
 */
export function isValidCPF(cpf: string): boolean {
  if (!cpf || !cpf.trim()) return false;
  
  // Remove caracteres não numéricos
  const digits = cpf.replace(/\D/g, '');
  
  // Deve ter 11 dígitos
  if (digits.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais (CPF inválido)
  if (/^(\d)\1{10}$/.test(digits)) return false;
  
  // Valida dígitos verificadores
  let sum = 0;
  let remainder: number;
  
  // Valida primeiro dígito verificador
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(digits.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits.substring(9, 10))) return false;
  
  // Valida segundo dígito verificador
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(digits.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits.substring(10, 11))) return false;
  
  return true;
}

/**
 * Formata CPF: 123.456.789-00
 */
export function formatCPF(cpf: string): string {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return cpf;
}

/**
 * Valida CEP brasileiro
 */
export function isValidCEP(cep: string): boolean {
  if (!cep || !cep.trim()) return false;
  const digits = cep.replace(/\D/g, '');
  return digits.length === 8;
}

/**
 * Formata CEP: 12345-678
 */
export function formatCEP(cep: string): string {
  if (!cep) return '';
  const digits = cep.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return cep;
}
