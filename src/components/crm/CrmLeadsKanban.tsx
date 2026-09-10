import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Filter, X, Search, Users, ChevronDown, Layers, Clock, CalendarClock,
} from 'lucide-react';
import { Project } from '../../types';
import { UserProfile } from '../../context/AuthContext';
import {
  CrmConfig, CrmEtapa, CrmEventType, CrmFaixaInvestimento, CrmLead,
  CrmLeadFilters, CrmNextAction, CrmOrigem,
  CRM_ETAPAS, CRM_FILTROS_VAZIOS, crmFiltrosAtivos,
} from '../../lib/crmTypes';
import {
  filtrarLeads, indexarAcoesPendentes, quandoCurto, urgenciaDaAcao,
} from '../../lib/crmDerive';
import {
  CORES_URGENCIA, CrmButton, EventIcon, TemperaturaChip, corCrm, inputCls, selectCls,
} from './CrmShared';

interface Props {
  leads: CrmLead[];
  acoes: CrmNextAction[];
  eventTypes: CrmEventType[];
  origens: CrmOrigem[];
  faixas: CrmFaixaInvestimento[];
  projects: Project[];
  users: UserProfile[];
  config: CrmConfig;
  filtros: CrmLeadFilters;
  onFiltrosChange: (f: CrmLeadFilters) => void;
  podeEditar: boolean;
  onOpenLead: (lead: CrmLead) => void;
  onNovoLead: (etapa: CrmEtapa) => void;
  onMoverLead: (leadId: string, etapa: CrmEtapa) => void;
  onRegistrarEvento: (lead: CrmLead, tipo: CrmEventType) => void;
}

