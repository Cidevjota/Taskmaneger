import React, { useMemo, useState } from 'react';
import { SiengeTitle, SiengeLote, SiengeFatura, Project, SiengeAlcadaConfig, SiengeProjectMeta, SiengeCategoriaOrcamento, SiengeTitleStatusHistoryEntry, SiengeProjectTotal, SiengeProjectDisplay, SiengeTabelaVendaUnidade, SiengeTabelaVendaColuna, SiengeTabelaVendaRevisao, SiengeVenda, SiengeOrcamentoConfig, SiengeCalculoRegra, SiengeValidacao, SiengeVendaSituacao } from '../types';
import { SiengeTaxonomy } from '../lib/siengeCategorias';
import SiengeKanban from './SiengeKanban';
import SiengeLotes from './SiengeLotes';
import SiengeFaturas from './SiengeFaturas';
import SiengeMetasDashboard from './SiengeMetasDashboard';
import SiengeVendasModal from './SiengeVendasModal';
import { useAuth } from '../context/AuthContext';

const METAS_DASHBOARD_EMAIL = 'cidnei@uchoaempreendimentos.com.br';

interface SiengeViewProps {
  titles: SiengeTitle[];
  statusHistory: SiengeTitleStatusHistoryEntry[];
  lotes: SiengeLote[];
  faturas: SiengeFatura[];
  projects: Project[];
  currentProjectFilter: string | null;
  alcadaConfig: SiengeAlcadaConfig;
  onSaveTitle: (title: SiengeTitle) => void;
  onDeleteTitle: (id: string) => void;
  onSaveLote: (lote: SiengeLote) => void;
  onDeleteLote: (id: string) => void;
  onSaveFatura: (fatura: SiengeFatura) => void;
  onDeleteFatura: (id: string) => void;
  onSaveAlcadaConfig: (config: SiengeAlcadaConfig) => Promise<void> | void;
  editingMap?: Record<string, { name: string; avatarUrl?: string; color: string }>;
  onTitlePresence?: (titleId: string | null) => void;
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
  onClearTabelaVenda: (projectId: string) => Promise<void> | void;
  onApplyTabelaVendaReajuste: (params: { projectId: string; unidadeIds: string[] | null; percentual: number; descricao: string | null; motivo: string; colunas: string[] }) => Promise<void> | void;
  onSetTabelaVendaMargem: (params: { projectId: string; unidadeIds: string[] | null; coluna: string; valor: number }) => Promise<void> | void;
  onReverterTabelaVendaRevisao: (revisaoId: string) => Promise<void> | void;
  onAlterarSituacaoUnidades: (params: {
    projectId: string;
    unidadeIds: string[];
    situacao: SiengeVendaSituacao;
    motivo: string;
    comprador: string | null;
    data: string | null;
  }) => Promise<void> | void;
  vendas: SiengeVenda[];
  orcamentoConfig?: SiengeOrcamentoConfig;
  onSaveOrcamentoConfig: (config: SiengeOrcamentoConfig) => void;
  tabelaVendaColunas: SiengeTabelaVendaColuna[];
  onSaveTabelaVendaColuna: (coluna: SiengeTabelaVendaColuna) => void;
  onDeleteTabelaVendaColuna: (id: string) => void;
  calculoRegras: SiengeCalculoRegra[];
  onSaveCalculoRegra: (regra: SiengeCalculoRegra) => void;
  onDeleteCalculoRegra: (id: string) => void;
  validacoes: SiengeValidacao[];
  onSaveValidacao: (validacao: SiengeValidacao) => void;
  onDeleteValidacao: (id: string) => void;
  taxonomy: SiengeTaxonomy;
  onAddCentroCusto: (nome: string) => Promise<void> | void;
  onAddCategoria: (centroCusto: string, categoria: string) => Promise<void> | void;
  onRenameCategoria: (id: string, categoria: string) => Promise<void> | void;
  onDeleteCategoria: (id: string) => Promise<void> | void;
  onAddSubcategoria: (categoriaId: string, subcategoria: string) => Promise<void> | void;
  onDeleteSubcategoria: (id: string) => Promise<void> | void;
}

