import { Project, SiengeTabelaVendaUnidade, SiengeVenda, SiengeTitle, SiengeCategoriaOrcamento, SiengeCentroCusto } from '../types';
import { ALL_CATEGORIAS, CategoriaAnalysis } from './siengeMetasAnalysis';

// 2% do VGV é o teto de orçamento de marketing/comercial adotado pela Uchôa —
// mesmo percentual usado em toda a análise de metas (ver ORCAMENTO_ALVO_PCT em
// SiengeMetasModal.tsx).
export const ORCAMENTO_PCT = 0.02;

// ─── Camada 1 — VGV real (vendas efetivamente confirmadas) ──────────────────

// VGV real "ativo" num instante: soma do valor congelado das vendas cuja janela
// [dataVenda, dataDistrato) cobre `ateData`. Uma venda distratada deixa de contar
// a partir do momento do distrato — o VGV real pode cair, não é só crescente.
export function getVgvRealAcumulado(vendas: SiengeVenda[], ateData: Date): number {
  return vendas
    .filter(v => new Date(v.dataVenda) <= ateData && (!v.dataDistrato || new Date(v.dataDistrato) > ateData))
    .reduce((s, v) => s + v.valorCongelado, 0);
}

export function getOrcamentoRealAcumulado(vendas: SiengeVenda[], ateData: Date): number {
  return getVgvRealAcumulado(vendas, ateData) * ORCAMENTO_PCT;
}

// ─── Gasto real (títulos Sienge), sempre limitado ao início do controle ─────

export function getGastoRealAcumulado(
  titles: SiengeTitle[],
  projectName: string,
  controleInicio: string, // YYYY-MM-DD
  ateData: Date,
  filtro?: { centroCusto: SiengeCentroCusto; categoria: string },
): number {
  const ateStr = ateData.toISOString().slice(0, 10);
  return titles
    .filter(t =>
      t.empreendimento === projectName &&
      t.vencimento && t.vencimento >= controleInicio && t.vencimento <= ateStr &&
      (!filtro || (t.centroCusto === filtro.centroCusto && t.categoria === filtro.categoria))
    )
    .reduce((s, t) => s + t.valor, 0);
}

// Mesma coisa, para um conjunto de empreendimentos de uma vez (usado no gráfico).
export function getGastoRealAcumuladoProjetos(
  titles: SiengeTitle[],
  projects: Project[],
  controleInicio: string,
  ateData: Date,
): number {
  return projects.reduce((s, p) => s + getGastoRealAcumulado(titles, p.name, controleInicio, ateData), 0);
}

// ─── Tabela de Vendas: saldo, teto do produto e VGV médio disponível ────────

export function getSaldoRemanescente(unidades: SiengeTabelaVendaUnidade[]): number {
  return unidades
    .filter(u => u.situacao === 'disponivel' || u.situacao === 'bloqueada')
    .reduce((s, u) => s + u.valorTabela, 0);
}

export function getTetoTotalProduto(unidades: SiengeTabelaVendaUnidade[]): number {
  return getSaldoRemanescente(unidades) * ORCAMENTO_PCT;
}

// % do envelope total de 2% (já vendido + ainda disponível) que já foi
// desbloqueado por vendas confirmadas — não é a mesma coisa que estouro/economia,
// é um indicador de longo prazo de quanto do produto já "girou".
export function getPctTetoConsumido(orcamentoRealAcumulado: number, tetoTotalProduto: number): number {
  const envelope = orcamentoRealAcumulado + tetoTotalProduto;
  return envelope > 0 ? (orcamentoRealAcumulado / envelope) * 100 : 0;
}

// ─── Ritmo do mês: sinal de alerta, nunca decide estouro ────────────────────

export type RitmoMes = 'acima' | 'dentro' | 'abaixo';

export function getRitmoMes(gastoRealDoMes: number, orcamentoMetaDoMes: number): RitmoMes {
  if (orcamentoMetaDoMes <= 0) return 'dentro';
  if (gastoRealDoMes > orcamentoMetaDoMes) return 'acima';
  if (gastoRealDoMes < orcamentoMetaDoMes * 0.7) return 'abaixo';
  return 'dentro';
}

// ─── Camada 1 por categoria — mesma estrutura de CategoriaAnalysis usada na Camada 2 ───

export interface ProjectBudgetReal {
  project: Project;
  vgvRealAcumulado: number;
  orcamentoRealAcumulado: number;
  gastoRealAcumulado: number;
  diferencaReal: number;
  categorias: CategoriaAnalysis[];
  saldoRemanescente: number;
  tetoTotalProduto: number;
  pctTetoConsumido: number;
}

export function analyzeProjectBudgetReal(
  project: Project,
  unidades: SiengeTabelaVendaUnidade[],
  vendas: SiengeVenda[],
  titles: SiengeTitle[],
  categoriaOrcamento: SiengeCategoriaOrcamento[],
  controleInicio: string,
  ateData: Date,
): ProjectBudgetReal {
  const unidadesDoProjeto = unidades.filter(u => u.projectId === project.id);
  const vendasDoProjeto = vendas.filter(v => v.projectId === project.id);

  const vgvReal = getVgvRealAcumulado(vendasDoProjeto, ateData);
  const orcamentoRealAcumulado = vgvReal * ORCAMENTO_PCT;

  const categorias: CategoriaAnalysis[] = ALL_CATEGORIAS.map(({ centroCusto, categoria }) => {
    const alocacao = categoriaOrcamento.find(c => c.projectId === project.id && c.centroCusto === centroCusto && c.categoria === categoria);
    const percentual = alocacao?.percentual || 0;
    const orcamento = vgvReal * (percentual / 100);
    const gasto = getGastoRealAcumulado(titles, project.name, controleInicio, ateData, { centroCusto, categoria });
    const pctGastoDoVgv = vgvReal > 0 ? (gasto / vgvReal) * 100 : 0;
    return { centroCusto, categoria, percentual, orcamento, gasto, diferenca: orcamento - gasto, pctGastoDoVgv };
  });

  const gastoRealAcumulado = getGastoRealAcumulado(titles, project.name, controleInicio, ateData);
  const saldoRemanescente = getSaldoRemanescente(unidadesDoProjeto);
  const tetoTotalProduto = saldoRemanescente * ORCAMENTO_PCT;

  return {
    project,
    vgvRealAcumulado: vgvReal,
    orcamentoRealAcumulado,
    gastoRealAcumulado,
    diferencaReal: orcamentoRealAcumulado - gastoRealAcumulado,
    categorias,
    saldoRemanescente,
    tetoTotalProduto,
    pctTetoConsumido: getPctTetoConsumido(orcamentoRealAcumulado, tetoTotalProduto),
  };
}
