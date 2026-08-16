import React from 'react';
import { ArrowLeft, Target } from 'lucide-react';
import { Project, SiengeProjectMeta, SiengeProjectDisplay, SiengeTabelaVendaUnidade } from '../types';
import SiengeMetasTable from './SiengeMetasTable';

interface SiengeMetasModalProps {
  projects: Project[];
  metas: SiengeProjectMeta[];
  projectDisplays: SiengeProjectDisplay[];
  onSaveMeta: (meta: SiengeProjectMeta) => void;
  onDeleteMeta: (id: string) => void;
  onSaveProjectDisplay: (display: SiengeProjectDisplay) => void;
  tabelaVendas: SiengeTabelaVendaUnidade[];
  onClose: () => void;
}

export default function SiengeMetasModal({
  projects, metas, projectDisplays, onSaveMeta, onDeleteMeta, onSaveProjectDisplay, tabelaVendas, onClose,
}: SiengeMetasModalProps) {
  return (
    <div className="flex flex-col h-full bg-[#08080a]">
      {/* Header */}
      <div className="flex items-center justify-between view-pad-x py-4 short:py-2.5 border-b border-zinc-900/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
            <Target size={16} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-100">Metas Mensais por Empreendimento</h2>
            <p className="text-[11px] text-zinc-600">Ajuste a meta de VGV/unidades de cada mês, direto na planilha</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-zinc-100 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={13} /> Voltar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto view-pad-x view-pad-y flex flex-col view-gap-sm">
        <SiengeMetasTable
          projects={projects}
          metas={metas}
          onSaveMeta={onSaveMeta}
          onDeleteMeta={onDeleteMeta}
          projectDisplays={projectDisplays}
          onSaveProjectDisplay={onSaveProjectDisplay}
          tabelaVendas={tabelaVendas}
        />
      </div>
    </div>
  );
}
