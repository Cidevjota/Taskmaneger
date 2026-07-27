import { Project, SiengeTitle, SiengeProjectMeta, SiengeCategoriaOrcamento, SiengeCentroCusto, SiengeTabelaVendaUnidade } from '../types';
import { SIENGE_CATEGORIAS } from './siengeCategorias';

export const ALL_CATEGORIAS: { centroCusto: SiengeCentroCusto; categoria: string }[] =
  (Object.keys(SIENGE_CATEGORIAS) as SiengeCentroCusto[]).flatMap(cc =>
    Object.keys(SIENGE_CATEGORIAS[cc]).map(categoria => ({ centroCusto: cc, categoria }))
  );

export interface CategoriaAnalysis {
  centroCusto: SiengeCentroCusto;
  categoria: string;
  percentual: number;
  orcamento: number;
  gasto: number;
  diferenca: number;
  pctGastoDoVgv: number;
}

export interface ProjectAnalysis {
  project: Project;
  vgvMeta: number;
  vgvEstimado: boolean; // true quando o VGV do mês não foi definido e foi calculado a partir do VGV/unidades totais do empreendimento
  unidadesMeta: number;
  categorias: CategoriaAnalysis[];
  totalOrcamento: number;
  totalGasto: number;
  totalDiferenca: number;
}