export default function SiengeView({
  titles, statusHistory, lotes, faturas, projects, currentProjectFilter, alcadaConfig,
  onSaveTitle, onDeleteTitle, onSaveLote, onDeleteLote, onSaveFatura, onDeleteFatura, onSaveAlcadaConfig,
  editingMap, onTitlePresence,
  projectMetas, categoriaOrcamento, projectTotais, projectDisplays, onSaveProjectMeta, onDeleteProjectMeta, onSaveCategoriaOrcamento, onDeleteCategoriaOrcamento, onSaveProjectTotal, onSaveProjectDisplay,
  tabelaVendas, tabelaVendaRevisoes, onSaveTabelaVenda, onDeleteTabelaVenda, onClearTabelaVenda, onApplyTabelaVendaReajuste, onSetTabelaVendaMargem, onReverterTabelaVendaRevisao, onAlterarSituacaoUnidades,
  vendas, orcamentoConfig, onSaveOrcamentoConfig,
  tabelaVendaColunas, onSaveTabelaVendaColuna, onDeleteTabelaVendaColuna, calculoRegras, onSaveCalculoRegra, onDeleteCalculoRegra,
  validacoes, onSaveValidacao, onDeleteValidacao,
  taxonomy, onAddCentroCusto, onAddCategoria, onRenameCategoria, onDeleteCategoria, onAddSubcategoria, onDeleteSubcategoria,
}: SiengeViewProps) {
  const [activeTab, setActiveTab] = useState<'titulos' | 'lotes' | 'faturas' | 'metas' | 'vendas'>('titulos');
  const openLotes = lotes.filter(l => l.status === 'aberto');
  const openFaturas = faturas.filter(f => f.status === 'aberto');
  const { currentUser } = useAuth();
  const showMetasTab = currentUser?.email === METAS_DASHBOARD_EMAIL;

  // Mesma regra de visibilidade/ordem usada no Dashboard Analítico — empreendimentos
  // ocultados via "Ajustar Metas" também somem da Tabela de Vendas.
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

  return (
    <div className="flex flex-col h-full bg-[#08080a]">
      {/* View Header with Tabs */}
      <div className="flex items-center gap-6 px-6 pt-4 border-b border-zinc-800/60 shrink-0">
        <button
          onClick={() => setActiveTab('titulos')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === 'titulos'
              ? 'text-zinc-100 border-blue-500'
              : 'text-zinc-500 border-transparent hover:text-zinc-300'
          }`}
        >
          Títulos
        </button>
        <button
          onClick={() => setActiveTab('lotes')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'lotes'
              ? 'text-zinc-100 border-blue-500'
              : 'text-zinc-500 border-transparent hover:text-zinc-300'
          }`}
        >
          Lotes de Pagamento
          {openLotes.length > 0 && (
            <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {openLotes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('faturas')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'faturas'
              ? 'text-zinc-100 border-blue-500'
              : 'text-zinc-500 border-transparent hover:text-zinc-300'
          }`}
        >
          Cartão de Crédito
          {openFaturas.length > 0 && (
            <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {openFaturas.length}
            </span>
          )}
        </button>
        {showMetasTab && (
          <button
            onClick={() => setActiveTab('metas')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'metas'
                ? 'text-zinc-100 border-blue-500'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            Dashboard Analítico
          </button>
        )}
        {showMetasTab && (
          <button
            onClick={() => setActiveTab('vendas')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'vendas'
                ? 'text-zinc-100 border-blue-500'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            Tabela de Vendas
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'titulos' ? (
          <SiengeKanban
            titles={titles}
            openLotes={openLotes}
            openFaturas={openFaturas}
            projects={projects}
            currentProjectFilter={currentProjectFilter}
            alcadaConfig={alcadaConfig}
            onSave={onSaveTitle}
            onDelete={onDeleteTitle}
            onSaveAlcadaConfig={onSaveAlcadaConfig}
            editingMap={editingMap}
            onTitlePresence={onTitlePresence}
            taxonomy={taxonomy}
            onAddCentroCusto={onAddCentroCusto}
            onAddCategoria={onAddCategoria}
            onRenameCategoria={onRenameCategoria}
            onDeleteCategoria={onDeleteCategoria}
            onAddSubcategoria={onAddSubcategoria}
            onDeleteSubcategoria={onDeleteSubcategoria}
          />
        ) : activeTab === 'lotes' ? (
          <SiengeLotes
            lotes={lotes}
            titles={titles}
            statusHistory={statusHistory}
            onSaveLote={onSaveLote}
            onDeleteLote={onDeleteLote}
          />
        ) : activeTab === 'faturas' ? (
          <SiengeFaturas
            faturas={faturas}
            titles={titles}
            onSaveFatura={onSaveFatura}
            onDeleteFatura={onDeleteFatura}
          />
        ) : activeTab === 'vendas' ? (
          <SiengeVendasModal
            projects={visibleProjects}
            unidades={tabelaVendas}
            revisoes={tabelaVendaRevisoes}
            vendas={vendas}
            colunas={tabelaVendaColunas}
            regras={calculoRegras}
            onSaveUnidade={onSaveTabelaVenda}
            onDeleteUnidade={onDeleteTabelaVenda}
            onClearUnidades={onClearTabelaVenda}
            onApplyReajuste={onApplyTabelaVendaReajuste}
            onSetMargem={onSetTabelaVendaMargem}
            onReverterRevisao={onReverterTabelaVendaRevisao}
            onAlterarSituacao={onAlterarSituacaoUnidades}
            onSaveColuna={onSaveTabelaVendaColuna}
            onDeleteColuna={onDeleteTabelaVendaColuna}
            onSaveRegra={onSaveCalculoRegra}
            onDeleteRegra={onDeleteCalculoRegra}
            validacoes={validacoes}
            onSaveValidacao={onSaveValidacao}
            onDeleteValidacao={onDeleteValidacao}
          />
        ) : (
          <SiengeMetasDashboard
            titles={titles}
            projects={projects}
            projectMetas={projectMetas}
            categoriaOrcamento={categoriaOrcamento}
            projectTotais={projectTotais}
            projectDisplays={projectDisplays}
            onSaveProjectMeta={onSaveProjectMeta}
            onDeleteProjectMeta={onDeleteProjectMeta}
            onSaveCategoriaOrcamento={onSaveCategoriaOrcamento}
            onDeleteCategoriaOrcamento={onDeleteCategoriaOrcamento}
            onSaveProjectTotal={onSaveProjectTotal}
            onSaveProjectDisplay={onSaveProjectDisplay}
            tabelaVendas={tabelaVendas}
            vendas={vendas}
            orcamentoConfig={orcamentoConfig}
            onSaveOrcamentoConfig={onSaveOrcamentoConfig}
            taxonomy={taxonomy}
          />
        )}
      </div>
    </div>
  );
}
