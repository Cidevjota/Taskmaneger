import { LpCorretorPlanta, LpCorretorPublicColuna, LpCorretorPublicRegra, LpCorretorPublicUnidade, SiengeColunaTipo, SiengeVendaSituacao } from '../types';

export const LP_CORRETOR_BASE_PATH = '/tabela';
export const REGRA_PREFIX = 'regra:';

/** Endereço público completo de uma LP, para copiar/compartilhar. */
export function lpCorretorUrl(slug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${LP_CORRETOR_BASE_PATH}/${slug}`;
}

/** Slug default a partir do nome do empreendimento (editável no painel). */
export function slugifyLpSlug(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Monta o link de reserva no CVCRM. `{unidade}` é o placeholder; um template
 * sem ele funciona como link único do empreendimento.
 */
export function buildReservaUrl(template: string | null, unidade: string): string | null {
  const t = template?.trim();
  if (!t) return null;
  return t.replace(/\{unidade\}/gi, encodeURIComponent(unidade));
}

// Colunas reais e calculadas compartilham a mesma sequência visual (mesmo
// critério de mergeColunasRegras na tabela interna), então a LP espelha a
// ordem configurada lá.
export interface LpColunaEntry {
  id: string;
  label: string;
  tipo: SiengeColunaTipo | 'calculada';
  read: (u: LpCorretorPublicUnidade) => number | string | undefined;
}

export function mergeLpColunas(colunas: LpCorretorPublicColuna[], regras: LpCorretorPublicRegra[]): LpColunaEntry[] {
  const entries: { sortOrder: number; isColuna: boolean; entry: LpColunaEntry }[] = [
    ...colunas.map(c => ({
      sortOrder: c.sortOrder,
      isColuna: true,
      entry: { id: c.key, label: c.label, tipo: c.tipo, read: (u: LpCorretorPublicUnidade) => u.camposExtra[c.key] },
    })),
    ...regras.map(r => ({
      sortOrder: r.sortOrder,
      isColuna: false,
      entry: { id: `${REGRA_PREFIX}${r.id}`, label: r.titulo, tipo: 'calculada' as const, read: (u: LpCorretorPublicUnidade) => u.calculados[r.id] },
    })),
  ];
  entries.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.isColuna === b.isColuna ? 0 : a.isColuna ? -1 : 1;
  });
  return entries.map(e => e.entry);
}

export function formatMoeda(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Valor de célula já formatado conforme o tipo da coluna; '—' quando vazio. */
export function formatLpValor(tipo: LpColunaEntry['tipo'], value: number | string | undefined): string {
  if (value == null || value === '') return '—';
  if (tipo === 'texto') return String(value);
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!isFinite(n) || n === 0) return tipo === 'area' ? '—' : '—';
  if (tipo === 'area') return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`;
  if (tipo === 'numero') return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return formatMoeda(n);
}

export const LP_SITUACAO_LABELS: Record<SiengeVendaSituacao, string> = {
  disponivel: 'Disponível',
  vendida: 'Vendida',
  permuta: 'Permuta',
  bloqueada: 'Bloqueada',
};

const limpar = (lista: string[] | undefined) => (lista || []).map(s => s.trim().toLowerCase()).filter(Boolean);

/**
 * Plantas de uma unidade, em ordem de especificidade:
 *
 *   1. Plantas que listam a unidade explicitamente — planta própria. Ganham de
 *      tudo e, mais importante, **desligam as plantas por terminação** para essa
 *      unidade: a cobertura 1601 termina em '01' como a 101 e a 201, mas tem
 *      planta própria e não pode herdar a do tipo.
 *   2. Plantas por terminação (ex.: '01' pega 101, 201, 1101), aplicadas só a
 *      quem não tem planta própria.
 *   3. Plantas gerais (sem unidades e sem terminações) — o pavimento, que vale
 *      para o empreendimento inteiro, inclusive para as coberturas.
 */
export function plantasDaUnidade(plantas: LpCorretorPlanta[], unidade: string): LpCorretorPlanta[] {
  const alvo = unidade.trim().toLowerCase();

  const proprias = plantas.filter(p => limpar(p.unidades).includes(alvo));
  const semLista = plantas.filter(p => limpar(p.unidades).length === 0);

  const porTerminacao = proprias.length > 0
    ? []
    : semLista.filter(p => limpar(p.terminacoes).some(t => alvo.endsWith(t)));

  const gerais = semLista.filter(p => limpar(p.terminacoes).length === 0);

  return [...proprias, ...porTerminacao, ...gerais];
}

/** Primeira coluna de área do empreendimento — base do filtro de metragem. */
export function colunaMetragem(colunas: LpCorretorPublicColuna[]): LpCorretorPublicColuna | null {
  return colunas.find(c => c.tipo === 'area') || null;
}

/** Valor numérico de uma coluna para a unidade; 0 quando ausente ou textual. */
export function valorNumerico(unidade: LpCorretorPublicUnidade, key: string): number {
  const v = unidade.camposExtra[key];
  if (typeof v === 'number') return v;
  const n = Number(String(v ?? '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}

/** Faixa [min, max] de uma lista de números, arredondada para fora. */
export function faixaDe(valores: number[]): [number, number] {
  if (valores.length === 0) return [0, 0];
  return [Math.floor(Math.min(...valores)), Math.ceil(Math.max(...valores))];
}

/** Ordenação natural das unidades (101, 102, ..., 1001). */
export function sortUnidades(unidades: LpCorretorPublicUnidade[]): LpCorretorPublicUnidade[] {
  return [...unidades].sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR', { numeric: true }));
}
