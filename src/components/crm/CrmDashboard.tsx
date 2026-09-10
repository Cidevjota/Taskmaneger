import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Zap, CalendarClock, Sparkles, Hourglass,
  BadgeCheck, Send, ArrowRight, CircleSlash,
} from 'lucide-react';
import { Project } from '../../types';
import { UserProfile } from '../../context/AuthContext';
import { CrmConfig, CrmLead, CrmNextAction } from '../../lib/crmTypes';
import { indexarAcoesPendentes, quandoCurto, resumirOperacao } from '../../lib/crmDerive';
import { CORES_URGENCIA, TemperaturaChip, EtapaChip } from './CrmShared';

interface Props {
  leads: CrmLead[];
  acoes: CrmNextAction[];
  projects: Project[];
  users: UserProfile[];
  config: CrmConfig;
  onOpenLead: (lead: CrmLead) => void;
  onVerNoKanban: (recorte: 'atrasadas' | 'agora' | 'hoje' | 'novos' | 'aguardando' | 'qualificados' | 'enviados') => void;
}

/**
 * Dashboard operacional: a pergunta que ele responde é "quem eu preciso atender
 * agora?". Por isso as filas de trabalho (atrasadas / agora / hoje) vêm primeiro
 * e com nome de lead à vista; as contagens de carteira ficam depois, resumidas.
 */
