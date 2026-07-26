import { SiengeCentroCusto } from '../types';

export const CENTRO_CUSTO_LABELS: Record<SiengeCentroCusto, string> = {
  comercial: 'Comercial',
  marketing: 'Marketing',
};

// Categoria -> lista de subcategorias, por centro de custo.
export const SIENGE_CATEGORIAS: Record<SiengeCentroCusto, Record<string, string[]>> = {
  marketing: {
    'Mídia on': [
      'Meta Ads',
      'Google Ads',
      'Portais imobiliários',
      'Aplicativos',
      'WhatsApp Business API',
      'Influenciadores digitais',
    ],
    'Mídia off': [
      'Tapume/Fachada',
      'KVS (Outdoor, Busdoor, painel)',
      'Imprensa (Rádio, TV, assessoria)',
      'Impresso (Papelaria Divulgação)',
      'Sinalização',
    ],
    'Relacionamento': [
      'Eventos de lançamento',
      'Buffet/catering',
      'Brindes e kits',
      'Ações com corretores',
      'Ações com Clientes',
      'Programa de indicação',
    ],
    'Produção capex': [
      'Fotógrafo',
      'Vídeo/audiovisual',
      'Decorado',
      'Stand de vendas',
      'Maquete física ou 3D',
      'Design/Decoração',
      'Tecnologia',
    ],
    'Reserva Técnica': [
      'Teste de novos canais',
      'Imprevistos/ajuste de rota',
      'Consultoria pontual',
    ],
  },
  comercial: {
    'Comissionamento': [
      'Comissão',
      'Premiação meta',
      'Incentivo',
    ],
    'Estrutura de Plantão': [
      'Despesa Fixa',
      'Despesa pontual',
    ],
    'Capacitação': [
      'Convidado',
      'Cursos e palestras',
      'Material de argumentação de venda',
    ],
    'Operação Comercial': [
      'CRM',
      'Ferramentas de Gestão',
    ],
    'Jurídico/Documentação': [
      'Análise de Crédito',
      'Suporte Documental a venda',
    ],
  },
};

export function categoriasFor(centroCusto?: SiengeCentroCusto): string[] {
  if (!centroCusto) return [];
  return Object.keys(SIENGE_CATEGORIAS[centroCusto]);
}

export function subcategoriasFor(centroCusto?: SiengeCentroCusto, categoria?: string): string[] {
  if (!centroCusto || !categoria) return [];
  return SIENGE_CATEGORIAS[centroCusto][categoria] || [];
}