function monthKeyOf(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}`;
}

// Unidades da Tabela de Vendas ainda com situação "disponível" — base do preço
// médio usado para estimar o VGV de metas por unidade.
export function getUnidadesDisponiveis(unidades: SiengeTabelaVendaUnidade[]): SiengeTabelaVendaUnidade[] {
  return unidades.filter(u => u.situacao === 'disponivel');
}

// VGV médio das unidades disponíveis (valor de tabela ÷ quantidade) — vem
// diretamente da Tabela de Vendas do empreendimento, não de nenhum total manual.
export function getVgvMedioDisponivel(unidades: SiengeTabelaVendaUnidade[]): number {
  const disponiveis = getUnidadesDisponiveis(unidades);
  if (disponiveis.length === 0) return 0;
  return disponiveis.reduce((s, u) => s + u.valorTabela, 0) / disponiveis.length;
}

// Preço médio por unidade do empreendimento, usado para estimar o VGV de um mês
// quando a meta define apenas a quantidade de unidades (sem VGV explícito): o VGV
// estimado é unidades × VGV médio disponível na Tabela de Vendas do empreendimento.
export function pricePerUnitFor(project: Project, tabelaVendas: SiengeTabelaVendaUnidade[]): number {
  return getVgvMedioDisponivel(tabelaVendas.filter(u => u.projectId === project.id));
}

// Análise de um empreendimento para um único mês (orçamento por categoria vs gasto real).
export function analyzeProjectMonth(
  project: Project,
  titles: SiengeTitle[],
  projectMetas: SiengeProjectMeta[],
  categoriaOrcamento: SiengeCategoriaOrcamento[],
  year: number,
  month0: number,
  tabelaVendas: SiengeTabelaVendaUnidade[] = [],
  controleInicio: string = '0000-01-01',
): ProjectAnalysis {
  const monthKey = monthKeyOf(year, month0);
  // Não existe histórico de gasto confiável antes do início do controle de
  // orçamento — títulos anteriores a essa data são ignorados nesta e nas
  // demais análises de gasto, para não inflar o gasto "real" com histórico.
  const periodTitles = titles.filter(t => t.vencimento?.startsWith(monthKey) && t.vencimento >= controleInicio);

  const meta = projectMetas.find(m => m.projectId === project.id && m.ano === year && m.mes === month0 + 1);
  const unidadesMeta = meta?.unidadesMeta || 0;
  const vgvExplicito = meta?.vgvMeta || 0;
  const vgvEstimado = vgvExplicito === 0 && unidadesMeta > 0;
  const vgvMeta = vgvExplicito > 0 ? vgvExplicito : pricePerUnitFor(project, tabelaVendas) * unidadesMeta;

  const categorias = ALL_CATEGORIAS.map(({ centroCusto, categoria }) => {
    const alocacao = categoriaOrcamento.find(c => c.projectId === project.id && c.centroCusto === centroCusto && c.categoria === categoria);
    const percentual = alocacao?.percentual || 0;
    const orcamento = vgvMeta * (percentual / 100);
    const gasto = periodTitles
      .filter(t => t.empreendimento === project.name && t.centroCusto === centroCusto && t.categoria === categoria)
      .reduce((s, t) => s + t.valor, 0);
    const pctGastoDoVgv = vgvMeta > 0 ? (gasto / vgvMeta) * 100 : 0;
    return { centroCusto, categoria, percentual, orcamento, gasto, diferenca: orcamento - gasto, pctGastoDoVgv };
  });

  const totalOrcamento = categorias.reduce((s, c) => s + c.orcamento, 0);
  const totalGasto = categorias.reduce((s, c) => s + c.gasto, 0);

  return { project, vgvMeta, vgvEstimado, unidadesMeta, categorias, totalOrcamento, totalGasto, totalDiferenca: totalOrcamento - totalGasto };
}

// Análise por empreendimento para o período selecionado: um mês específico, ou
// (quando month é null, "Ver Todos") a soma dos 12 meses do ano informado.
export function analyzeProjectsForPeriod(
  projects: Project[],
  titles: SiengeTitle[],
  projectMetas: SiengeProjectMeta[],
  categoriaOrcamento: SiengeCategoriaOrcamento[],
  year: number,
  month: number | null,
  tabelaVendas: SiengeTabelaVendaUnidade[] = [],
  controleInicio: string = '0000-01-01',
): ProjectAnalysis[] {
  if (month !== null) {
    return projects
      .map(p => analyzeProjectMonth(p, titles, projectMetas, categoriaOrcamento, year, month, tabelaVendas, controleInicio))
      .filter(a => a.vgvMeta > 0);
  }

  return projects
    .map(project => {
      const perMonth = Array.from({ length: 12 }, (_, m) => analyzeProjectMonth(project, titles, projectMetas, categoriaOrcamento, year, m, tabelaVendas, controleInicio))
        .filter(a => a.vgvMeta > 0);
      if (perMonth.length === 0) return null;

      const vgvMeta = perMonth.reduce((s, a) => s + a.vgvMeta, 0);
      const vgvEstimado = perMonth.some(a => a.vgvEstimado);
      const unidadesMeta = perMonth.reduce((s, a) => s + a.unidadesMeta, 0);
      const categorias: CategoriaAnalysis[] = ALL_CATEGORIAS.map(({ centroCusto, categoria }) => {
        const orcamento = perMonth.reduce((s, a) => s + (a.categorias.find(c => c.centroCusto === centroCusto && c.categoria === categoria)?.orcamento || 0), 0);
        const gasto = perMonth.reduce((s, a) => s + (a.categorias.find(c => c.centroCusto === centroCusto && c.categoria === categoria)?.gasto || 0), 0);
        const percentual = perMonth[0].categorias.find(c => c.centroCusto === centroCusto && c.categoria === categoria)?.percentual || 0;
        const pctGastoDoVgv = vgvMeta > 0 ? (gasto / vgvMeta) * 100 : 0;
        return { centroCusto, categoria, percentual, orcamento, gasto, diferenca: orcamento - gasto, pctGastoDoVgv };
      });
      const totalOrcamento = categorias.reduce((s, c) => s + c.orcamento, 0);
      const totalGasto = categorias.reduce((s, c) => s + c.gasto, 0);

      return { project, vgvMeta, vgvEstimado, unidadesMeta, categorias, totalOrcamento, totalGasto, totalDiferenca: totalOrcamento - totalGasto };
    })
    .filter((a): a is ProjectAnalysis => a !== null);
}

// Totais (gasto e orçamento) por mês do ano, para os empreendimentos em escopo —
// usado pela visão anual do gráfico de gastos.
export function monthlyTotalsForYear(
  projects: Project[],
  titles: SiengeTitle[],
  projectMetas: SiengeProjectMeta[],
  categoriaOrcamento: SiengeCategoriaOrcamento[],
  year: number,
  tabelaVendas: SiengeTabelaVendaUnidade[] = [],
  controleInicio: string = '0000-01-01',
): { month: number; gasto: number; orcamento: number }[] {
  return Array.from({ length: 12 }, (_, m) => {
    const analysis = projects.map(p => analyzeProjectMonth(p, titles, projectMetas, categoriaOrcamento, year, m, tabelaVendas, controleInicio)).filter(a => a.vgvMeta > 0);
    return {
      month: m,
      gasto: analysis.reduce((s, a) => s + a.totalGasto, 0),
      orcamento: analysis.reduce((s, a) => s + a.totalOrcamento, 0),
    };
  });
}

// Total acumulado, dia a dia, do valor de títulos com vencimento no mês (marketing/
// comercial categorizados) — usado pela linha de tendência do gráfico mensal, para
// comparar contra o limite de orçamento.
export function dailyCumulativeForMonth(
  projects: Project[],
  titles: SiengeTitle[],
  year: number,
  month0: number,
  controleInicio: string = '0000-01-01',
): { day: number; cumulative: number }[] {
  const monthKey = monthKeyOf(year, month0);
  const projectNames = new Set(projects.map(p => p.name));
  const relevantTitles = titles.filter(t =>
    t.vencimento?.startsWith(monthKey) &&
    t.vencimento >= controleInicio &&
    t.centroCusto && t.categoria &&
    t.status !== 'recusados' &&
    t.empreendimento && projectNames.has(t.empreendimento)
  );

  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const valueByDay = new Map<number, number>();
  relevantTitles.forEach(t => {
    const day = Number(t.vencimento!.split('-')[2]);
    valueByDay.set(day, (valueByDay.get(day) || 0) + t.valor);
  });

  let running = 0;
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    running += valueByDay.get(day) || 0;
    return { day, cumulative: running };
  });
}
