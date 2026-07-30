import { SiengeCalculoRegra, SiengeTabelaVendaColuna, SiengeTabelaVendaUnidade, SiengeVendaSituacao } from '../types';

export const SITUACAO_LABELS: Record<SiengeVendaSituacao, string> = {
  disponivel: 'Disponível',
  vendida: 'Vendida',
  permuta: 'Permuta',
  bloqueada: 'Bloqueada',
};

const SITUACAO_BY_LABEL: Record<string, SiengeVendaSituacao> = {
  disponivel: 'disponivel',
  vendida: 'vendida',
  vendido: 'vendida',
  permuta: 'permuta',
  bloqueada: 'bloqueada',
  bloqueado: 'bloqueada',
};

const DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g');

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(DIACRITICS_RE, '');
}

export function situacaoFromLabel(label: string): SiengeVendaSituacao {
  return SITUACAO_BY_LABEL[normalize(label)] || 'disponivel';
}

export function slugifyKey(label: string): string {
  return normalize(label).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'coluna';
}

// ─── Regras de cálculo (colunas calculadas: Mensal, Semestral, etc.) ──

export function getColunaBaseValue(item: SiengeTabelaVendaUnidade, colunaBaseKey: string): number {
  if (colunaBaseKey === 'valor_tabela') return item.valorTabela;
  const v = item.camposExtra[colunaBaseKey];
  if (typeof v === 'number') return v;
  return parseBrNumber(String(v ?? '0'));
}

export function calcRegraValor(item: SiengeTabelaVendaUnidade, regra: SiengeCalculoRegra): number {
  if (!regra.quantidade) return 0;
  const base = getColunaBaseValue(item, regra.colunaBaseKey);
  return (base * (regra.percentual / 100)) / regra.quantidade;
}

export function colunaBaseLabel(colunaBaseKey: string, colunas: SiengeTabelaVendaColuna[]): string {
  if (colunaBaseKey === 'valor_tabela') return 'Valor da Unidade';
  return colunas.find(c => c.key === colunaBaseKey)?.label || colunaBaseKey;
}

// ─── Validação: parcelas (quantidade x regra) devem somar a coluna base;
// soma de todas as colunas monetárias deve fechar com o Valor da Unidade. ──

export interface ValidacaoBaseGrupo {
  colunaBaseKey: string;
  label: string;
  valorBase: number;
  somaParcelas: number;
  diferenca: number;
  regras: { regra: SiengeCalculoRegra; valorParcela: number; subtotal: number }[];
}

export interface ValidacaoUnidadeResultado {
  grupos: ValidacaoBaseGrupo[];
  colunasMoeda: { coluna: SiengeTabelaVendaColuna; valor: number }[];
  somaMoeda: number;
  valorUnidade: number;
  diferencaTotal: number;
}

export function validarUnidade(
  item: SiengeTabelaVendaUnidade,
  colunas: SiengeTabelaVendaColuna[],
  regras: SiengeCalculoRegra[]
): ValidacaoUnidadeResultado {
  const baseKeys = Array.from(new Set(regras.map(r => r.colunaBaseKey)));
  const grupos: ValidacaoBaseGrupo[] = baseKeys.map(colunaBaseKey => {
    const regrasDoGrupo = regras.filter(r => r.colunaBaseKey === colunaBaseKey);
    const valorBase = getColunaBaseValue(item, colunaBaseKey);
    const detalhado = regrasDoGrupo.map(regra => {
      const valorParcela = calcRegraValor(item, regra);
      return { regra, valorParcela, subtotal: valorParcela * regra.quantidade };
    });
    const somaParcelas = sum(detalhado.map(d => d.subtotal));
    return {
      colunaBaseKey,
      label: colunaBaseLabel(colunaBaseKey, colunas),
      valorBase,
      somaParcelas,
      diferenca: valorBase - somaParcelas,
      regras: detalhado,
    };
  });

  const colunasMoeda = colunas
    .filter(c => c.tipo === 'moeda')
    .map(coluna => ({ coluna, valor: getColunaBaseValue(item, coluna.key) }));
  const somaMoeda = sum(colunasMoeda.map(c => c.valor));

  return {
    grupos,
    colunasMoeda,
    somaMoeda,
    valorUnidade: item.valorTabela,
    diferencaTotal: item.valorTabela - somaMoeda,
  };
}

function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

// ─── Números em formato BR (1.234,56) ──────────────────────────

export function parseBrNumber(raw: string): number {
  const trimmed = raw.replace(/[^\d,.\-]/g, '').trim();
  if (!trimmed) return 0;
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

export function formatBrNumber(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── CSV (padrão Excel BR: ';' e decimal ',') ──────────────────

function parseCsvLines(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/\r\n/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim().length > 0));
}

