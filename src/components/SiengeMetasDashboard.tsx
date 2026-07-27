import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Settings2, Eye, Building2, ChevronDown, Check, Table2, PieChart, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Project, SiengeTitle, SiengeProjectMeta, SiengeCategoriaOrcamento, SiengeProjectTotal, SiengeProjectDisplay, SiengeTabelaVendaUnidade, SiengeTabelaVendaRevisao, SiengeVenda, SiengeOrcamentoConfig } from '../types';
import { useAuth } from '../context/AuthContext';
import MonthFilterDropdown, { MonthFilterValue } from './MonthFilterDropdown';
import { MONTHS_FULL } from './MonthSelectDropdown';
import SiengeMetasModal from './SiengeMetasModal';
import SiengeAlocacaoModal from './SiengeAlocacaoModal';
import SiengeVendasModal from './SiengeVendasModal';
import SiengeSpendChart from './SiengeSpendChart';
import { ALL_CATEGORIAS, analyzeProjectsForPeriod } from '../lib/siengeMetasAnalysis';
import { CENTRO_CUSTO_LABELS, SiengeTaxonomy } from '../lib/siengeCategorias';
import { analyzeProjectBudgetReal, getRitmoMes, ORCAMENTO_PCT, RitmoMes } from '../lib/siengeVendasBudget';

const RESTRICTED_EMAIL = 'cidnei@uchoaempreendimentos.com.br';

interface SiengeMetasDashboardProps {
  titles: SiengeTitle[];
  projects: Project[];
  projectMetas: SiengeProjectMeta[];
  categoriaOrcamento: SiengeCategoriaOrcamento[];
  projectTotais: SiengeProjectTotal[];
  projectDisplays: SiengeProjectDisplay[];
  onSaveProjectMeta: (meta: SiengeProjectMeta) => void;
  onDeleteProjectMeta: (id: string) => void;
  onSaveCategoriaOrcamento: (item: SiengeCategoriaOrcamento) => void;
  onDeleteCategoriaOrcamento: (id: string) => void;
  onSaveProjectTotal: (total: SiengeProjectTotal) => void;
  onSaveProjectDisplay: (display: SiengeProjectDisplay) => void;
  tabelaVendas: SiengeTabelaVendaUnidade[];
  tabelaVendaRevisoes: SiengeTabelaVendaRevisao[];
  onSaveTabelaVenda: (item: SiengeTabelaVendaUnidade) => void;
  onDeleteTabelaVenda: (id: string) => void;
  onApplyTabelaVendaReajuste: (params: { projectId: string; unidadeIds: string[] | null; percentual: number; descricao: string | null }) => Promise<void> | void;
  vendas: SiengeVenda[];
  orcamentoConfig?: SiengeOrcamentoConfig;
  onSaveOrcamentoConfig: (config: SiengeOrcamentoConfig) => void;
  taxonomy: SiengeTaxonomy;
}

