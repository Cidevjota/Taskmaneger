import { Project, SiengeTitle, SiengeProjectMeta, SiengeCategoriaOrcamento, SiengeCentroCusto, SiengeProjectTotal } from '../types';
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

// Unidades disponíveis do empreendimento: unidades totais menos as já comprometidas
// em metas de outros meses/anos (a meta do próprio mês/ano em cálculo é excluída,
// já que é ela que está sendo determinada).
export function unidadesDisponiveisFor(
  project: Project,
  projectTotais: SiengeProjectTotal[],
  metas: SiengeProjectMeta[],
  excludeAno?: number,
  excludeMes?: number,
): number {
  const total = projectTotais.find(t => t.projectId === project.id);
  if (!total) return 0;
  const comprometidas = metas
    .filter(m => m.projectId === project.id && !(m.ano === excludeAno && m.mes === excludeMes))
    .reduce((s, m) => s + (m.unidadesMeta || 0), 0);
  return Math.max(total.unidadesTotal - comprometidas, 0);
}

// VGV restante do empreendimento: VGV total menos o VGV já comprometido em metas
// de outros meses/anos (mesma exclusão do mês/ano em cálculo usada em unidadesDisponiveisFor).
// Metas antigas com unidades definidas mas sem VGV explícito (salvas antes do
// preenchimento automático existir) não podem contar como "R$ 0 consumido" — isso
// infla o preço das unidades restantes. Para essas, usa o preço de referência do
// empreendimento como o valor que elas efetivamente consumiram do VGV total.
function vgvRestanteFor(
  project: Project,
  projectTotais: SiengeProjectTotal[],
  metas: SiengeProjectMeta[],
  excludeAno?: number,
  excludeMes?: number,
): number {
  const total = projectTotais.find(t => t.projectId === project.id);
  if (!total) return 0;
  const refPrice = referencePricePerUnitFor(project, projectTotais);
  const comprometido = metas
    .filter(m => m.projectId === project.id && !(m.ano === excludeAno && m.mes === excludeMes))
    .reduce((s, m) => s + (m.vgvMeta > 0 ? m.vgvMeta : refPrice * (m.unidadesMeta || 0)), 0);
  return Math.max(total.vgvTotal - comprometido, 0);
}

// Preço médio por unidade (VGV restante / unidades disponíveis) do empreendimento —
// usado para estimar o VGV de um mês quando ele não é definido explicitamente na
// planilha. Tanto o VGV quanto as unidades restantes diminuem na mesma proporção
// conforme metas de outros meses são cadastradas, então o preço médio se mantém
// estável quando a distribuição é proporcional (e só sobe/desce se ela não for).
export function pricePerUnitFor(
  project: Project,
  projectTotais: SiengeProjectTotal[],
  metas: SiengeProjectMeta[] = [],
  excludeAno?: number,
  excludeMes?: number,
): number {
  const total = projectTotais.find(t => t.projectId === project.id);
  if (!total || total.vgvTotal <= 0) return 0;
  const disponiveis = unidadesDisponiveisFor(project, projectTotais, metas, excludeAno, excludeMes);
  const vgvRestante = vgvRestanteFor(project, projectTotais, metas, excludeAno, excludeMes);
  return disponiveis > 0 ? vgvRestante / disponiveis : 0;
}

// Preço médio "de referência" (VGV total ÷ unidades totais), fixo e sem descontar
// nada já comprometido — usado apenas como informação de contexto (ex.: no resumo
// de VGV/unidades totais do empreendimento), não no cálculo de estimativa por mês.
export function referencePricePerUnitFor(project: Project, projectTotais: SiengeProjectTotal[]): number {
  const total = projectTotais.find(t => t.projectId === project.id);
  return total && total.unidadesTotal > 0 ? total.vgvTotal / total.unidadesTotal : 0;
}

// Análise de um empreendimento para um único mês (orçamento por categoria vs gasto real).
export function analyzeProjectMonth(
  project: Project,
  titles: SiengeTitle[],
  projectMetas: SiengeProjectMeta[],
  categoriaOrcamento: SiengeCategoriaOrcamento[],
  year: number,
  month0: number,
  projectTotais: SiengeProjectTotal[] = [],
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
  const vgvMeta = vgvExplicito > 0 ? vgvExplicito : pricePerUnitFor(project, projectTotais, projectMetas, year, month0 + 1) * unidadesMeta;

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
  projectTotais: SiengeProjectTotal[] = [],
  controleInicio: string = '0000-01-01',
): ProjectAnalysis[] {
  if (month !== null) {
    return projects
      .map(p => analyzeProjectMonth(p, titles, projectMetas, categoriaOrcamento, year, month, projectTotais, controleInicio))
      .filter(a => a.vgvMeta > 0);
  }

  return projects
    .map(project => {
      const perMonth = Array.from({ length: 12 }, (_, m) => analyzeProjectMonth(project, titles, projectMetas, categoriaOrcamento, year, m, projectTotais, controleInicio))
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
  projectTotais: SiengeProjectTotal[] = [],
  controleInicio: string = '0000-01-01',
): { month: number; gasto: number; orcamento: number }[] {
  return Array.from({ length: 12 }, (_, m) => {
    const analysis = projects.map(p => analyzeProjectMonth(p, titles, projectMetas, categoriaOrcamento, year, m, projectTotais, controleInicio)).filter(a => a.vgvMeta > 0);
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
