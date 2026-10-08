import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Search, X } from 'lucide-react';
import { Project, SiengeVendaSituacao } from '../../types';
import { SITUACAO_LABELS } from '../../lib/siengeVendasTabela';
import { HISTORICO_ORIGEM_LABELS, fetchUnidadeHistorico } from '../../lib/comercialApi';
import { inputCls, selectCls } from '../crm/CrmShared';
import { SituacaoChip, dataHoraBr } from './UnidadeHistoricoModal';

const SITUACOES = Object.keys(SITUACAO_LABELS) as SiengeVendaSituacao[];

// Dia local (yyyy-mm-dd) do registro, para comparar com os campos de data do filtro.
const diaLocal = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const distintos = (valores: (string | null)[]) =>
  Array.from(new Set(valores.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b, 'pt-BR'));

export default function ComercialHistorico({ projects }: { projects: Project[] }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['siengeUnidadeHistorico'], queryFn: fetchUnidadeHistorico, staleTime: 30_000,
  });
  const historico = data ?? [];

  const [projectId, setProjectId] = useState('');
  const [situacao, setSituacao] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [busca, setBusca] = useState('');
  const [corretor, setCorretor] = useState('');
  const [imobiliaria, setImobiliaria] = useState('');

  const nomeProjeto = (id: string) => projects.find(p => p.id === id)?.name || '—';

  const projetosComHistorico = useMemo(() => {
    const ids = new Set(historico.map(h => h.projectId));
    return projects.filter(p => ids.has(p.id));
  }, [historico, projects]);
  const corretores = useMemo(() => distintos(historico.map(h => h.corretor)), [historico]);
  const imobiliarias = useMemo(() => distintos(historico.map(h => h.imobiliaria)), [historico]);

  const filtrado = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return historico.filter(h => {
      if (projectId && h.projectId !== projectId) return false;
      // Situação filtra pelo destino da mudança: "Vendida" lista as vendas.
      if (situacao && h.situacaoNova !== situacao) return false;
      if (corretor && h.corretor !== corretor) return false;
      if (imobiliaria && h.imobiliaria !== imobiliaria) return false;
      if (termo && !h.unidade.toLowerCase().includes(termo)) return false;
      const dia = diaLocal(h.createdAt);
      if (de && dia < de) return false;
      if (ate && dia > ate) return false;
      return true;
    });
  }, [historico, projectId, situacao, corretor, imobiliaria, busca, de, ate]);

  const filtrosAtivos = [projectId, situacao, de, ate, busca, corretor, imobiliaria].filter(Boolean).length;
  const limpar = () => {
    setProjectId(''); setSituacao(''); setDe(''); setAte(''); setBusca(''); setCorretor(''); setImobiliaria('');
  };

  const resumo = useMemo(() => SITUACOES
    .map(s => ({ s, n: filtrado.filter(h => h.situacaoNova === s).length }))
    .filter(x => x.n > 0), [filtrado]);

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* ── filtros ─────────────────────────────────────────────────────── */}
      <div className="view-pad-x py-2.5 short:py-2 border-b border-zinc-900/60 shrink-0 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar unidade…" className={`${inputCls} pl-7 !w-40`}
          />
        </div>
        <select className={`${selectCls} !w-48`} value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">Todos os empreendimentos</option>
          {projetosComHistorico.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className={`${selectCls} !w-40`} value={situacao} onChange={e => setSituacao(e.target.value)}>
          <option value="">Todas as situações</option>
          {SITUACOES.map(s => <option key={s} value={s}>Passou para {SITUACAO_LABELS[s]}</option>)}
        </select>
        <select className={`${selectCls} !w-40`} value={corretor} onChange={e => setCorretor(e.target.value)}>
          <option value="">Todos os corretores</option>
          {corretores.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={`${selectCls} !w-44`} value={imobiliaria} onChange={e => setImobiliaria(e.target.value)}>
          <option value="">Todas as imobiliárias</option>
          {imobiliarias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          de <input type="date" className={`${inputCls} !w-36`} value={de} onChange={e => setDe(e.target.value)} />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          até <input type="date" className={`${inputCls} !w-36`} value={ate} onChange={e => setAte(e.target.value)} />
        </label>
        {filtrosAtivos > 0 && (
          <button onClick={limpar} className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 px-1.5 py-1.5">
            <X size={11} /> Limpar ({filtrosAtivos})
          </button>
        )}
        <span className="ml-auto text-[11px] text-zinc-500 tabular-nums">
          {filtrado.length} de {historico.length} alterações
        </span>
      </div>

      {resumo.length > 0 && (
        <div className="view-pad-x py-2 border-b border-zinc-900/60 shrink-0 flex items-center gap-3 flex-wrap text-[11px] text-zinc-400">
          {resumo.map(({ s, n }) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <SituacaoChip situacao={s} /> <span className="tabular-nums text-zinc-300">{n}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── tabela ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto scrollbar-minimal view-pad">
        {error ? (
          <p className="text-[11px] text-rose-300 bg-rose-500/[0.06] border border-rose-500/20 rounded-md px-2.5 py-1.5">
            Não foi possível carregar o histórico: {(error as any)?.message}
          </p>
        ) : isLoading ? (
          <p className="text-xs text-zinc-500 text-center py-10">Carregando…</p>
        ) : filtrado.length === 0 ? (
          <p className="text-xs text-zinc-600 italic text-center py-10">
            {historico.length === 0 ? 'Nenhuma alteração de situação registrada ainda.' : 'Nenhuma alteração corresponde aos filtros.'}
          </p>
        ) : (
          <table className="w-full border-separate border-spacing-y-1 text-xs">
            <thead>
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {['Data', 'Empreendimento', 'Unidade', 'Situação', 'Cliente', 'Corretor', 'Imobiliária', 'Motivo', 'Origem'].map(t => (
                  <th key={t} className="sticky top-0 z-10 bg-[#08080a] px-3 py-1.5 whitespace-nowrap">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrado.map(h => (
                <tr key={h.id} className="[&>td]:bg-[#0f0f12] [&>td]:border-y [&>td]:border-zinc-900/60 [&>td:first-child]:border-l [&>td:first-child]:rounded-l-lg [&>td:last-child]:border-r [&>td:last-child]:rounded-r-lg">
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-400 tabular-nums">{dataHoraBr(h.createdAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-300">{nomeProjeto(h.projectId)}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-zinc-100">{h.unidade}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <SituacaoChip situacao={h.situacaoAnterior} />
                      <ArrowRight size={11} className="text-zinc-600" />
                      <SituacaoChip situacao={h.situacaoNova} />
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-300">{h.cliente || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-300">{h.corretor || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-300">{h.imobiliaria || '—'}</td>
                  <td className="px-3 py-2 text-zinc-500 min-w-[200px]">{h.motivo || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-500">
                    {HISTORICO_ORIGEM_LABELS[h.origem] ?? h.origem}{h.alteradoPorNome ? ` · ${h.alteradoPorNome}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
