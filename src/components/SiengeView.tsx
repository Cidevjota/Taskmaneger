import React, { useState } from 'react';
import { SiengeTitle, SiengeLote, SiengeFatura, Project, SiengeAlcadaConfig } from '../types';
import SiengeKanban from './SiengeKanban';
import SiengeLotes from './SiengeLotes';
import SiengeFaturas from './SiengeFaturas';

interface SiengeViewProps {
  titles: SiengeTitle[];
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
}

export default function SiengeView({
  titles, lotes, faturas, projects, currentProjectFilter, alcadaConfig,
  onSaveTitle, onDeleteTitle, onSaveLote, onDeleteLote, onSaveFatura, onDeleteFatura, onSaveAlcadaConfig
}: SiengeViewProps) {
  const [activeTab, setActiveTab] = useState<'titulos' | 'lotes' | 'faturas'>('titulos');
  const openLotes = lotes.filter(l => l.status === 'aberto');
  const openFaturas = faturas.filter(f => f.status === 'aberto');

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
          />
        ) : activeTab === 'lotes' ? (
          <SiengeLotes
            lotes={lotes}
            titles={titles}
            onSaveLote={onSaveLote}
            onDeleteLote={onDeleteLote}
          />
        ) : (
          <SiengeFaturas
            faturas={faturas}
            titles={titles}
            onSaveFatura={onSaveFatura}
            onDeleteFatura={onDeleteFatura}
          />
        )}
      </div>
    </div>
  );
}
