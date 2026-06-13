/**
 * Presets para Ordem de Serviço
 * Valores pré-definidos para agilizar o preenchimento
 */

export const EQUIPAMENTOS = [
  'Celular',
  'Tablet',
  'Notebook',
  'Computador',
  'Console',
  'Smartwatch',
  'Impressora',
  'Outro'
] as const;

export const CORES = [
  'Preto',
  'Branco',
  'Azul',
  'Vermelho',
  'Verde',
  'Rosa',
  'Dourado',
  'Prata',
  'Cinza',
  'Roxo',
  'Outro'
] as const;

export const MARCAS = [
  'Apple',
  'Samsung',
  'Xiaomi',
  'Motorola',
  'LG',
  'ASUS',
  'Realme',
  'OnePlus',
  'Huawei',
  'Nokia',
  'Sony',
  'Acer',
  'Dell',
  'HP',
  'Lenovo',
  'Positivo',
  'Multilaser',
  'Outro'
] as const;

export const DEFEITOS = [
  'Não liga',
  'Não carrega',
  'Bateria viciada',
  'Tela quebrada',
  'Sem áudio',
  'Sem sinal',
  'Sem Wi-Fi',
  'Travando/Lento',
  'Molhou',
  'Troca de tela',
  'Troca de bateria',
  'Troca de conector',
  'Formatação',
  'Outro'
] as const;

export const ACESSORIOS = [
  'Carregador',
  'Cabo USB',
  'Capinha',
  'Película',
  'Chip',
  'Cartão de memória',
  'Caixa',
  'Fone',
  'Outro'
] as const;

export const MODELOS_POR_MARCA: Record<string, string[]> = {
  Apple: [
    'iPhone 8',
    'iPhone X',
    'iPhone 11',
    'iPhone 12',
    'iPhone 13',
    'iPhone 14',
    'iPhone 15',
    'iPad'
  ],
  Samsung: [
    'Galaxy A12',
    'Galaxy A23',
    'Galaxy A32',
    'Galaxy A54',
    'Galaxy S20',
    'Galaxy S21',
    'Galaxy S22',
    'Galaxy S23',
    'Galaxy Tab'
  ],
  Xiaomi: [
    'Redmi 9',
    'Redmi Note 10',
    'Redmi Note 11',
    'Redmi Note 12',
    'Poco X3',
    'Poco X5'
  ],
  Motorola: [
    'Moto G20',
    'Moto G22',
    'Moto G32',
    'Moto G52',
    'Moto G84',
    'Moto E22'
  ]
};

/**
 * Obtém modelos disponíveis para uma marca
 */
export function getModelosPorMarca(marca: string): string[] {
  return MODELOS_POR_MARCA[marca] || [];
}
