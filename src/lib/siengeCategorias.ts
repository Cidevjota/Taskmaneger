import { SiengeCentroCusto, SiengeCentroCustoDef, SiengeCategoriaDef, SiengeSubcategoriaDef } from '../types';

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
    'Produção': [
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

// ─── Taxonomia dinâmica (editável pelo painel de configuração) ────────────
// Substitui SIENGE_CATEGORIAS acima onde a lista precisa refletir edições do
// usuário (criar/lançar título). O dashboard de Metas/Orçamento continua na
// lista estática, pois o % de orçamento é alocado só para Comercial/Marketing.

export interface SiengeTaxonomy {
  centrosCusto: { value: string; label: string }[];
  categoriasPorCentro: Record<string, string[]>;
  subcategoriasPorCategoria: Record<string, { id: string; nome: string }[]>; // key: categoriaId
  categoriaIdFor: Record<string, string>; // key: `${centroCusto}::${categoria}` -> categoriaId
}

const taxonomyKey = (centroCusto: string, categoria: string) => `${centroCusto}::${categoria}`;

export function buildSiengeTaxonomy(
  centros: SiengeCentroCustoDef[],
  categorias: SiengeCategoriaDef[],
  subcategorias: SiengeSubcategoriaDef[],
): SiengeTaxonomy {
  const centrosCusto = [
    ...Object.entries(CENTRO_CUSTO_LABELS).map(([value, label]) => ({ value, label })),
    ...centros
      .filter(c => !CENTRO_CUSTO_LABELS[c.nome as SiengeCentroCusto])
      .map(c => ({ value: c.nome, label: c.nome })),
  ];

  const categoriasPorCentro: Record<string, string[]> = {};
  const categoriaIdFor: Record<string, string> = {};
  categorias.forEach(c => {
    (categoriasPorCentro[c.centroCusto] ||= []).push(c.categoria);
    categoriaIdFor[taxonomyKey(c.centroCusto, c.categoria)] = c.id;
  });

  const subcategoriasPorCategoria: Record<string, { id: string; nome: string }[]> = {};
  subcategorias.forEach(s => {
    (subcategoriasPorCategoria[s.categoriaId] ||= []).push({ id: s.id, nome: s.subcategoria });
  });

  return { centrosCusto, categoriasPorCentro, subcategoriasPorCategoria, categoriaIdFor };
}

export function taxonomyCategoriasFor(taxonomy: SiengeTaxonomy, centroCusto?: string): string[] {
  if (!centroCusto) return [];
  return taxonomy.categoriasPorCentro[centroCusto] || [];
}

export function taxonomySubcategoriasFor(taxonomy: SiengeTaxonomy, centroCusto?: string, categoria?: string): string[] {
  if (!centroCusto || !categoria) return [];
  const categoriaId = taxonomy.categoriaIdFor[taxonomyKey(centroCusto, categoria)];
  if (!categoriaId) return [];
  return (taxonomy.subcategoriasPorCategoria[categoriaId] || []).map(s => s.nome);
}
