import React from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, X } from 'lucide-react';
import { SiengeVendaSituacao } from '../../types';
import { SITUACAO_LABELS } from '../../lib/siengeVendasTabela';
import { HISTORICO_ORIGEM_LABELS, fetchUnidadeHistorico } from '../../lib/comercialApi';

const CHIP: Record<SiengeVendaSituacao, string> = {
  disponivel: 'text-blue-300 bg-blue-500/10 border-blue-500/25',
  reservado: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  vendida: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  permuta: 'text-violet-300 bg-violet-500/10 border-violet-500/25',
  bloqueada: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/25',
};

export function SituacaoChip({ situacao }: { situacao: SiengeVendaSituacao | null }) {
  if (!situacao) return <span className="text-[10px] text-zinc-600">—</span>;
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 border whitespace-nowrap ${CHIP[situacao] ?? CHIP.bloqueada}`}>
      {SITUACAO_LABELS[situacao] ?? situacao}
    </span>
  );
}

export const dataHoraBr = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

interface Props {
  projectId: string;
  unidade: string;
  onClose: () => void;
}

export default function UnidadeHistoricoModal({ projectId, unidade, onClose }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['siengeUnidadeHistorico'], queryFn: fetchUnidadeHistorico, staleTime: 30_000,
  });
  const linhas = (data ?? []).filter(h => h.projectId === projectId && h.unidade === unidade);

  // Portal: a tabela vive dentro de contêineres com overflow/transform, que
  // prenderiam um position: fixed.
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-xl border border-zinc-800 bg-[#0f0f12] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800/60 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Histórico da unidade {unidade}</h3>
            <p className="text-[11px] text-zinc-500">Cada alteração de situação, da mais recente para a mais antiga.</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200" title="Fechar"><X size={14} /></button>
        </header>

        <div className="p-3 space-y-2 overflow-y-auto scrollbar-minimal">
          {isLoading && <p className="text-[11px] text-zinc-500 text-center py-6">Carregando…</p>}
          {error && (
            <p className="text-[11px] text-rose-300 bg-rose-500/[0.06] border border-rose-500/20 rounded-md px-2.5 py-1.5">
              Não foi possível carregar o histórico: {(error as any)?.message}
            </p>
          )}
          {!isLoading && !error && linhas.length === 0 && (
            <p className="text-[11px] text-zinc-600 italic text-center py-6">Nenhuma alteração de situação registrada para esta unidade.</p>
          )}
          {linhas.map(h => (
            <div key={h.id} className="bg-[#121214] border border-zinc-900/60 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <SituacaoChip situacao={h.situacaoAnterior} />
                  <ArrowRight size={11} className="text-zinc-600" />
                  <SituacaoChip situacao={h.situacaoNova} />
                </div>
                <span className="text-[10px] text-zinc-500 tabular-nums">{dataHoraBr(h.createdAt)}</span>
              </div>
              <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
                {h.cliente && <><dt className="text-zinc-500">Cliente</dt><dd className="text-zinc-300">{h.cliente}</dd></>}
                {h.corretor && <><dt className="text-zinc-500">Corretor</dt><dd className="text-zinc-300">{h.corretor}</dd></>}
                {h.imobiliaria && <><dt className="text-zinc-500">Imobiliária</dt><dd className="text-zinc-300">{h.imobiliaria}</dd></>}
                {h.motivo && <><dt className="text-zinc-500">Motivo</dt><dd className="text-zinc-300 break-words">{h.motivo}</dd></>}
                <dt className="text-zinc-500">Origem</dt>
                <dd className="text-zinc-400">
                  {HISTORICO_ORIGEM_LABELS[h.origem] ?? h.origem}{h.alteradoPorNome ? ` · por ${h.alteradoPorNome}` : ''}
                </dd>
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
