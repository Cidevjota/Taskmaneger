import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Target, Building2, ChevronDown, Trash2, Plus, Minus, PieChart } from 'lucide-react';
import { Project, SiengeProjectMeta, SiengeCategoriaOrcamento, SiengeCentroCusto, SiengeProjectTotal, SiengeProjectDisplay, SiengeTabelaVendaUnidade } from '../types';
import { CENTRO_CUSTO_LABELS, SIENGE_CATEGORIAS } from '../lib/siengeCategorias';
import SiengeMetasTable from './SiengeMetasTable';

interface SiengeMetasModalProps {
  projects: Project[];
  metas: SiengeProjectMeta[];
  categoriaOrcamento: SiengeCategoriaOrcamento[];
  projectTotais: SiengeProjectTotal[];
  projectDisplays: SiengeProjectDisplay[];
  onSaveMeta: (meta: SiengeProjectMeta) => void;
  onDeleteMeta: (id: string) => void;
  onSaveCategoria: (item: SiengeCategoriaOrcamento) => void;
  onDeleteCategoria: (id: string) => void;
  onSaveProjectTotal: (total: SiengeProjectTotal) => void;
  onSaveProjectDisplay: (display: SiengeProjectDisplay) => void;
  tabelaVendas: SiengeTabelaVendaUnidade[];
  onClose: () => void;
}

const ORCAMENTO_ALVO_PCT = 2;

// Stepper de % com botões +/- no lugar do spinner nativo do input number,
// que não seguia a identidade visual do app.
function PercentStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const format = (v: number) => (v ? v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '');
  const [text, setText] = useState(format(value));

  useEffect(() => { setText(format(value)); }, [value]);

  const commit = (raw: string) => {
    const parsed = parseFloat(raw.replace(',', '.'));
    onChange(isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed * 100) / 100));
  };

  const step = (delta: number) => onChange(Math.max(0, Math.round((value + delta) * 100) / 100));

  return (
    <div className="flex items-center bg-zinc-900/60 border border-zinc-800 rounded-lg overflow-hidden focus-within:border-blue-500/50 transition-colors">
      <button
        type="button"
        onClick={() => step(-0.1)}
        className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
      >
        <Minus size={11} />
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder="0,0"
        className="w-10 bg-transparent text-center text-xs text-zinc-100 placeholder-zinc-600 outline-none py-1.5"
      />
      <button
        type="button"
        onClick={() => step(0.1)}
        className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
      >
        <Plus size={11} />
      </button>
      <span className="pr-2.5 pl-0.5 text-[10px] text-zinc-500 select-none">%</span>
    </div>
  );
}

export default function SiengeMetasModal({
  projects, metas, categoriaOrcamento, projectTotais, projectDisplays, onSaveMeta, onDeleteMeta, onSaveCategoria, onDeleteCategoria, onSaveProjectTotal, onSaveProjectDisplay, tabelaVendas, onClose,
}: SiengeMetasModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'metas' | 'alocacao'>('metas');

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const projectAlocacoes = useMemo(
    () => categoriaOrcamento.filter(c => c.projectId === selectedProjectId),
    [categoriaOrcamento, selectedProjectId]
  );

  const totalAlocadoPct = projectAlocacoes.reduce((s, c) => s + c.percentual, 0);

  const handlePercentualChange = (centroCusto: SiengeCentroCusto, categoria: string, value: string) => {
    if (!selectedProjectId) return;
    const pct = parseFloat(value.replace(',', '.'));
    const existing = projectAlocacoes.find(c => c.centroCusto === centroCusto && c.categoria === categoria);
    const item: SiengeCategoriaOrcamento = {
      id: existing?.id || crypto.randomUUID(),
      projectId: selectedProjectId,
      centroCusto,
      categoria,
      percentual: isNaN(pct) ? 0 : pct,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveCategoria(item);
  };

  return (
    <div className="flex flex-col h-full bg-[#08080a]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
            <Target size={16} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-100">Metas & Orçamento por Empreendimento</h2>
            <p className="text-[11px] text-zinc-600">Ajuste as metas mensais e a alocação de orçamento por categoria</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={13} /> Voltar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900/60 border border-zinc-800 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('metas')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'metas' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-500 border border-transparent hover:text-zinc-300'
              }`}
            >
              <Target size={12} /> Metas Mensais
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('alocacao')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'alocacao' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-500 border border-transparent hover:text-zinc-300'
              }`}
            >
              <PieChart size={12} /> Alocação de Orçamento
            </button>
          </div>

          {activeTab === 'metas' ? (
            // Planilha: linhas = empreendimentos, colunas = meses. Editar a meta é
            // digitar direto na célula — não há formulário separado de mês/ano.
            <SiengeMetasTable
              projects={projects}
              metas={metas}
              onSaveMeta={onSaveMeta}
              onDeleteMeta={onDeleteMeta}
              projectTotais={projectTotais}
              onSaveProjectTotal={onSaveProjectTotal}
              projectDisplays={projectDisplays}
              onSaveProjectDisplay={onSaveProjectDisplay}
              tabelaVendas={tabelaVendas}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Empreendimento selector — só a alocação de % é feita um empreendimento por vez */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  <Building2 size={11} /> Empreendimento
                </label>
                <button
                  type="button"
                  onClick={() => setIsProjectDropdownOpen(p => !p)}
                  className="w-full flex items-center justify-between bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm outline-none transition-all hover:bg-zinc-800/60"
                >
                  <span className={selectedProject ? 'text-zinc-100 font-medium' : 'text-zinc-500'}>
                    {selectedProject?.name || 'Selecione um empreendimento'}
                  </span>
                  <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isProjectDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsProjectDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#141417] border border-zinc-800/80 rounded-xl shadow-xl shadow-black/60 overflow-hidden animate-fade-in py-1">
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {projects.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setSelectedProjectId(p.id); setIsProjectDropdownOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                              p.id === selectedProjectId ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100'
                            }`}
                          >
                            <span className="font-medium text-[13px]">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {selectedProjectId && (
                <>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs text-zinc-500">Referência de orçamento total: <span className="text-zinc-300 font-semibold">{ORCAMENTO_ALVO_PCT}% do VGV</span></span>
                    <span className={`text-xs font-bold ${totalAlocadoPct > ORCAMENTO_ALVO_PCT ? 'text-red-400' : 'text-emerald-400'}`}>
                      {totalAlocadoPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% alocado
                    </span>
                  </div>
                  {(Object.keys(SIENGE_CATEGORIAS) as SiengeCentroCusto[]).map(cc => (
                    <div key={cc} className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{CENTRO_CUSTO_LABELS[cc]}</span>
                      {Object.keys(SIENGE_CATEGORIAS[cc]).map(categoria => {
                        const existing = projectAlocacoes.find(c => c.centroCusto === cc && c.categoria === categoria);
                        return (
                          <div key={categoria} className="flex items-center justify-between gap-3 px-3 py-1.5 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
                            <span className="text-xs text-zinc-300 truncate">{categoria}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <PercentStepper
                                value={existing?.percentual || 0}
                                onChange={v => handlePercentualChange(cc, categoria, String(v))}
                              />
                              {existing && (
                                <button type="button" onClick={() => onDeleteCategoria(existing.id)} className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