export default function CrmDashboard({
  leads, acoes, projects, users, config, onOpenLead, onVerNoKanban,
}: Props) {
  const resumo = useMemo(() => resumirOperacao(leads, acoes, config), [leads, acoes, config]);
  const pendentes = useMemo(() => indexarAcoesPendentes(acoes), [acoes]);

  const nomeProjeto = (id?: string | null) => projects.find(p => p.id === id)?.name;
  const nomeUsuario = (id?: string | null) => users.find(u => u.id === id)?.name;

  const filas = [
    {
      chave: 'atrasadas' as const,
      titulo: 'Ações atrasadas',
      subtitulo: 'Passou do horário combinado',
      icone: <AlertTriangle size={14} />,
      cor: CORES_URGENCIA.atrasada,
      leads: resumo.atrasadas,
    },
    {
      chave: 'agora' as const,
      titulo: 'Ações para agora',
      subtitulo: `Próximos ${config.janelaAgoraMin} minutos`,
      icone: <Zap size={14} />,
      cor: CORES_URGENCIA.agora,
      leads: resumo.agora,
    },
    {
      chave: 'hoje' as const,
      titulo: 'Previstas para hoje',
      subtitulo: 'Ainda dentro do dia',
      icone: <CalendarClock size={14} />,
      cor: CORES_URGENCIA.hoje,
      leads: resumo.hoje,
    },
  ];

  const carteira = [
    { chave: 'novos' as const,        titulo: 'Leads novos',            icone: <Sparkles size={13} />,   total: resumo.novos.length,            cor: 'text-blue-400' },
    { chave: 'aguardando' as const,   titulo: 'Aguardando retorno',     icone: <Hourglass size={13} />,  total: resumo.aguardandoRetorno.length, cor: 'text-amber-400' },
    { chave: 'qualificados' as const, titulo: 'Leads qualificados',     icone: <BadgeCheck size={13} />, total: resumo.qualificados.length,     cor: 'text-emerald-400' },
    { chave: 'enviados' as const,     titulo: 'Enviados ao CV CRM',     icone: <Send size={13} />,       total: resumo.enviadosCv.length,       cor: 'text-violet-400' },
  ];

  const totalPendente = resumo.atrasadas.length + resumo.agora.length + resumo.hoje.length;

  return (
    <div className="h-full overflow-y-auto scrollbar-minimal view-pad">
      {/* Chamada do dia: uma frase que resume a fila de trabalho */}
      <div className="mb-4 short:mb-3">
        <h2 className="text-base short:text-sm font-semibold text-zinc-100">
          {totalPendente === 0
            ? 'Nenhuma ação pendente para hoje.'
            : `${totalPendente} ${totalPendente === 1 ? 'lead precisa' : 'leads precisam'} de você hoje.`}
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          {resumo.atrasadas.length > 0
            ? `${resumo.atrasadas.length} em atraso — comece por elas.`
            : 'Nada em atraso. Siga pela ordem das próximas ações.'}
          {resumo.semProximaAcao.length > 0 && (
            <> · <span className="text-amber-500">{resumo.semProximaAcao.length}</span> sem próxima ação definida.</>
          )}
        </p>
      </div>

      {/* Filas de trabalho */}
      <div className="grid grid-cols-1 lg:grid-cols-3 view-gap-sm mb-4 short:mb-3">
        {filas.map((fila, i) => (
          <motion.section
            key={fila.chave}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: i * 0.04 }}
            className={`rounded-xl border ${fila.cor.border} ${fila.cor.bg} flex flex-col min-h-0`}
          >
            <header className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/50">
              <div className="flex items-center gap-2">
                <span className={fila.cor.text}>{fila.icone}</span>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200">{fila.titulo}</h3>
                  <p className="text-[10px] text-zinc-500">{fila.subtitulo}</p>
                </div>
              </div>
              <span className={`text-lg font-semibold tabular-nums ${fila.cor.text}`}>{fila.leads.length}</span>
            </header>

            <div className="flex-1 p-2 space-y-1 max-h-[320px] overflow-y-auto scrollbar-minimal">
              {fila.leads.length === 0 ? (
                <p className="text-[11px] text-zinc-600 italic px-2 py-6 text-center">Nada por aqui.</p>
              ) : (
                fila.leads.slice(0, 12).map(lead => {
                  const acao = pendentes.get(lead.id);
                  return (
                    <button
                      key={lead.id}
                      onClick={() => onOpenLead(lead)}
                      className="w-full text-left bg-[#121214] hover:bg-[#17171b] border border-zinc-900/60 hover:border-zinc-800 rounded-lg px-2.5 py-2 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-zinc-200 truncate">{lead.nome}</span>
                        <TemperaturaChip valor={lead.temperatura} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-zinc-500 min-w-0">
                        {acao && (
                          <span className={`font-semibold ${fila.cor.text} shrink-0`}>
                            {acao.tipo} · {quandoCurto(acao.agendadoPara)}
                          </span>
                        )}
                        {nomeProjeto(lead.projectId) && (
                          <span className="truncate">· {nomeProjeto(lead.projectId)}</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
              {fila.leads.length > 12 && (
                <button
                  onClick={() => onVerNoKanban(fila.chave)}
                  className="w-full flex items-center justify-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 py-1.5 transition-colors"
                >
                  ver os outros {fila.leads.length - 12} <ArrowRight size={10} />
                </button>
              )}
            </div>
          </motion.section>
        ))}
      </div>

      {/* Carteira — contagem, não fila de trabalho */}
      <div className="grid grid-cols-2 lg:grid-cols-4 view-gap-sm mb-4 short:mb-3">
        {carteira.map((c, i) => (
          <motion.button
            key={c.chave}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: 0.12 + i * 0.03 }}
            onClick={() => onVerNoKanban(c.chave)}
            className="text-left bg-[#0f0f12] hover:bg-[#141418] border border-zinc-900/60 hover:border-zinc-800 rounded-xl px-3 py-2.5 transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className={c.cor}>{c.icone}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{c.titulo}</span>
            </div>
            <span className="text-xl font-semibold text-zinc-100 tabular-nums">{c.total}</span>
          </motion.button>
        ))}
      </div>

      {/* Leads sem próxima ação: buraco na operação, então tem destaque próprio */}
      {resumo.semProximaAcao.length > 0 && (
        <section className="rounded-xl border border-amber-500/25 bg-amber-500/[0.03]">
          <header className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800/50">
            <CircleSlash size={14} className="text-amber-400" />
            <h3 className="text-xs font-semibold text-zinc-200">Sem próxima ação definida</h3>
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-900/60">
              {resumo.semProximaAcao.length}
            </span>
            <span className="text-[10px] text-zinc-500 ml-1">Todo lead ativo precisa de uma.</span>
          </header>
          <div className="p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1 max-h-[220px] overflow-y-auto scrollbar-minimal">
            {resumo.semProximaAcao.map(lead => (
              <button
                key={lead.id}
                onClick={() => onOpenLead(lead)}
                className="text-left bg-[#121214] hover:bg-[#17171b] border border-zinc-900/60 hover:border-zinc-800 rounded-lg px-2.5 py-2 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200 truncate">{lead.nome}</span>
                  <EtapaChip etapa={lead.etapa} />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 truncate">
                  {nomeProjeto(lead.projectId) || 'Sem empreendimento'}
                  {nomeUsuario(lead.responsavelId) ? ` · ${nomeUsuario(lead.responsavelId)}` : ' · sem responsável'}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