const RITMO_LABELS: Record<RitmoMes, string> = { acima: 'Acima do ritmo', dentro: 'Dentro do esperado', abaixo: 'Abaixo do ritmo' };
const RITMO_STYLES: Record<RitmoMes, string> = {
  acima: 'text-[#F85149] bg-[#F85149]/10',
  dentro: 'text-[#3FB950] bg-[#3FB950]/10',
  abaixo: 'text-[#D29922] bg-[#D29922]/10',
};
const RITMO_ICONS: Record<RitmoMes, typeof TrendingUp> = { acima: TrendingUp, dentro: Minus, abaixo: TrendingDown };

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPct(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}%`;
}

function ProjectFilterDropdown({ projects, value, onChange }: { projects: Project[]; value: string; onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = value === 'all' ? null : projects.find(p => p.id === value);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(p => !p)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-normal bg-[#1A1A1C] text-[#A0A0A5] hover:bg-[#1F1F22] hover:text-[#EDEDED] transition-colors min-w-[160px]"
      >
        <Building2 size={12} className="text-[#6B6B70] shrink-0" />
        <span className="truncate flex-1 text-left">{selected ? selected.name : 'Todos os Empreendimentos'}</span>
        <ChevronDown size={12} className={`text-[#6B6B70] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 w-[220px] bg-[#111113] rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-50 animate-fade-in origin-top-right flex flex-col py-1 max-h-[280px] overflow-y-auto no-scrollbar">
            <button
              onClick={() => { onChange('all'); setIsOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${value === 'all' ? 'text-blue-400' : 'text-[#A0A0A5] hover:bg-[#1A1A1C] hover:text-[#EDEDED]'}`}
            >
              <span>Todos os Empreendimentos</span>
              {value === 'all' && <Check size={14} />}
            </button>
            {projects.length > 0 && <div className="h-px bg-[#1F1F22] my-1 mx-2" />}
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => { onChange(p.id); setIsOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${value === p.id ? 'text-blue-400' : 'text-[#A0A0A5] hover:bg-[#1A1A1C] hover:text-[#EDEDED]'}`}
              >
                <span className="truncate pr-2 text-left">{p.name}</span>
                {value === p.id && <Check size={14} className="shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function SiengeMetasDashboard({
  titles, projects, projectMetas, categoriaOrcamento, projectTotais, projectDisplays,
  onSaveProjectMeta, onDeleteProjectMeta, onSaveCategoriaOrcamento, onDeleteCategoriaOrcamento, onSaveProjectTotal, onSaveProjectDisplay,
  tabelaVendas, tabelaVendaRevisoes, onSaveTabelaVenda, onDeleteTabelaVenda, onApplyTabelaVendaReajuste,
  vendas, orcamentoConfig, onSaveOrcamentoConfig, taxonomy,
}: SiengeMetasDashboardProps) {
  const { currentUser } = useAuth();
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState<MonthFilterValue>({ year: now.getFullYear(), month: now.getMonth() });
  const [filterProjectId, setFilterProjectId] = useState<string>('all');
  const [showMetasPanel, setShowMetasPanel] = useState(false);
  const [showAlocacaoPanel, setShowAlocacaoPanel] = useState(false);
  const [showVendasPanel, setShowVendasPanel] = useState(false);

  const allowed = currentUser?.email === RESTRICTED_EMAIL;

  // Empreendimentos ocultados (via "Ajustar Metas") somem do dashboard, mas
  // continuam existindo normalmente no resto do app — e na própria "Ajustar Metas",
  // onde podem ser reexibidos e reordenados.
  const visibleProjects = useMemo(() => {
    const displayOf = (id: string) => projectDisplays.find(d => d.projectId === id);
    return projects
      .filter(p => !displayOf(p.id)?.hidden)
      .sort((a, b) => {
        const oa = displayOf(a.id)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const ob = displayOf(b.id)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (oa !== ob) return oa - ob;
        return projects.indexOf(a) - projects.indexOf(b);
      });
  }, [projects, projectDisplays]);

  const scopedProjects = useMemo(
    () => filterProjectId === 'all' ? visibleProjects : visibleProjects.filter(p => p.id === filterProjectId),
    [visibleProjects, filterProjectId]
  );

  const year = filterMonth?.year ?? now.getFullYear();
  const month = filterMonth?.month ?? null;

  const controleInicio = orcamentoConfig?.controleInicio || now.toISOString().slice(0, 10);

  const analysis = useMemo(
    () => analyzeProjectsForPeriod(scopedProjects, titles, projectMetas, categoriaOrcamento, year, month, tabelaVendas, controleInicio),
    [scopedProjects, titles, projectMetas, categoriaOrcamento, year, month, tabelaVendas, controleInicio]
  );

  // Orçamento Projetado (Meta): sempre 2% da meta de VGV do período, independente
  // de como as categorias estão alocadas — mesmo % fixo usado no Teto do Produto
  // e no Orçamento Real Acumulado, para os três serem comparáveis entre si.
  const totalBudget = analysis.reduce((s, a) => s + a.vgvMeta, 0) * ORCAMENTO_PCT;

  // Camada 1 (real): até a data de hoje, ou o fim do período filtrado se ele já
  // tiver passado — nunca no futuro (não dá pra "acumular" vendas que ainda não aconteceram).
  const ateData = useMemo(() => {
    const periodEnd = month !== null ? new Date(year, month + 1, 0, 23, 59, 59) : new Date(year, 11, 31, 23, 59, 59);
    return periodEnd < now ? periodEnd : now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const budgetReal = useMemo(
    () => scopedProjects.map(p => analyzeProjectBudgetReal(p, tabelaVendas, vendas, titles, categoriaOrcamento, controleInicio, ateData)),
    [scopedProjects, tabelaVendas, vendas, titles, categoriaOrcamento, controleInicio, ateData]
  );
  const budgetRealByProjectId = useMemo(() => new Map(budgetReal.map(b => [b.project.id, b])), [budgetReal]);

  const totalOrcamentoReal = budgetReal.reduce((s, b) => s + b.orcamentoRealAcumulado, 0);
  const totalGastoReal = budgetReal.reduce((s, b) => s + b.gastoRealAcumulado, 0);
  const totalSaving = budgetReal.reduce((s, b) => s + Math.max(b.diferencaReal, 0), 0);
  const totalOverspend = budgetReal.reduce((s, b) => s + Math.max(-b.diferencaReal, 0), 0);

  // ─── Cards do topo: sempre o acumulado geral do ano (ignora o mês do filtro,
  // só respeita o empreendimento selecionado) — quando um empreendimento
  // específico está selecionado, a segunda fileira de cards abaixo é que reflete
  // o mês filtrado.
  const yearlyAnalysis = useMemo(
    () => analyzeProjectsForPeriod(scopedProjects, titles, projectMetas, categoriaOrcamento, year, null, tabelaVendas, controleInicio),
    [scopedProjects, titles, projectMetas, categoriaOrcamento, year, tabelaVendas, controleInicio]
  );
  const yearlyTotalBudget = yearlyAnalysis.reduce((s, a) => s + a.vgvMeta, 0) * ORCAMENTO_PCT;

  const yearlyAteData = useMemo(() => {
    const periodEnd = new Date(year, 11, 31, 23, 59, 59);
    return periodEnd < now ? periodEnd : now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const yearlyBudgetReal = useMemo(
    () => scopedProjects.map(p => analyzeProjectBudgetReal(p, tabelaVendas, vendas, titles, categoriaOrcamento, controleInicio, yearlyAteData)),
    [scopedProjects, tabelaVendas, vendas, titles, categoriaOrcamento, controleInicio, yearlyAteData]
  );
  const yearlyTotalOrcamentoReal = yearlyBudgetReal.reduce((s, b) => s + b.orcamentoRealAcumulado, 0);
  const yearlyTotalGastoReal = yearlyBudgetReal.reduce((s, b) => s + b.gastoRealAcumulado, 0);
  const yearlyTotalSaving = yearlyBudgetReal.reduce((s, b) => s + Math.max(b.diferencaReal, 0), 0);
  const yearlyTotalOverspend = yearlyBudgetReal.reduce((s, b) => s + Math.max(-b.diferencaReal, 0), 0);

  // Ritmo do mês corrente (não do período filtrado) — sinal de alerta contra a
  // meta, nunca decide estouro.
  const currentMonthAnalysis = useMemo(
    () => analyzeProjectsForPeriod(scopedProjects, titles, projectMetas, categoriaOrcamento, now.getFullYear(), now.getMonth(), tabelaVendas, controleInicio),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopedProjects, titles, projectMetas, categoriaOrcamento, tabelaVendas, controleInicio]
  );
  const ritmo = getRitmoMes(
    currentMonthAnalysis.reduce((s, a) => s + a.totalGasto, 0),
    currentMonthAnalysis.reduce((s, a) => s + a.vgvMeta, 0) * ORCAMENTO_PCT
  );
  const RitmoIcon = RITMO_ICONS[ritmo];

  if (!allowed) return null;

  const hasMetas = yearlyAnalysis.length > 0;
  const selectedProject = filterProjectId !== 'all' ? scopedProjects[0] : undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0A0A0A]">
      <AnimatePresence mode="wait">
        {showMetasPanel ? (
          <motion.div
            key="metas-panel"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex-1 flex flex-col overflow-hidden min-h-0"
          >
            <SiengeMetasModal
              projects={projects}
              metas={projectMetas}
              projectDisplays={projectDisplays}
              onSaveMeta={onSaveProjectMeta}
              onDeleteMeta={onDeleteProjectMeta}
              onSaveProjectDisplay={onSaveProjectDisplay}
              tabelaVendas={tabelaVendas}
              onClose={() => setShowMetasPanel(false)}
            />
          </motion.div>
        ) : showAlocacaoPanel ? (
          <motion.div
            key="alocacao-panel"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex-1 flex flex-col overflow-hidden min-h-0"
          >
            <SiengeAlocacaoModal
              projects={projects}
              categoriaOrcamento={categoriaOrcamento}
              tabelaVendas={tabelaVendas}
              taxonomy={taxonomy}
              onSaveCategoria={onSaveCategoriaOrcamento}
              onDeleteCategoria={onDeleteCategoriaOrcamento}
              onClose={() => setShowAlocacaoPanel(false)}
            />
          </motion.div>
        ) : showVendasPanel ? (
          <motion.div
            key="vendas-panel"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex-1 flex flex-col overflow-hidden min-h-0"
          >
            <SiengeVendasModal
              projects={visibleProjects}
              unidades={tabelaVendas}
              revisoes={tabelaVendaRevisoes}
              onSaveUnidade={onSaveTabelaVenda}
              onDeleteUnidade={onDeleteTabelaVenda}
              onApplyReajuste={onApplyTabelaVendaReajuste}
              onClose={() => setShowVendasPanel(false)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex-1 flex flex-col overflow-hidden min-h-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F1F22] shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-sm font-medium text-[#EDEDED]">Dashboard Analítico</h1>
                  <p className="text-[11px] text-[#6B6B70] mt-0.5">Comparativo de orçamento de marketing/comercial vs VGV por empreendimento</p>
                </div>
                {hasMetas && (
                  <span title="Compara o gasto real do mês contra a projeção por meta — é só um sinal de ritmo, nunca decide estouro." className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${RITMO_STYLES[ritmo]}`}>
                    <RitmoIcon size={12} /> Ritmo do mês: {RITMO_LABELS[ritmo]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ProjectFilterDropdown projects={visibleProjects} value={filterProjectId} onChange={setFilterProjectId} />
                <MonthFilterDropdown value={filterMonth} onChange={setFilterMonth} allLabel="Ver Todos" />
                <button
                  onClick={() => setShowMetasPanel(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors"
                >
                  {hasMetas ? <Settings2 size={13} /> : <Eye size={13} />}
                  {hasMetas ? 'Ajustar Metas' : 'Ver Metas'}
                </button>
                <button
                  onClick={() => setShowVendasPanel(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1A1A1C] hover:bg-[#1F1F22] rounded-md transition-colors"
                >
                  <Table2 size={13} />
                  Tabela de Vendas
                </button>
                <button
                  onClick={() => setShowAlocacaoPanel(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1A1A1C] hover:bg-[#1F1F22] rounded-md transition-colors"
                >
                  <PieChart size={13} />
                  Alocação de Orçamento
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-8">
              {!hasMetas ? (
                <div className="flex flex-col items-center justify-center py-16 text-[#6B6B70] gap-2">
                  <BarChart3 size={28} strokeWidth={1.5} />
                  <p className="text-sm">Nenhum empreendimento com meta de VGV cadastrada para este período.</p>
                  <button onClick={() => setShowMetasPanel(true)} className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    + Ver Metas
                  </button>
                </div>
              ) : (
                <>
            {/* Empreendimento + mês em escopo — destaque máximo, bem acima de tudo */}
            <h2 className="text-4xl font-semibold text-[#EDEDED] tracking-[-0.02em]">
              {selectedProject && <span>{selectedProject.name} </span>}
              <span className={selectedProject ? 'text-[#6B6B70] font-normal' : ''}>
                {selectedProject && '/ '}{month !== null ? `${MONTHS_FULL[month]} ${year}` : `Ano de ${year}`}
              </span>
            </h2>

            {/* Cards do mês — destaque principal, sempre respeitam mês + empreendimento filtrados. */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              <div className="bg-[#111113] rounded-lg p-5 flex flex-col gap-3">
                <div className="text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]" title="2% do VGV meta cadastrado para o período selecionado — sinal de ritmo, não decide estouro.">Orçamento Projetado (Meta)</div>
                <div className="text-4xl font-semibold text-[#EDEDED] tracking-[-0.02em]">{formatCurrency(totalBudget)}</div>
              </div>
              <div className="bg-[#111113] rounded-lg p-5 flex flex-col gap-3">
                <div className="text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]" title="2% do VGV das unidades efetivamente vendidas dentro do período selecionado.">Orçamento Real Acumulado</div>
                <div className="text-4xl font-semibold text-[#EDEDED] tracking-[-0.02em]">{formatCurrency(totalOrcamentoReal)}</div>
              </div>
              <div className="bg-[#111113] rounded-lg p-5 flex flex-col gap-3">
                <div className="text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]" title="Soma dos títulos Sienge (marketing/comercial) com vencimento desde o início do controle de orçamento até o fim do período selecionado.">Gasto Real Acumulado</div>
                <div className="text-4xl font-semibold text-[#EDEDED] tracking-[-0.02em]">{formatCurrency(totalGastoReal)}</div>
              </div>
              <div className="bg-[#111113] rounded-lg p-5 flex flex-col gap-3">
                <div className="text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Overspend</div>
                <div className={`text-4xl font-semibold tracking-[-0.02em] ${totalOverspend > 0 ? 'text-[#F85149]' : 'text-[#EDEDED]'}`}>{formatCurrency(totalOverspend)}</div>
              </div>
              <div className="bg-[#111113] rounded-lg p-5 flex flex-col gap-3">
                <div className="text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Saving</div>
                <div className={`text-4xl font-semibold tracking-[-0.02em] ${totalSaving > 0 ? 'text-[#3FB950]' : 'text-[#EDEDED]'}`}>{formatCurrency(totalSaving)}</div>
              </div>
            </div>

            {/* Cards do ano — menor destaque, abaixo dos cards do mês. Sempre
                acumulado dos 12 meses, só respeita o empreendimento filtrado. */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[10px] font-medium text-[#4A4A4E] uppercase tracking-[0.05em]">
                Acumulado do ano — {selectedProject ? selectedProject.name : 'todos os empreendimentos'}
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="bg-[#0D0D0F] rounded-lg p-3.5 flex flex-col gap-1.5">
                  <div className="text-[10px] font-medium text-[#5A5A5E] uppercase tracking-[0.05em]" title="2% do VGV meta cadastrado, somado nos 12 meses do ano — sinal de ritmo, não decide estouro.">Orçamento Projetado (Meta)</div>
                  <div className="text-xl font-extralight text-[#A0A0A5] tracking-[-0.02em]">{formatCurrency(yearlyTotalBudget)}</div>
                </div>
                <div className="bg-[#0D0D0F] rounded-lg p-3.5 flex flex-col gap-1.5">
                  <div className="text-[10px] font-medium text-[#5A5A5E] uppercase tracking-[0.05em]" title="2% do VGV das unidades efetivamente vendidas — é isso que define estouro/economia de verdade.">Orçamento Real Acumulado</div>
                  <div className="text-xl font-extralight text-[#A0A0A5] tracking-[-0.02em]">{formatCurrency(yearlyTotalOrcamentoReal)}</div>
                </div>
                <div className="bg-[#0D0D0F] rounded-lg p-3.5 flex flex-col gap-1.5">
                  <div className="text-[10px] font-medium text-[#5A5A5E] uppercase tracking-[0.05em]" title="Soma dos títulos Sienge (marketing/comercial) com vencimento desde o início do controle de orçamento até hoje.">Gasto Real Acumulado</div>
                  <div className="text-xl font-extralight text-[#A0A0A5] tracking-[-0.02em]">{formatCurrency(yearlyTotalGastoReal)}</div>
                </div>
                <div className="bg-[#0D0D0F] rounded-lg p-3.5 flex flex-col gap-1.5">
                  <div className="text-[10px] font-medium text-[#5A5A5E] uppercase tracking-[0.05em]">Overspend</div>
                  <div className={`text-xl font-extralight tracking-[-0.02em] ${yearlyTotalOverspend > 0 ? 'text-[#C24941]' : 'text-[#A0A0A5]'}`}>{formatCurrency(yearlyTotalOverspend)}</div>
                </div>
                <div className="bg-[#0D0D0F] rounded-lg p-3.5 flex flex-col gap-1.5">
                  <div className="text-[10px] font-medium text-[#5A5A5E] uppercase tracking-[0.05em]">Saving</div>
                  <div className={`text-xl font-extralight tracking-[-0.02em] ${yearlyTotalSaving > 0 ? 'text-[#2F9E52]' : 'text-[#A0A0A5]'}`}>{formatCurrency(yearlyTotalSaving)}</div>
                </div>
              </div>
            </div>

            {/* Gráfico */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Acumulado Real vs Projeção por Meta</h3>
              <div className="bg-[#111113] rounded-lg p-5">
                <SiengeSpendChart
                  projects={scopedProjects}
                  titles={titles}
                  projectMetas={projectMetas}
                  categoriaOrcamento={categoriaOrcamento}
                  tabelaVendas={tabelaVendas}
                  vendas={vendas}
                  controleInicio={controleInicio}
                  year={year}
                  month={month}
                />
              </div>
            </div>

            {/* Por empreendimento — compacto, 2+ por linha */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Por Empreendimento</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {analysis.map((a, i) => {
                  const br = budgetRealByProjectId.get(a.project.id);
                  const diferencaReal = br?.diferencaReal ?? 0;
                  const gastoReal = br?.gastoRealAcumulado ?? 0;
                  const orcamentoReal = br?.orcamentoRealAcumulado ?? 0;
                  return (
                  <div
                    key={a.project.id}
                    className={`bg-[#111113] rounded-lg p-5 flex flex-col gap-3 ${
                      // Último card sozinho na linha (contagem ímpar) ocupa a linha inteira, evitando buraco no grid.
                      analysis.length % 2 === 1 && i === analysis.length - 1 ? 'lg:col-span-2' : ''
                    }`}
                  >
                    {/* Todas as linhas (título, VGV, categorias) partem do mesmo x — nenhum
                        indenta com ícone/bullet — para o texto ficar alinhado verticalmente. */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[13px] font-normal text-[#EDEDED] truncate min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: a.project.color }} />
                        {a.project.name}
                      </span>
                      <span title="Estouro/economia real (Orçamento Real Acumulado − Gasto Real Acumulado)" className={`text-[13px] font-normal shrink-0 ${diferencaReal >= 0 ? 'text-[#3FB950]' : 'text-[#F85149]'}`}>
                        {diferencaReal >= 0 ? '+' : '-'}{formatCurrency(Math.abs(diferencaReal))}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#6B6B70]">
                      <span>Real: <span className="text-[#A0A0A5]">{formatCurrency(orcamentoReal)}</span></span>
                      <span title={a.vgvEstimado ? 'VGV estimado a partir do VGV total ÷ unidades disponíveis do empreendimento' : undefined}>
                        Meta: <span className="text-[#A0A0A5]">{formatCurrency(a.vgvMeta * ORCAMENTO_PCT)}</span>
                      </span>
                      <span>{a.unidadesMeta.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} unid. meta</span>
                    </div>
                    <div className="h-[5px] bg-[#1A1A1C] rounded-full overflow-hidden" title="Gasto real acumulado vs Orçamento Real Acumulado">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${gastoReal > orcamentoReal ? 'bg-[#F85149]' : 'bg-blue-500'}`}
                        style={{ width: `${orcamentoReal > 0 ? Math.min((gastoReal / orcamentoReal) * 100, 100) : 0}%` }}
                      />
                    </div>

                    {br && br.tetoTotalProduto > 0 && (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] text-[#6B6B70]">
                          <span>Teto do Produto: <span className="text-[#A0A0A5]">{formatCurrency(br.tetoTotalProduto)}</span></span>
                          <span>{formatPct(br.pctTetoConsumido)} consumido</span>
                        </div>
                        <div className="h-[3px] bg-[#1A1A1C] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#8B8BF0]" style={{ width: `${Math.min(br.pctTetoConsumido, 100)}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Categorias alocadas ou com gasto real: % da verba, gasto e status de utilização.
                        Categorias sem % alocado mas com gasto real também aparecem — gasto real nunca fica escondido. */}
                    {(br?.categorias || a.categorias).some(c => c.percentual > 0 || c.gasto > 0) && (
                      <div className="flex flex-col gap-2 pt-2 border-t border-[#1F1F22]">
                        {(br?.categorias || a.categorias).filter(c => c.percentual > 0 || c.gasto > 0).map(c => {
                          const over = c.pctGastoDoVgv > c.percentual;
                          const used = c.orcamento > 0 ? Math.min(c.gasto / c.orcamento, 1) : 0;
                          const statusColor = over ? 'text-[#F85149]' : c.gasto > 0 ? 'text-[#A0A0A5]' : 'text-[#6B6B70]';
                          const barColor = over ? 'bg-[#F85149]' : 'bg-blue-500';
                          return (
                            <div key={`${c.centroCusto}-${c.categoria}`} className="flex flex-col gap-1 text-[11px]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[#6B6B70] truncate min-w-0">
                                  {CENTRO_CUSTO_LABELS[c.centroCusto]} · {c.categoria}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[#6B6B70]">{formatPct(c.percentual)}</span>
                                  <span className={statusColor}>{formatCurrency(c.gasto)}</span>
                                </div>
                              </div>
                              <div className="h-[3px] bg-[#1A1A1C] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${used * 100}%`, opacity: over ? 1 : 0.6 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Tabela comparativa entre empreendimentos */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Comparativo entre Empreendimentos (% do orçamento da categoria consumido)</h3>
              <div className="overflow-x-auto bg-[#111113] rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1F1F22]">
                      <th className="text-left px-4 py-3 pl-5 text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Categoria</th>
                      {analysis.map(a => (
                        <th key={a.project.id} className="text-right px-4 py-3 text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em] whitespace-nowrap">{a.project.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_CATEGORIAS.map(({ centroCusto, categoria }) => (
                      <tr key={`${centroCusto}-${categoria}`} className="border-b border-[#1F1F22] last:border-b-0 hover:bg-[#151519] transition-colors">
                        <td className="px-4 py-2.5 pl-5 text-[#A0A0A5]">
                          <span className="text-[#6B6B70] mr-1">{CENTRO_CUSTO_LABELS[centroCusto]} ·</span>{categoria}
                        </td>
                        {analysis.map(a => {
                          // Gasto real acumulado da categoria, sobre o orçamento da categoria alocado
                          // pela meta (% × VGV meta) — não sobre o VGV real vendido, que fica em 0 até
                          // a primeira venda confirmada e deixaria a tabela sempre zerada.
                          const gastoC = (budgetRealByProjectId.get(a.project.id)?.categorias || a.categorias).find(x => x.centroCusto === centroCusto && x.categoria === categoria)!;
                          const metaC = a.categorias.find(x => x.centroCusto === centroCusto && x.categoria === categoria)!;
                          const pctConsumido = metaC.orcamento > 0 ? (gastoC.gasto / metaC.orcamento) * 100 : 0;
                          const over = metaC.percentual > 0 && pctConsumido > 100;
                          return (
                            <td key={a.project.id} className={`px-4 py-2.5 text-right font-normal ${over ? 'text-[#F85149]' : gastoC.gasto > 0 ? 'text-[#A0A0A5]' : 'text-[#3A3A3E]'}`}>
                              {gastoC.gasto > 0 || metaC.percentual > 0 ? formatPct(pctConsumido) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ranking real: quem economizou/estourou mais, e quanto do teto do produto já foi consumido */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Orçamento Real e Teto do Produto por Empreendimento</h3>
              <div className="overflow-x-auto bg-[#111113] rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1F1F22]">
                      <th className="text-left px-4 py-3 pl-5 text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Empreendimento</th>
                      <th className="text-right px-4 py-3 text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Orçamento Real</th>
                      <th className="text-right px-4 py-3 text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Gasto Real</th>
                      <th className="text-right px-4 py-3 text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Saldo</th>
                      <th className="text-right px-4 py-3 text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">Teto do Produto</th>
                      <th className="text-right px-4 py-3 pr-5 text-[11px] font-medium text-[#6B6B70] uppercase tracking-[0.05em]">% Teto Consumido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...budgetReal].sort((a, b) => a.diferencaReal - b.diferencaReal).map(b => (
                      <tr key={b.project.id} className="border-b border-[#1F1F22] last:border-b-0 hover:bg-[#151519] transition-colors">
                        <td className="px-4 py-2.5 pl-5 text-[#EDEDED]">
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: b.project.color }} />
                            {b.project.name}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-[#A0A0A5]">{formatCurrency(b.orcamentoRealAcumulado)}</td>
                        <td className="px-4 py-2.5 text-right text-[#A0A0A5]">{formatCurrency(b.gastoRealAcumulado)}</td>
                        <td className={`px-4 py-2.5 text-right font-medium ${b.diferencaReal >= 0 ? 'text-[#3FB950]' : 'text-[#F85149]'}`}>
                          {b.diferencaReal >= 0 ? '+' : '-'}{formatCurrency(Math.abs(b.diferencaReal))}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[#A0A0A5]">{b.tetoTotalProduto > 0 ? formatCurrency(b.tetoTotalProduto) : '—'}</td>
                        <td className="px-4 py-2.5 pr-5 text-right text-[#A0A0A5]">{b.tetoTotalProduto > 0 ? formatPct(b.pctTetoConsumido) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