/** Popover de seleção múltipla usado por Empreendimento / Origem / Responsável. */
function MultiSelect({
  label, opcoes, selecionados, onChange, icone,
}: {
  label: string;
  opcoes: { id: string; nome: string }[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
  icone?: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  const alternar = (id: string) =>
    onChange(selecionados.includes(id) ? selecionados.filter(x => x !== id) : [...selecionados, id]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto(a => !a)}
        className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
          selecionados.length
            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
        }`}
      >
        {icone}
        {label}
        {selecionados.length > 0 && (
          <span className="text-[9px] font-bold bg-blue-500/20 rounded px-1">{selecionados.length}</span>
        )}
        <ChevronDown size={11} />
      </button>
      {aberto && (
        <div className="absolute z-30 mt-1 w-56 max-h-64 overflow-y-auto scrollbar-minimal bg-[#0d0d10] border border-zinc-800 rounded-lg shadow-xl p-1">
          {opcoes.length === 0 && <p className="text-[11px] text-zinc-600 px-2 py-2">Nada cadastrado.</p>}
          {opcoes.map(o => (
            <button
              key={o.id}
              onClick={() => alternar(o.id)}
              className="w-full flex items-center gap-2 text-left text-[11px] px-2 py-1.5 rounded hover:bg-zinc-900 text-zinc-300"
            >
              <span className={`w-3 h-3 rounded border shrink-0 ${
                selecionados.includes(o.id) ? 'bg-blue-500 border-blue-500' : 'border-zinc-700'
              }`} />
              <span className="truncate">{o.nome}</span>
            </button>
          ))}
          {selecionados.length > 0 && (
            <button onClick={() => onChange([])}
              className="w-full text-left text-[10px] px-2 py-1.5 mt-1 border-t border-zinc-900 text-zinc-500 hover:text-zinc-300">
              Limpar seleção
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CrmLeadsKanban({
  leads, acoes, eventTypes, origens, projects, users, config,
  filtros, onFiltrosChange, podeEditar, onOpenLead, onNovoLead, onMoverLead, onRegistrarEvento,
}: Props) {
  const [dragOver, setDragOver] = useState<CrmEtapa | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [painelFiltros, setPainelFiltros] = useState(false);

  const pendentes = useMemo(() => indexarAcoesPendentes(acoes), [acoes]);
  const visiveis = useMemo(
    () => filtrarLeads(leads, filtros, acoes, config),
    [leads, filtros, acoes, config]
  );

  // Só os eventos não-sistema viram botão no card; e no card cabem três.
  const botoesCard = useMemo(
    () => eventTypes.filter(t => t.ativo && !t.sistema).slice(0, 3),
    [eventTypes]
  );

  const porEtapa = (etapa: CrmEtapa) => visiveis.filter(l => l.etapa === etapa);
  const ativos = crmFiltrosAtivos(filtros);
  const set = (patch: Partial<CrmLeadFilters>) => onFiltrosChange({ ...filtros, ...patch });

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── barra de filtros ─────────────────────────────────────────────── */}
      <div className="view-pad-x py-2.5 short:py-2 border-b border-zinc-900/60 shrink-0 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            value={filtros.busca}
            onChange={e => set({ busca: e.target.value })}
            placeholder="Buscar por nome ou telefone…"
            className={`${inputCls} pl-7 w-56`}
          />
        </div>

        <MultiSelect
          label="Empreendimento"
          opcoes={projects.map(p => ({ id: p.id, nome: p.name }))}
          selecionados={filtros.projectIds}
          onChange={ids => set({ projectIds: ids })}
        />
        <MultiSelect
          label="Origem"
          opcoes={origens.filter(o => o.ativo).map(o => ({ id: o.id, nome: o.nome }))}
          selecionados={filtros.origemIds}
          onChange={ids => set({ origemIds: ids })}
        />
        <MultiSelect
          label="Responsável"
          icone={<Users size={11} />}
          opcoes={users.map(u => ({ id: u.id, nome: u.name }))}
          selecionados={filtros.responsavelIds}
          onChange={ids => set({ responsavelIds: ids })}
        />
        <MultiSelect
          label="Status"
          opcoes={CRM_ETAPAS.map(e => ({ id: e.id, nome: e.label }))}
          selecionados={filtros.etapas}
          onChange={ids => set({ etapas: ids as CrmEtapa[] })}
        />

        <select
          value={filtros.proximaAcao}
          onChange={e => set({ proximaAcao: e.target.value as CrmLeadFilters['proximaAcao'] })}
          className={`${selectCls} w-40`}
        >
          <option value="todas">Próxima ação: todas</option>
          <option value="atrasadas">Atrasadas</option>
          <option value="agora">Para agora</option>
          <option value="hoje">Até o fim de hoje</option>
          <option value="sem_acao">Sem próxima ação</option>
        </select>

        <button
          onClick={() => set({ somenteAtrasados: !filtros.somenteAtrasados })}
          className={`text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
            filtros.somenteAtrasados
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Atrasados
        </button>

        <select
          value={filtros.enviadosCv}
          onChange={e => set({ enviadosCv: e.target.value as CrmLeadFilters['enviadosCv'] })}
          className={`${selectCls} w-36`}
        >
          <option value="incluir">CV CRM: incluir</option>
          <option value="ocultar">CV CRM: ocultar</option>
          <option value="somente">CV CRM: somente</option>
        </select>

        <button
          onClick={() => setPainelFiltros(p => !p)}
          className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
            filtros.entradaDe || filtros.entradaAte
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Filter size={11} /> Data de entrada
        </button>

        {ativos > 0 && (
          <button
            onClick={() => onFiltrosChange({ ...CRM_FILTROS_VAZIOS })}
            className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 px-1.5 py-1.5"
          >
            <X size={11} /> Limpar ({ativos})
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-zinc-500 tabular-nums">
            {visiveis.length} de {leads.length} leads
          </span>
          {podeEditar && (
            <CrmButton variant="primary" onClick={() => onNovoLead('novo')}>
              <Plus size={12} /> Novo lead
            </CrmButton>
          )}
        </div>
      </div>

      {painelFiltros && (
        <div className="view-pad-x py-2 border-b border-zinc-900/60 shrink-0 flex items-center gap-3 text-[11px] text-zinc-400 bg-[#0b0b0e]">
          <span className="uppercase tracking-wider text-[10px] font-semibold text-zinc-500">Entrada</span>
          <label className="flex items-center gap-1.5">
            de
            <input type="date" value={filtros.entradaDe || ''} onChange={e => set({ entradaDe: e.target.value || undefined })}
              className={`${inputCls} w-36`} />
          </label>
          <label className="flex items-center gap-1.5">
            até
            <input type="date" value={filtros.entradaAte || ''} onChange={e => set({ entradaAte: e.target.value || undefined })}
              className={`${inputCls} w-36`} />
          </label>
          {(filtros.entradaDe || filtros.entradaAte) && (
            <button onClick={() => set({ entradaDe: undefined, entradaAte: undefined })}
              className="text-zinc-500 hover:text-zinc-300">limpar período</button>
          )}
        </div>
      )}

      {/* ── colunas ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-x-auto min-h-0 view-gap scrollbar-minimal view-pad">
        {CRM_ETAPAS.map((coluna, i) => {
          const colLeads = porEtapa(coluna.id);
          const alvo = dragOver === coluna.id;

          return (
            <motion.div
              key={coluna.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: i * 0.03 }}
              className="relative flex-1 kanban-col h-full flex flex-col"
            >
              <div
                className={`group/column w-full h-full rounded-xl border transition-all duration-200 flex flex-col ${
                  alvo ? `${coluna.accentBg} ${coluna.accentBorder}` : 'bg-transparent border-transparent'
                }`}
                onDragOver={e => { if (podeEditar) { e.preventDefault(); setDragOver(coluna.id); } }}
                onDragLeave={() => setDragOver(d => (d === coluna.id ? null : d))}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(null);
                  const id = e.dataTransfer.getData('text/plain');
                  const lead = leads.find(l => l.id === id);
                  if (podeEditar && lead && lead.etapa !== coluna.id) onMoverLead(id, coluna.id);
                }}
              >
                <div className="flex items-center justify-between mb-2 px-3 shrink-0 py-2" title={coluna.descricao}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${coluna.dot}`} />
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider truncate">{coluna.label}</span>
                    <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-1.5 rounded border border-zinc-900/60 shrink-0">
                      {colLeads.length}
                    </span>
                  </div>
                  {podeEditar && (
                    <button
                      onClick={() => onNovoLead(coluna.id)}
                      className="opacity-0 group-hover/column:opacity-100 focus:opacity-100 p-1 rounded text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 transition-all"
                      title={`Novo lead em ${coluna.label}`}
                    >
                      <Plus size={13} />
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar px-2 pb-8">
                  <div className="flex flex-col space-y-2 min-h-[150px]">
                    {colLeads.length === 0 && !alvo ? (
                      <div className="h-24 border border-dashed border-zinc-900 rounded-xl flex flex-col items-center justify-center text-xs text-zinc-650 italic">
                        <Layers size={13} className="mb-1 text-zinc-750" />
                        <span>Sem leads</span>
                      </div>
                    ) : (
                      <AnimatePresence initial={false}>
                        {colLeads.map(lead => {
                          const acao = pendentes.get(lead.id);
                          const urgencia = acao ? urgenciaDaAcao(acao, config.janelaAgoraMin) : null;
                          const cor = CORES_URGENCIA[urgencia ?? 'sem_acao'];
                          const projeto = projects.find(p => p.id === lead.projectId);

                          return (
                            <motion.div
                              key={lead.id}
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: arrastando === lead.id ? 0.4 : 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15 }}
                            >
                            {/* O arrasto HTML5 fica num div comum: o motion.div tem
                                gestos próprios e os tipos de onDragStart colidem. */}
                            <div
                              draggable={podeEditar}
                              onDragStart={e => {
                                e.dataTransfer.setData('text/plain', lead.id);
                                setArrastando(lead.id);
                              }}
                              onDragEnd={() => { setArrastando(null); setDragOver(null); }}
                              onClick={() => onOpenLead(lead)}
                              className={`group bg-[#121214] hover:bg-[#161619] border rounded-lg p-2.5 transition-all cursor-pointer ${
                                urgencia === 'atrasada' ? 'border-rose-500/30' : 'border-zinc-900/60 hover:border-zinc-800'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="text-xs font-medium text-zinc-150 leading-snug break-words">{lead.nome}</span>
                                <TemperaturaChip valor={lead.temperatura} />
                              </div>

                              <p className="text-[10px] text-zinc-500 truncate mb-1.5">
                                {projeto?.name || 'Sem empreendimento'}
                              </p>

                              {/* Próxima ação — o dado mais importante do card */}
                              <div className={`flex items-center gap-1.5 text-[10px] rounded px-1.5 py-1 border ${cor.bg} ${cor.border} ${cor.text}`}>
                                {acao ? <Clock size={10} /> : <CalendarClock size={10} />}
                                <span className="font-semibold truncate">
                                  {acao ? `${acao.tipo} · ${quandoCurto(acao.agendadoPara)}` : 'Definir próxima ação'}
                                </span>
                              </div>

                              {/* Botões de evento: registram sem sair do kanban */}
                              {podeEditar && botoesCard.length > 0 && (
                                <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {botoesCard.map(tipo => {
                                    const c = corCrm(tipo.cor);
                                    return (
                                      <button
                                        key={tipo.id}
                                        title={tipo.label}
                                        onClick={e => { e.stopPropagation(); onRegistrarEvento(lead, tipo); }}
                                        className={`p-1 rounded border border-zinc-800 hover:bg-zinc-800 ${c.text} hover:border-zinc-700 transition-colors`}
                                      >
                                        <EventIcon name={tipo.icone} size={11} />
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