function csvField(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportSiengeVendasCsv(
  unidades: SiengeTabelaVendaUnidade[],
  colunas: SiengeTabelaVendaColuna[],
  regras: SiengeCalculoRegra[]
): string {
  const delimiter = ';';
  const sortedColunas = [...colunas].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedRegras = [...regras].sort((a, b) => a.sortOrder - b.sortOrder);
  const header = [
    'Unidade',
    'Valor da Unidade',
    ...sortedColunas.map(c => c.label),
    ...sortedRegras.map(r => r.titulo),
    'Situação',
    'Comprador',
    'Descrição',
  ];
  const lines = [header.map(h => csvField(h, delimiter)).join(delimiter)];
  const sorted = [...unidades].sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR', { numeric: true }));
  for (const item of sorted) {
    const row = [
      item.unidade,
      formatBrNumber(item.valorTabela),
      ...sortedColunas.map(c => {
        const v = item.camposExtra[c.key];
        if (c.tipo === 'texto') return v != null ? String(v) : '';
        return formatBrNumber(typeof v === 'number' ? v : parseBrNumber(String(v ?? '0')));
      }),
      ...sortedRegras.map(r => formatBrNumber(calcRegraValor(item, r))),
      SITUACAO_LABELS[item.situacao],
      item.compradorAtual || '',
      item.descricao || '',
    ];
    lines.push(row.map(f => csvField(String(f), delimiter)).join(delimiter));
  }
  return '﻿' + lines.join('\r\n');
}

export interface ImportSiengeVendasResult {
  unidades: SiengeTabelaVendaUnidade[];
  novasColunas: SiengeTabelaVendaColuna[];
}

// Casa pelo nome da unidade para reaproveitar o id de linhas já existentes —
// importante para não quebrar o vínculo com sienge_vendas (snapshot de venda)
// nem disparar recriação de histórico ao reimportar uma tabela já existente.
export function parseSiengeVendasCsv(
  text: string,
  projectId: string,
  existingUnidades: SiengeTabelaVendaUnidade[],
  existingColunas: SiengeTabelaVendaColuna[],
  existingRegraTitulos: string[]
): ImportSiengeVendasResult {
  const cleaned = text.replace(/^﻿/, '');
  const firstLine = cleaned.split('\n')[0] || '';
  const delimiter = firstLine.includes(';') ? ';' : ',';
  const rows = parseCsvLines(cleaned, delimiter);
  if (rows.length < 2) return { unidades: [], novasColunas: [] };

  const header = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1);
  const regraTitulosNorm = new Set(existingRegraTitulos.map(normalize));
  const existingByUnidade = new Map(existingUnidades.map(u => [normalize(u.unidade), u]));

  type ColEntry =
    | { type: 'unidade' | 'valor' | 'situacao' | 'descricao' | 'comprador' | 'regra' }
    | { type: 'coluna'; coluna: SiengeTabelaVendaColuna };

  const novasColunas: SiengeTabelaVendaColuna[] = [];
  let nextSortOrder = existingColunas.length > 0 ? Math.max(...existingColunas.map(c => c.sortOrder)) + 1 : 1;
  const now = new Date().toISOString();

  const colMap: ColEntry[] = header.map(h => {
    const n = normalize(h);
    if (n === 'unidade') return { type: 'unidade' };
    if (n === 'valor da unidade' || n === 'valor' || n === 'valor de tabela' || n === 'valor tabela') return { type: 'valor' };
    if (n === 'situacao') return { type: 'situacao' };
    if (n === 'descricao') return { type: 'descricao' };
    if (n === 'comprador') return { type: 'comprador' };
    if (regraTitulosNorm.has(n)) return { type: 'regra' };
    let coluna = existingColunas.find(c => normalize(c.label) === n) || novasColunas.find(c => normalize(c.label) === n);
    if (!coluna) {
      coluna = {
        id: crypto.randomUUID(),
        projectId,
        key: slugifyKey(h),
        label: h,
        tipo: 'moeda',
        sortOrder: nextSortOrder++,
        createdAt: now,
        updatedAt: now,
      };
      novasColunas.push(coluna);
    }
    return { type: 'coluna', coluna };
  });

  const unidades: SiengeTabelaVendaUnidade[] = [];
  for (const cells of dataRows) {
    let unidadeNome = '';
    let valorTabela = 0;
    let situacao: SiengeVendaSituacao = 'disponivel';
    let descricao: string | null = null;
    let comprador: string | null = null;
    const camposExtra: Record<string, number | string> = {};

    colMap.forEach((entry, idx) => {
      const raw = (cells[idx] ?? '').trim();
      if (entry.type === 'unidade') unidadeNome = raw;
      else if (entry.type === 'valor') valorTabela = parseBrNumber(raw);
      else if (entry.type === 'situacao') situacao = situacaoFromLabel(raw);
      else if (entry.type === 'descricao') descricao = raw || null;
      else if (entry.type === 'comprador') comprador = raw || null;
      else if (entry.type === 'coluna') {
        camposExtra[entry.coluna.key] = entry.coluna.tipo === 'texto' ? raw : parseBrNumber(raw);
      }
    });

    if (!unidadeNome) continue;
    const existing = existingByUnidade.get(normalize(unidadeNome));
    unidades.push({
      id: existing?.id || crypto.randomUUID(),
      projectId,
      unidade: unidadeNome,
      valorTabela,
      situacao,
      camposExtra,
      descricao,
      compradorAtual: comprador ?? existing?.compradorAtual ?? null,
      frozenSince: existing?.frozenSince ?? null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
  }

  return { unidades, novasColunas };
}
