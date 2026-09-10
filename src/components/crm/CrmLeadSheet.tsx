import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Phone, Mail, Building2, Radio, CalendarDays, GitBranch, User as UserIcon,
  Clock, Check, Trash2, Save, Target, Wallet, MessageSquarePlus, AlertTriangle,
} from 'lucide-react';
import { Project } from '../../types';
import { UserProfile } from '../../context/AuthContext';
import {
  CrmConfig, CrmEtapa, CrmEventType, CrmFaixaInvestimento, CrmLead, CrmLeadEvent,
  CrmNextAction, CrmOrigem, CrmPrioridade,
  CRM_ETAPAS, CRM_PRIORIDADES, CRM_TEMPERATURAS, CRM_TIPOS_ACAO,
} from '../../lib/crmTypes';
import {
  agruparPorDia, combinarDataHora, dataHoraLonga, horaCurta, partirDataHora,
  quandoCurto, urgenciaDaAcao,
} from '../../lib/crmDerive';
import {
  CORES_URGENCIA, Campo, CrmButton, EventIcon, corCrm, inputCls, selectCls,
} from './CrmShared';

interface Props {
  lead: CrmLead;
  /** Lead ainda não gravado: a folha abre em modo de cadastro. */
  isNovo: boolean;
  eventos: CrmLeadEvent[];
  acao: CrmNextAction | null;
  eventTypes: CrmEventType[];
  origens: CrmOrigem[];
  faixas: CrmFaixaInvestimento[];
  projects: Project[];
  users: UserProfile[];
  config: CrmConfig;
  podeEditar: boolean;
  onClose: () => void;
  onSalvar: (lead: Partial<CrmLead> & { nome: string }) => Promise<void>;
  onExcluir: (leadId: string) => Promise<void>;
  onRegistrarEvento: (tipo: CrmEventType, detalhe?: string | null) => Promise<void>;
  onExcluirEvento: (eventoId: string) => Promise<void>;
  onSalvarAcao: (dados: {
    id?: string; tipo: string; agendadoPara: string; prioridade: CrmPrioridade;
    observacao?: string | null; responsavelId?: string | null;
  }) => Promise<void>;
  onConcluirAcao: (id: string) => Promise<void>;
  onCancelarAcao: (id: string) => Promise<void>;
}

const hojeISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function CrmLeadSheet(props: Props) {
  const {
    lead, isNovo, eventos, acao, eventTypes, origens, faixas, projects, users,
    config, podeEditar, onClose, onSalvar, onExcluir,
    onRegistrarEvento, onExcluirEvento, onSalvarAcao, onConcluirAcao, onCancelarAcao,
  } = props;

  const [rascunho, setRascunho] = useState<CrmLead>(lead);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  // Evento que pede um dado extra (ex.: faixa de investimento) abre este prompt.
  const [eventoComDetalhe, setEventoComDetalhe] = useState<CrmEventType | null>(null);
  const [detalhe, setDetalhe] = useState('');

  useEffect(() => { setRascunho(lead); setErro(null); }, [lead.id]);

  const sujo = useMemo(
    () => JSON.stringify(rascunho) !== JSON.stringify(lead),
    [rascunho, lead]
  );

  const botoes = useMemo(
    () => eventTypes.filter(t => t.ativo && !t.sistema).sort((a, b) => a.ordem - b.ordem),
    [eventTypes]
  );

  const urgencia = acao ? urgenciaDaAcao(acao, config.janelaAgoraMin) : null;
  const corAcao = CORES_URGENCIA[urgencia ?? 'sem_acao'];

  const set = (patch: Partial<CrmLead>) => setRascunho(r => ({ ...r, ...patch }));

  const salvar = async () => {
    if (!rascunho.nome.trim()) { setErro('O lead precisa de um nome.'); return; }
    setSalvando(true); setErro(null);
    try {
      await onSalvar({ ...rascunho, nome: rascunho.nome.trim() });
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const registrar = async (tipo: CrmEventType) => {
    if (tipo.requerDetalhe) { setEventoComDetalhe(tipo); setDetalhe(''); return; }
    try { await onRegistrarEvento(tipo, null); }
    catch (e: any) { setErro(e?.message || 'Não foi possível registrar o evento.'); }
  };

  const confirmarDetalhe = async () => {
    if (!eventoComDetalhe) return;
    try {
      await onRegistrarEvento(eventoComDetalhe, detalhe.trim() || null);
      setEventoComDetalhe(null);
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível registrar o evento.');
    }
  };

  const qualificacaoCompleta = !!(rascunho.projectId && rascunho.objetivo && rascunho.faixaId);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[1080px] h-full bg-[#08080a] border-l border-zinc-900 flex flex-col"
      >
        {/* ── cabeçalho ──────────────────────────────────────────────────── */}
        <header className="shrink-0 border-b border-zinc-900/70 view-pad-x py-3 short:py-2.5">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <input
                value={rascunho.nome}
                onChange={e => set({ nome: e.target.value })}
                readOnly={!podeEditar}
                placeholder="Nome do lead"
                className="w-full bg-transparent text-lg short:text-base font-semibold text-zinc-100 outline-none placeholder:text-zinc-700"
              />
              <div className="flex items-center gap-3 flex-wrap mt-1.5 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={11} />
                  <input
                    value={rascunho.telefone || ''}
                    onChange={e => set({ telefone: e.target.value })}
                    readOnly={!podeEditar}
                    placeholder="telefone"
                    className="bg-transparent outline-none text-zinc-300 w-32 placeholder:text-zinc-700"
                  />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={11} />
                  <input
                    value={rascunho.email || ''}
                    onChange={e => set({ email: e.target.value })}
                    readOnly={!podeEditar}
                    placeholder="e-mail"
                    className="bg-transparent outline-none text-zinc-300 w-44 placeholder:text-zinc-700"
                  />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={11} />
                  {isNovo ? 'entra agora' : `entrada ${dataHoraLonga(lead.entradaEm)}`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {podeEditar && sujo && (
                <CrmButton variant="primary" onClick={salvar} disabled={salvando}>
                  <Save size={12} /> {salvando ? 'Salvando…' : isNovo ? 'Criar lead' : 'Salvar'}
                </CrmButton>
              )}
              {podeEditar && !isNovo && (
                <CrmButton variant="danger" onClick={() => setConfirmarExclusao(true)} title="Excluir lead">
                  <Trash2 size={12} />
                </CrmButton>
              )}
              <button onClick={onClose} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Grade do cabeçalho: empreendimento, origem, etapa, responsável */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            <label className="flex items-center gap-1.5 bg-[#0d0d10] border border-zinc-900 rounded-md px-2 py-1.5">
              <Building2 size={11} className="text-zinc-600 shrink-0" />
              <select
                value={rascunho.projectId || ''}
                onChange={e => set({ projectId: e.target.value || null })}
                disabled={!podeEditar}
                className="flex-1 bg-transparent text-[11px] text-zinc-300 outline-none cursor-pointer min-w-0"
              >
                <option value="">Empreendimento…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>

            <label className="flex items-center gap-1.5 bg-[#0d0d10] border border-zinc-900 rounded-md px-2 py-1.5">
              <Radio size={11} className="text-zinc-600 shrink-0" />
              <select
                value={rascunho.origemId || ''}
                onChange={e => set({ origemId: e.target.value || null })}
                disabled={!podeEditar}
                className="flex-1 bg-transparent text-[11px] text-zinc-300 outline-none cursor-pointer min-w-0"
              >
                <option value="">Origem…</option>
                {origens.filter(o => o.ativo).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </label>

            <label className="flex items-center gap-1.5 bg-[#0d0d10] border border-zinc-900 rounded-md px-2 py-1.5">
              <GitBranch size={11} className="text-zinc-600 shrink-0" />
              <select
                value={rascunho.etapa}
                onChange={e => set({ etapa: e.target.value as CrmEtapa })}
                disabled={!podeEditar}
                className="flex-1 bg-transparent text-[11px] text-zinc-300 outline-none cursor-pointer min-w-0"
              >
                {CRM_ETAPAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </label>

            <label className="flex items-center gap-1.5 bg-[#0d0d10] border border-zinc-900 rounded-md px-2 py-1.5">
              <UserIcon size={11} className="text-zinc-600 shrink-0" />
              <select
                value={rascunho.responsavelId || ''}
                onChange={e => set({ responsavelId: e.target.value || null })}
                disabled={!podeEditar}
                className="flex-1 bg-transparent text-[11px] text-zinc-300 outline-none cursor-pointer min-w-0"
              >
                <option value="">Responsável…</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
          </div>

          {/* Próxima ação em destaque: é o que o cabeçalho precisa responder */}
          <div className={`mt-2 flex items-center gap-2 text-[11px] rounded-md px-2.5 py-1.5 border ${corAcao.bg} ${corAcao.border} ${corAcao.text}`}>
            <Clock size={12} />
            <span className="font-semibold">
              {acao
                ? `Próxima ação: ${acao.tipo} · ${quandoCurto(acao.agendadoPara)} · ${CRM_PRIORIDADES.find(p => p.id === acao.prioridade)?.label}`
                : 'Sem próxima ação definida — todo lead ativo precisa de uma.'}
            </span>
            {acao && <span className="ml-auto uppercase tracking-wider text-[9px] font-bold opacity-80">{corAcao.label}</span>}
          </div>

          {erro && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-400">
              <AlertTriangle size={11} /> {erro}
            </p>
          )}
        </header>

        {/* ── corpo ──────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Coluna esquerda: eventos + timeline */}
          <section className="min-h-0 overflow-y-auto scrollbar-minimal view-pad border-r border-zinc-900/60">
            {isNovo ? (
              <p className="text-xs text-zinc-500 italic">
                Salve o lead para começar a registrar eventos e montar a timeline.
              </p>
            ) : (
              <>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Registrar evento</h3>
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {botoes.length === 0 && (
                    <p className="text-[11px] text-zinc-600 italic">Nenhum tipo de evento ativo. Cadastre em Configurações.</p>
                  )}
                  {botoes.map(tipo => {
                    const c = corCrm(tipo.cor);
                    return (
                      <button
                        key={tipo.id}
                        onClick={() => registrar(tipo)}
                        disabled={!podeEditar}
                        className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md border transition-colors disabled:opacity-40 ${c.bg} ${c.border} ${c.text} hover:brightness-125`}
                      >
                        <EventIcon name={tipo.icone} size={12} />
                        {tipo.label}
                      </button>
                    );
                  })}
                </div>

                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Timeline</h3>
                {eventos.length === 0 ? (
                  <p className="text-[11px] text-zinc-600 italic">Nada registrado ainda.</p>
                ) : (
                  <div className="space-y-4">
                    {agruparPorDia(eventos).map(grupo => (
                      <div key={grupo.dia}>
                        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1.5">{grupo.dia}</p>
                        <ol className="relative border-l border-zinc-900 ml-1.5 space-y-0.5">
                          {grupo.itens.map(ev => {
                            const tipo = eventTypes.find(t => t.slug === ev.slug);
                            const c = corCrm(tipo?.cor || 'zinc');
                            const autor = users.find(u => u.id === ev.createdBy);
                            return (
                              <li key={ev.id} className="group relative pl-4 py-1.5">
                                <span className={`absolute -left-[5px] top-3 w-2 h-2 rounded-full ${c.dot}`} />
                                <div className="flex items-baseline gap-2">
                                  <span className="text-[10px] font-mono text-zinc-600 tabular-nums shrink-0">
                                    {horaCurta(ev.ocorridoEm)}
                                  </span>
                                  <span className="text-xs text-zinc-300">{ev.label}</span>
                                  {podeEditar && !tipo?.sistema && (
                                    <button
                                      onClick={() => onExcluirEvento(ev.id)}
                                      className="ml-auto opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all"
                                      title="Remover da timeline"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  )}
                                </div>
                                {(ev.detalhe || autor) && (
                                  <p className="text-[10px] text-zinc-600 pl-[38px] -mt-0.5">
                                    {ev.detalhe}
                                    {ev.detalhe && autor ? ' · ' : ''}
                                    {autor?.name}
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Coluna direita: próxima ação + qualificação + observações */}
          <section className="min-h-0 overflow-y-auto scrollbar-minimal view-pad space-y-5">
            <ProximaAcaoForm
              acao={acao}
              users={users}
              podeEditar={podeEditar && !isNovo}
              onSalvar={onSalvarAcao}
              onConcluir={onConcluirAcao}
              onCancelar={onCancelarAcao}
            />

            <div>
              <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                <Target size={11} /> Qualificação
                {qualificacaoCompleta && <span className="text-emerald-500 normal-case tracking-normal">· completa</span>}
              </h3>
              <div className="space-y-2.5">
                <Campo label="Empreendimento de interesse">
                  <select
                    value={rascunho.projectId || ''}
                    onChange={e => set({ projectId: e.target.value || null })}
                    disabled={!podeEditar}
                    className={selectCls}
                  >
                    <option value="">Selecione…</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Campo>

                <Campo label="Objetivo">
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['morar', 'investir'] as const).map(op => (
                      <button
                        key={op}
                        onClick={() => podeEditar && set({ objetivo: rascunho.objetivo === op ? null : op })}
                        className={`text-[11px] font-medium py-1.5 rounded-md border transition-colors ${
                          rascunho.objetivo === op
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {op === 'morar' ? 'Morar' : 'Investir'}
                      </button>
                    ))}
                  </div>
                </Campo>

                <Campo label="Faixa de investimento">
                  <select
                    value={rascunho.faixaId || ''}
                    onChange={e => set({ faixaId: e.target.value || null })}
                    disabled={!podeEditar}
                    className={selectCls}
                  >
                    <option value="">Selecione…</option>
                    {faixas.filter(f => f.ativo).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </Campo>

                <Campo label="Temperatura">
                  <div className="grid grid-cols-3 gap-1.5">
                    {CRM_TEMPERATURAS.map(t => (
                      <button
                        key={t.id}
                        onClick={() => podeEditar && set({ temperatura: t.id })}
                        className={`text-[11px] font-medium py-1.5 rounded-md border transition-colors ${
                          rascunho.temperatura === t.id
                            ? `${t.bg} ${t.text}`
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </Campo>
              </div>
            </div>

            <Campo label="Observações">
              <textarea
                value={rascunho.observacoes || ''}
                onChange={e => set({ observacoes: e.target.value })}
                readOnly={!podeEditar}
                rows={4}
                placeholder="O que mais a próxima pessoa precisa saber?"
                className={`${inputCls} resize-y`}
              />
            </Campo>
          </section>
        </div>

        {/* ── prompt de detalhe do evento ───────────────────────────────── */}
        <AnimatePresence>
          {eventoComDetalhe && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center p-6"
              onClick={() => setEventoComDetalhe(null)}
            >
              <div onClick={e => e.stopPropagation()}
                className="w-full max-w-sm bg-[#0d0d10] border border-zinc-800 rounded-xl p-4">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100 mb-1">
                  <MessageSquarePlus size={14} className="text-zinc-500" />
                  {eventoComDetalhe.label}
                </h4>
                <p className="text-[11px] text-zinc-500 mb-3">Este evento pede um detalhe para a timeline.</p>
                {eventoComDetalhe.slug === 'faixa_investimento' ? (
                  <select
                    autoFocus value={detalhe} onChange={e => setDetalhe(e.target.value)} className={selectCls}
                  >
                    <option value="">Selecione a faixa…</option>
                    {faixas.filter(f => f.ativo).map(f => <option key={f.id} value={f.label}>{f.label}</option>)}
                  </select>
                ) : (
                  <input
                    autoFocus value={detalhe} onChange={e => setDetalhe(e.target.value)}
                    placeholder="Detalhe" className={inputCls}
                    onKeyDown={e => { if (e.key === 'Enter') confirmarDetalhe(); }}
                  />
                )}
                <div className="flex justify-end gap-1.5 mt-3">
                  <CrmButton onClick={() => setEventoComDetalhe(null)}>Cancelar</CrmButton>
                  <CrmButton variant="primary" onClick={confirmarDetalhe}>Registrar</CrmButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── confirmação de exclusão ───────────────────────────────────── */}
        <AnimatePresence>
          {confirmarExclusao && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center p-6"
              onClick={() => setConfirmarExclusao(false)}
            >
              <div onClick={e => e.stopPropagation()}
                className="w-full max-w-sm bg-[#0d0d10] border border-zinc-800 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-zinc-100 mb-1">Excluir {lead.nome}?</h4>
                <p className="text-[11px] text-zinc-500 mb-3">
                  A timeline e as ações do lead vão junto. Não dá para desfazer.
                </p>
                <div className="flex justify-end gap-1.5">
                  <CrmButton onClick={() => setConfirmarExclusao(false)}>Cancelar</CrmButton>
                  <CrmButton variant="danger" onClick={async () => { await onExcluir(lead.id); onClose(); }}>
                    <Trash2 size={12} /> Excluir
                  </CrmButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </motion.div>
  );
}

/** Formulário da próxima ação: tipo, data, horário, prioridade e status. */
function ProximaAcaoForm({
  acao, users, podeEditar, onSalvar, onConcluir, onCancelar,
}: {
  acao: CrmNextAction | null;
  users: UserProfile[];
  podeEditar: boolean;
  onSalvar: Props['onSalvarAcao'];
  onConcluir: Props['onConcluirAcao'];
  onCancelar: Props['onCancelarAcao'];
}) {
  const inicial = acao
    ? { ...partirDataHora(acao.agendadoPara), tipo: acao.tipo, prioridade: acao.prioridade, observacao: acao.observacao || '', responsavelId: acao.responsavelId || '' }
    : { data: hojeISO(), hora: '09:00', tipo: CRM_TIPOS_ACAO[0] as string, prioridade: 'media' as CrmPrioridade, observacao: '', responsavelId: '' };

  const [form, setForm] = useState(inicial);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { setForm(inicial); }, [acao?.id, acao?.agendadoPara]);

  const salvar = async () => {
    setSalvando(true);
    try {
      await onSalvar({
        id: acao?.id,
        tipo: form.tipo,
        agendadoPara: combinarDataHora(form.data, form.hora),
        prioridade: form.prioridade,
        observacao: form.observacao || null,
        responsavelId: form.responsavelId || null,
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
        <Clock size={11} /> Próxima ação
      </h3>
      <div className="space-y-2.5 bg-[#0b0b0e] border border-zinc-900 rounded-lg p-2.5">
        <Campo label="Tipo">
          <input
            list="crm-tipos-acao"
            value={form.tipo}
            onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
            disabled={!podeEditar}
            className={inputCls}
          />
          <datalist id="crm-tipos-acao">
            {CRM_TIPOS_ACAO.map(t => <option key={t} value={t} />)}
          </datalist>
        </Campo>

        <div className="grid grid-cols-2 gap-2">
          <Campo label="Data">
            <input type="date" value={form.data} disabled={!podeEditar}
              onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className={inputCls} />
          </Campo>
          <Campo label="Horário">
            <input type="time" value={form.hora} disabled={!podeEditar}
              onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} className={inputCls} />
          </Campo>
        </div>

        <Campo label="Prioridade">
          <div className="grid grid-cols-4 gap-1">
            {CRM_PRIORIDADES.map(p => (
              <button key={p.id} disabled={!podeEditar}
                onClick={() => setForm(f => ({ ...f, prioridade: p.id }))}
                className={`text-[10px] font-medium py-1.5 rounded border transition-colors ${
                  form.prioridade === p.id
                    ? `bg-zinc-800 border-zinc-700 ${p.text}`
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Campo>

        <Campo label="Responsável pela ação">
          <select value={form.responsavelId} disabled={!podeEditar}
            onChange={e => setForm(f => ({ ...f, responsavelId: e.target.value }))} className={selectCls}>
            <option value="">Mesmo do lead</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Campo>

        <Campo label="Observação">
          <input value={form.observacao} disabled={!podeEditar}
            onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
            placeholder="opcional" className={inputCls} />
        </Campo>

        {podeEditar && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <CrmButton variant="primary" onClick={salvar} disabled={salvando}>
              <Save size={11} /> {acao ? 'Atualizar' : 'Agendar'}
            </CrmButton>
            {acao && (
              <>
                <CrmButton onClick={() => onConcluir(acao.id)}><Check size={11} /> Concluir</CrmButton>
                <CrmButton onClick={() => onCancelar(acao.id)}><X size={11} /> Cancelar</CrmButton>
              </>
            )}
          </div>
        )}

        {acao?.status === 'pendente' && (
          <p className="text-[10px] text-zinc-600 flex items-center gap-1">
            <Wallet size={10} className="opacity-0" />
            Concluir a ação libera o lead para uma nova — só existe uma pendente por vez.
          </p>
        )}
      </div>
    </div>
  );
}
