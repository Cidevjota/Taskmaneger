import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Plus, X, Send, Loader2, Check, AlertTriangle } from 'lucide-react';
import { fetchRelatorioVendasConfig, saveRelatorioVendasConfig, enviarRelatorioVendasAgora, RelatorioVendasConfig } from '../lib/api';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INPUT = 'h-9 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-blue-500/50 transition-colors';
const LABEL = 'text-[11px] font-semibold text-zinc-500';

type Draft = Omit<RelatorioVendasConfig, 'ultimoEnvioEm' | 'ultimoEnvioStatus' | 'projetosExcluidos'>;

const draftDe = (c: RelatorioVendasConfig | null | undefined): Draft => ({
  ativo: c?.ativo ?? false,
  emails: c?.emails ?? [],
  diaSemana: c?.diaSemana ?? 1,
  hora: c?.hora ?? '08:00',
  remetenteEmail: c?.remetenteEmail ?? '',
  remetenteNome: c?.remetenteNome ?? 'Orbit — Relatório de Vendas',
});

export default function RelatorioVendasEmailPanel() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useQuery({ queryKey: ['relatorioVendasConfig'], queryFn: fetchRelatorioVendasConfig });

  const [draft, setDraft] = useState<Draft>(draftDe(null));
  const [novoEmail, setNovoEmail] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);

  // Recarrega o rascunho quando a configuração chega (ou muda por outro usuário).
  useEffect(() => { if (config) setDraft(draftDe(config)); }, [config]);

  const alterado = JSON.stringify(draft) !== JSON.stringify(draftDe(config));

  const adicionarEmail = () => {
    const emails = novoEmail.split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
    const invalidos = emails.filter(e => !EMAIL_RE.test(e));
    if (invalidos.length) {
      setFeedback({ tipo: 'erro', msg: `E-mail inválido: ${invalidos.join(', ')}` });
      return;
    }
    setDraft(d => ({ ...d, emails: [...d.emails, ...emails.filter(e => !d.emails.includes(e))] }));
    setNovoEmail('');
    setFeedback(null);
  };

  const salvar = async () => {
    if (draft.ativo && (!draft.remetenteEmail || !EMAIL_RE.test(draft.remetenteEmail))) {
      setFeedback({ tipo: 'erro', msg: 'Informe o e-mail remetente confirmado no Brevo antes de ativar.' });
      return;
    }
    if (draft.ativo && draft.emails.length === 0) {
      setFeedback({ tipo: 'erro', msg: 'Cadastre ao menos um destinatário antes de ativar.' });
      return;
    }
    setSalvando(true);
    try {
      await saveRelatorioVendasConfig({ ...draft, remetenteEmail: draft.remetenteEmail?.trim() || null });
      await queryClient.invalidateQueries({ queryKey: ['relatorioVendasConfig'] });
      setFeedback({ tipo: 'ok', msg: 'Configuração salva.' });
    } catch (e) {
      setFeedback({ tipo: 'erro', msg: e instanceof Error ? e.message : 'Erro ao salvar.' });
    } finally {
      setSalvando(false);
    }
  };

  const enviarAgora = async () => {
    setEnviando(true);
    setFeedback(null);
    try {
      const n = await enviarRelatorioVendasAgora();
      setFeedback({ tipo: 'ok', msg: `Relatório enviado para ${n} destinatário(s).` });
    } catch (e) {
      setFeedback({ tipo: 'erro', msg: e instanceof Error ? e.message : 'Erro ao enviar.' });
    } finally {
      setEnviando(false);
      queryClient.invalidateQueries({ queryKey: ['relatorioVendasConfig'] });
    }
  };

  if (isLoading) {
    return (
      <div className="card-pad rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex items-center gap-2 text-xs text-zinc-500">
        <Loader2 size={14} className="animate-spin" /> Carregando configuração…
      </div>
    );
  }

  const ultimoEnvio = config?.ultimoEnvioEm
    ? new Date(config.ultimoEnvioEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : null;
  const ultimoErro = config?.ultimoEnvioStatus?.startsWith('erro');

  return (
    <div className="card-pad rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Mail size={14} className="text-blue-400" />
          <div>
            <h3 className="text-xs font-bold text-zinc-100">Relatório semanal por e-mail</h3>
            <p className="text-[11px] text-zinc-600">Envia este resumo, com os dados do momento do envio, toda semana no dia e horário escolhidos (horário de Brasília).</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDraft(d => ({ ...d, ativo: !d.ativo }))}
          className={`flex items-center gap-2 h-8 px-3 rounded-lg border text-[11px] font-semibold transition-colors ${
            draft.ativo ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-zinc-900/60 text-zinc-500 border-zinc-800 hover:text-zinc-300'
          }`}
        >
          <span className={`w-7 h-4 rounded-full relative transition-colors ${draft.ativo ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${draft.ativo ? 'left-3.5' : 'left-0.5'}`} />
          </span>
          {draft.ativo ? 'Agendamento ativo' : 'Agendamento desligado'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Destinatários */}
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>Destinatários</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={novoEmail}
              onChange={e => setNovoEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarEmail(); } }}
              placeholder="nome@empresa.com.br (vários separados por vírgula)"
              className={`${INPUT} flex-1 min-w-0`}
            />
            <button
              type="button"
              onClick={adicionarEmail}
              disabled={!novoEmail.trim()}
              className="flex items-center gap-1 h-9 px-3 text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 disabled:opacity-40 transition-colors"
            >
              <Plus size={12} /> Adicionar
            </button>
          </div>
          {draft.emails.length === 0 ? (
            <p className="text-[11px] text-zinc-600">Nenhum destinatário cadastrado.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {draft.emails.map(email => (
                <span key={email} className="flex items-center gap-1 pl-2.5 pr-1 py-1 text-[11px] text-zinc-300 bg-zinc-800/60 border border-zinc-700/50 rounded-md">
                  {email}
                  <button
                    type="button"
                    onClick={() => setDraft(d => ({ ...d, emails: d.emails.filter(e => e !== email) }))}
                    className="p-0.5 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Remover"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Agenda e remetente */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>Dia da semana</label>
            <select
              value={draft.diaSemana}
              onChange={e => setDraft(d => ({ ...d, diaSemana: Number(e.target.value) }))}
              className={INPUT}
            >
              {DIAS.map((dia, i) => <option key={dia} value={i}>{dia}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>Horário</label>
            <input
              type="time"
              value={draft.hora}
              onChange={e => setDraft(d => ({ ...d, hora: e.target.value || '08:00' }))}
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>E-mail remetente</label>
            <input
              type="email"
              value={draft.remetenteEmail ?? ''}
              onChange={e => setDraft(d => ({ ...d, remetenteEmail: e.target.value }))}
              placeholder="confirmado no Brevo"
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>Nome do remetente</label>
            <input
              type="text"
              value={draft.remetenteNome}
              onChange={e => setDraft(d => ({ ...d, remetenteNome: e.target.value }))}
              className={INPUT}
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-600">
        O disparo pode acontecer até 15 minutos depois do horário escolhido. O e-mail traz todos os empreendimentos visíveis; os filtros desta tela não se aplicam a ele.
      </p>

      <div className="flex items-center justify-between gap-3 flex-wrap border-t border-zinc-800/60 pt-3">
        <div className="text-[11px] min-h-[16px]">
          {feedback ? (
            <span className={`flex items-center gap-1.5 ${feedback.tipo === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
              {feedback.tipo === 'ok' ? <Check size={12} /> : <AlertTriangle size={12} />} {feedback.msg}
            </span>
          ) : ultimoEnvio ? (
            <span className={ultimoErro ? 'text-red-400' : 'text-zinc-500'}>
              Último envio: {ultimoEnvio} · {config?.ultimoEnvioStatus}
            </span>
          ) : (
            <span className="text-zinc-600">Nenhum envio ainda.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={enviarAgora}
            disabled={enviando || alterado || !config?.emails.length}
            title={alterado ? 'Salve as alterações antes de enviar' : 'Envia agora para os destinatários salvos'}
            className="flex items-center gap-1.5 h-9 px-3 text-[11px] font-semibold text-zinc-300 bg-zinc-900/60 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {enviando ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Enviar agora
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !alterado}
            className="flex items-center gap-1.5 h-9 px-4 text-[11px] font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {salvando && <Loader2 size={12} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
