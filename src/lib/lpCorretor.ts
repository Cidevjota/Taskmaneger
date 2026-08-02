import { LpCorretorPublicColuna, LpCorretorPublicRegra, LpCorretorPublicUnidade, SiengeColunaTipo, SiengeVendaSituacao } from '../types';

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

/** Ordenação natural das unidades (101, 102, ..., 1001). */
export function sortUnidades(unidades: LpCorretorPublicUnidade[]): LpCorretorPublicUnidade[] {
  return [...unidades].sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR', { numeric: true }));
}
