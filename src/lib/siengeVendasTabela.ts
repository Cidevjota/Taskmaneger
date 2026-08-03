import * as XLSX from 'xlsx';
import { SiengeCalculoRegra, SiengeTabelaVendaColuna, SiengeTabelaVendaUnidade, SiengeValidacao, SiengeVendaSituacao } from '../types';

export const SITUACAO_LABELS: Record<SiengeVendaSituacao, string> = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  vendida: 'Vendida',
  permuta: 'Permuta',
  bloqueada: 'Bloqueada',
};

const SITUACAO_BY_LABEL: Record<string, SiengeVendaSituacao> = {
  disponivel: 'disponivel',
  reservado: 'reservado',
  reservada: 'reservado',
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

// ─── Ordem unificada: colunas reais e colunas calculadas (regras) dividem a
// mesma sequência visual na tabela, mesmo tendo sortOrder em namespaces
// separados — o merge só usa esse número pra intercalar, empate favorece a
// coluna real. ──

export type ColunaOuRegra =
  | { kind: 'coluna'; item: SiengeTabelaVendaColuna }
  | { kind: 'regra'; item: SiengeCalculoRegra };

export function mergeColunasRegras(colunas: SiengeTabelaVendaColuna[], regras: SiengeCalculoRegra[]): ColunaOuRegra[] {
  const merged: ColunaOuRegra[] = [
    ...colunas.map(item => ({ kind: 'coluna' as const, item })),
    ...regras.map(item => ({ kind: 'regra' as const, item })),
  ];
  return merged.sort((a, b) => {
    if (a.item.sortOrder !== b.item.sortOrder) return a.item.sortOrder - b.item.sortOrder;
    return a.kind === b.kind ? 0 : a.kind === 'coluna' ? -1 : 1;
  });
}

// ─── Regras de cálculo (colunas calculadas: Mensal, Semestral, etc.) ──

export function getColunaBaseValue(item: SiengeTabelaVendaUnidade, colunaBaseKey: string): number {
  if (colunaBaseKey === 'valor_tabela') return item.valorTabela;
  const v = item.camposExtra[colunaBaseKey];
  if (typeof v === 'number') return v;
  return parseBrNumber(String(v ?? '0'));
}

// Quantidade pode ser um número fixo digitado ou o valor de outra coluna da
// mesma unidade (ex.: dividir pela metragem em vez de um número fixo de parcelas).
export function getRegraQuantidade(item: SiengeTabelaVendaUnidade, regra: SiengeCalculoRegra): number {
  if (regra.quantidadeColunaKey) return getColunaBaseValue(item, regra.quantidadeColunaKey);
  return regra.quantidade;
}

// Arredonda pra 6 casas — dividir por uma quantidade "feia" (ex.: 48) gera
// dízima; guardar full float acumula ruído que aparece como diferença > 0 no
// painel Validar. A exibição continua com 2 casas (formatCurrency), só o
// valor usado internamente (cálculo, validação, soma, export) ganha essa
// precisão extra. Usado em toda a Tabela de Vendas, não só nas regras.
export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function calcRegraValor(item: SiengeTabelaVendaUnidade, regra: SiengeCalculoRegra): number {
  const quantidade = getRegraQuantidade(item, regra);
  if (!quantidade) return 0;
  const base = getColunaBaseValue(item, regra.colunaBaseKey);
  const percentualValor = base * (regra.percentual / 100);
  const valor = regra.operacao === 'multiplicar' ? percentualValor * quantidade : percentualValor / quantidade;
  return round6(valor);
}

export function colunaBaseLabel(colunaBaseKey: string, colunas: SiengeTabelaVendaColuna[]): string {
  if (colunaBaseKey === 'valor_tabela') return 'Valor da Unidade';
  return colunas.find(c => c.key === colunaBaseKey)?.label || colunaBaseKey;
}

// ─── Validações (Validar Tabela) — calculadas aqui pra serem reaproveitadas
// tanto no painel de configuração (ValidarPanel) quanto nas colunas da tabela
// principal, que espelham o mesmo cálculo pra todas as unidades. ──

export const REGRA_KEY_PREFIX = 'regra:';

// Chaves de coluna real resolvem via getColunaBaseValue; chaves prefixadas com
// "regra:" apontam pra uma coluna calculada (regra de cálculo), que não fica em
// camposExtra — precisa recalcular na hora via calcRegraValor.
export function resolveOperando(item: SiengeTabelaVendaUnidade, key: string, regras: SiengeCalculoRegra[]): number {
  if (key.startsWith(REGRA_KEY_PREFIX)) {
    const regra = regras.find(r => r.id === key.slice(REGRA_KEY_PREFIX.length));
    return regra ? calcRegraValor(item, regra) : 0;
  }
  return getColunaBaseValue(item, key);
}

// Tolerância de 1 centavo — cobre tanto ruído de ponto flutuante binário
// (ex.: 0.010000000000047748) quanto pequenos arredondamentos legítimos da
// tabela; acima de R$0,01 de diferença já conta como divergência real.
export function isDiferencaOk(diferenca: number): boolean {
  return Math.abs(Math.round(diferenca * 100)) <= 1;
}

// (quantidade₁ × coluna₁) + (quantidade₂ × coluna₂) + ... deve ser igual à
// coluna de referência — ex.: (48 × Mensal) + (7 × Semestral) = Custo de Construção.
export function calcValidacaoParcelas(item: SiengeTabelaVendaUnidade, validacao: SiengeValidacao, regras: SiengeCalculoRegra[]) {
  const soma = round6(validacao.termos.reduce((s, t) => s + (t.quantidade ?? 0) * resolveOperando(item, t.colunaKey, regras), 0));
  const referencia = validacao.referenciaKey ? resolveOperando(item, validacao.referenciaKey, regras) : 0;
  return { soma, referencia, diferenca: round6(soma - referencia) };
}

// (±coluna₁) + (±coluna₂) + ... deve ser igual ao Valor da Unidade — ex.:
// Custo de Construção + Adesão Total = Valor da Unidade.
export function calcValidacaoValorUnidade(item: SiengeTabelaVendaUnidade, validacao: SiengeValidacao, regras: SiengeCalculoRegra[]) {
  const soma = round6(validacao.termos.reduce((s, t) => s + (t.sinal === '-' ? -1 : 1) * resolveOperando(item, t.colunaKey, regras), 0));
  return { soma, valorUnidade: item.valorTabela, diferenca: round6(soma - item.valorTabela) };
}

// Uma unidade "tem pendência" se qualquer validação configurada (de qualquer
// um dos dois tipos) bater fora da tolerância — usada tanto pelo badge da
// tabela quanto pelo filtro "Pendentes" da barra superior, que precisam
// concordar em qual unidade conta como pendente.
export function unidadeValidacaoPendente(item: SiengeTabelaVendaUnidade, validacoes: SiengeValidacao[], regras: SiengeCalculoRegra[]): boolean {
  return validacoes.some(v => {
    const r = v.tipo === 'parcelas' ? calcValidacaoParcelas(item, v, regras) : calcValidacaoValorUnidade(item, v, regras);
    return !isDiferencaOk(r.diferenca);
  });
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
  const merged = mergeColunasRegras(colunas, regras);
  const header = [
    'Unidade',
    'Valor da Unidade',
    ...merged.map(m => m.kind === 'coluna' ? m.item.label : m.item.titulo),
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
      ...merged.map(m => {
        if (m.kind === 'regra') return formatBrNumber(calcRegraValor(item, m.item));
        const v = item.camposExtra[m.item.key];
        if (m.item.tipo === 'texto') return v != null ? String(v) : '';
        return formatBrNumber(typeof v === 'number' ? v : parseBrNumber(String(v ?? '0')));
      }),
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
  return parseSiengeVendasRows(rows, projectId, existingUnidades, existingColunas, existingRegraTitulos);
}

export function parseSiengeVendasRows(
  rows: string[][],
  projectId: string,
  existingUnidades: SiengeTabelaVendaUnidade[],
  existingColunas: SiengeTabelaVendaColuna[],
  existingRegraTitulos: string[]
): ImportSiengeVendasResult {
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
    if (n === 'situacao' || n === 'disponibilidade' || n === 'status') return { type: 'situacao' };
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
      situacaoMotivo: existing?.situacaoMotivo ?? null,
      frozenSince: existing?.frozenSince ?? null,
      // Importação nunca confirma venda: repassa o carimbo já existente para
      // não gerar snapshot em sienge_vendas ao reimportar a tabela.
      vendaConfirmadaEm: existing?.vendaConfirmadaEm ?? null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
  }

  return { unidades, novasColunas };
}

// ─── Excel (.xlsx / .xls) — mesma estrutura de colunas do CSV, primeira aba ──

function xlsxCellToString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return v.toLocaleDateString('pt-BR');
  return String(v).trim();
}

export async function parseSiengeVendasXlsx(
  file: File,
  projectId: string,
  existingUnidades: SiengeTabelaVendaUnidade[],
  existingColunas: SiengeTabelaVendaColuna[],
  existingRegraTitulos: string[]
): Promise<ImportSiengeVendasResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { unidades: [], novasColunas: [] };

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });
  const rows = raw
    .map(r => r.map(xlsxCellToString))
    .filter(r => r.some(f => f.trim().length > 0));

  return parseSiengeVendasRows(rows, projectId, existingUnidades, existingColunas, existingRegraTitulos);
}
