import React, { useState } from 'react';
import { Repeat, Trash2, PauseCircle, PlayCircle, Building2, Tag, Calendar, Pencil, Layers } from 'lucide-react';
import { SiengeMensalidade, SiengeLote } from '../types';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from './ConfirmModal';

interface SiengeMensalidadesListProps {
  mensalidades: SiengeMensalidade[];
  openLotes: SiengeLote[];
  onSave: (m: SiengeMensalidade) => void;
  onDelete: (id: string) => void;
  onEdit: (m: SiengeMensalidade) => void;
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function SiengeMensalidadesList({
  mensalidades, openLotes, onSave, onDelete, onEdit,
}: SiengeMensalidadesListProps) {
  const { allUsers } = useAuth();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const ativas = mensalidades.filter(m => m.ativa);
  const totalMensal = ativas.reduce((acc, m) => acc + m.valor, 0);

  if (mensalidades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-600 text-sm gap-3">
        <Repeat size={26} className="text-zinc-700" />
        <div className="text-center">
          <p className="font-medium text-zinc-500">Nenhuma mensalidade cadastrada.</p>
          <p className="text-xs mt-1">Cadastre uma para que ela vire um título automaticamente todo dia 01.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap px-1">
        <p className="text-[11px] text-zinc-500">
          {ativas.length} ativa(s) de {mensalidades.length} · geradas todo dia 01 em "A Lançar"
        </p>
        <div className="text-[11px] text-zinc-400">
          Total mensal ativo: <strong className="text-zinc-200">{brl(totalMensal)}</strong>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {mensalidades.map(m => {
          const assignee = allUsers.find(u => u.id === m.assigneeId);
          const lote = openLotes.find(l => l.id === m.loteId);
          return (
            <div
              key={m.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                m.ativa
                  ? 'bg-zinc-900/40 border-zinc-800/70 hover:border-zinc-700'
                  : 'bg-zinc-900/20 border-zinc-800/40 opacity-60'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center shrink-0 border ${
                m.ativa ? 'bg-blue-500/10 border-blue-500/25 text-blue-400' : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-500'
              }`}>
                <span className="text-[13px] font-bold leading-none">{m.diaVencimento}</span>
                <span className="text-[7px] uppercase tracking-wider mt-0.5">dia</span>
              </div>

              <div className="flex flex-col min-w-0 flex-1 gap-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-zinc-200 truncate">
                    {m.descricao || m.titulo || 'Mensalidade'}
                  </span>
                  {!m.ativa && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-800/60 border-zinc-700/50">
                      Cancelada
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap text-[10px] text-zinc-500">
                  {m.empreendimento && (
                    <span className="flex items-center gap-1 min-w-0">
                      <Building2 size={9} className="shrink-0" />
                      <span className="truncate max-w-[140px]">{m.empreendimento}</span>
                    </span>
                  )}
                  {m.subcategoria && (
                    <span className="flex items-center gap-1 min-w-0">
                      <Tag size={9} className="shrink-0" />
                      <span className="truncate max-w-[160px]">{m.subcategoria}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Layers size={9} className="shrink-0" />
                    {lote ? lote.nome : 'sem lote'}
                  </span>
                  {assignee && (
                    <span className="flex items-center gap-1 min-w-0">
                      {assignee.avatarUrl && <img src={assignee.avatarUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />}
                      <span className="truncate max-w-[110px]">{assignee.name}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="text-sm font-semibold text-zinc-200 shrink-0 tabular-nums">
                {brl(m.valor)}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onEdit(m)}
                  className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-lg transition-colors"
                  title="Editar mensalidade"
                >
                  <Pencil size={14} />
                </button>
                {m.ativa ? (
                  <button
                    onClick={() => setCancelId(m.id)}
                    className="p-1.5 text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                    title="Cancelar recorrência (para de gerar novos títulos)"
                  >
                    <PauseCircle size={15} />
                  </button>
                ) : (
                  <button
                    onClick={() => onSave({ ...m, ativa: true })}
                    className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                    title="Reativar recorrência"
                  >
                    <PlayCircle size={15} />
                  </button>
                )}
                <button
                  onClick={() => setDeleteId(m.id)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Remover mensalidade"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {cancelId && (
        <ConfirmModal
          isOpen={true}
          title="Cancelar Recorrência"
          message="Esta mensalidade deixa de gerar novos títulos a partir do próximo dia 01. Os títulos já gerados não são afetados, e você pode reativá-la depois."
          confirmText="Cancelar Recorrência"
          onConfirm={() => {
            const m = mensalidades.find(x => x.id === cancelId);
            if (m) onSave({ ...m, ativa: false });
            setCancelId(null);
          }}
          onCancel={() => setCancelId(null)}
        />
      )}

      {deleteId && (
        <ConfirmModal
          isOpen={true}
          title="Remover Mensalidade"
          message="A mensalidade será apagada e não gerará mais títulos. Os títulos já gerados permanecem no kanban. Esta ação não pode ser desfeita."
          confirmText="Remover"
          onConfirm={() => { onDelete(deleteId); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
