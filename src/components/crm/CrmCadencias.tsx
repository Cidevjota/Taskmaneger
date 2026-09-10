import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, GripVertical, Save, Power, Info } from 'lucide-react';
import {
  CrmCadencia, CrmCadenciaEtapa, CrmIntervaloUnidade,
  CRM_DIAS_SEMANA, CRM_ETAPAS, CRM_TIPOS_ACAO,
} from '../../lib/crmTypes';
import { Campo, CrmButton, inputCls, selectCls } from './CrmShared';

interface Props {
  cadencias: CrmCadencia[];
  etapas: CrmCadenciaEtapa[];
  podeEditar: boolean;
  onSalvarCadencia: (c: Partial<CrmCadencia> & { nome: string }) => Promise<void>;
  onExcluirCadencia: (id: string) => Promise<void>;
  onSalvarEtapa: (e: Partial<CrmCadenciaEtapa> & { cadenciaId: string; tipo: string }) => Promise<void>;
  onExcluirEtapa: (id: string) => Promise<void>;
}

/** Gatilho pode ser a chegada numa etapa do funil (prefixo "etapa:") ou uma situação específica. */
const GATILHOS_SITUACAO = [
  { id: 'lead_novo',        label: 'Lead novo sem resposta' },
  { id: 'alta_intencao',    label: 'Alta intenção' },
  { id: 'parou_responder',  label: 'Parou de responder' },
  { id: 'retorno_agendado', label: 'Retorno programado pelo cliente' },
  { id: 'manual',           label: 'Manual' },
];

/** Minutos totais de uma etapa, para somar e descobrir em que dia da cadência ela cai. */
const paraMinutos = (etapa: CrmCadenciaEtapa) =>
  etapa.intervaloValor * (etapa.intervaloUnidade === 'horas' ? 60 : 1);

/** Agrupa as etapas em blocos D0, D1, D2… somando os intervalos a partir do disparo da cadência. */
function agruparPorDia(etapas: CrmCadenciaEtapa[]) {
  let acumuladoMin = 0;
  const grupos: { dia: number; etapas: CrmCadenciaEtapa[] }[] = [];
  for (const etapa of etapas) {
    acumuladoMin += paraMinutos(etapa);
    const dia = Math.floor(acumuladoMin / 1440);
    const grupoAtual = grupos[grupos.length - 1];
    if (grupoAtual && grupoAtual.dia === dia) grupoAtual.etapas.push(etapa);
    else grupos.push({ dia, etapas: [etapa] });
  }
  return grupos;
}

/**
 * Cadastro e configuração das cadências. Nenhum job as executa nesta entrega —
 * os critérios de disparo ainda serão definidos; o que existe aqui é o
 * parâmetro que o motor vai ler quando chegar.
 */
export default function CrmCadencias({
  cadencias, etapas, podeEditar, onSalvarCadencia, onExcluirCadencia, onSalvarEtapa, onExcluirEtapa,
}: Props) {
  const [selecionadaId, setSelecionadaId] = useState<string | null>(cadencias[0]?.id ?? null);
  const selecionada = cadencias.find(c => c.id === selecionadaId) ?? cadencias[0] ?? null;

  const minhasEtapas = useMemo(
    () => etapas.filter(e => e.cadenciaId === selecionada?.id).sort((a, b) => a.ordem - b.ordem),
    [etapas, selecionada?.id]
  );

  const criar = async () => {
    await onSalvarCadencia({ nome: `Nova cadência ${cadencias.length + 1}`, ordem: cadencias.length + 1 });
  };

  return (
    <div className="h-full flex min-h-0">
      {/* lista */}
      <aside className="w-64 shrink-0 border-r border-zinc-900/60 flex flex-col min-h-0">
        <header className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-900/60">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Cadências</h3>
          {podeEditar && (
            <button onClick={criar} className="p-1 rounded text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 transition-colors" title="Nova cadência">
              <Plus size={13} />
            </button>
          )}
        </header>
        <div className="flex-1 overflow-y-auto scrollbar-minimal p-2 space-y-1">
          {cadencias.length === 0 && <p className="text-[11px] text-zinc-600 italic px-1 py-4">Nenhuma cadência.</p>}
          {cadencias.map(c => (
            <button
              key={c.id}
              onClick={() => setSelecionadaId(c.id)}
              className={`w-full text-left px-2.5 py-2 rounded-lg border transition-colors ${
                selecionada?.id === c.id
                  ? 'bg-[#161619] border-zinc-800 text-zinc-100'
                  : 'bg-transparent border-transparent text-zinc-400 hover:bg-[#121214] hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.ativo ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                <span className="text-xs font-medium truncate">{c.nome}</span>
              </div>
              <p className="text-[10px] text-zinc-600 truncate mt-0.5">
                {etapas.filter(e => e.cadenciaId === c.id).length} etapas
              </p>
            </button>
          ))}
        </div>
      </aside>

      {/* editor */}
      <div className="flex-1 min-w-0 overflow-y-auto scrollbar-minimal view-pad">
        {!selecionada ? (
          <p className="text-xs text-zinc-500 italic">Selecione ou crie uma cadência.</p>
        ) : (
          <CadenciaEditor
            key={selecionada.id}
            cadencia={selecionada}
            etapas={minhasEtapas}
            podeEditar={podeEditar}
            onSalvar={onSalvarCadencia}
            onExcluir={onExcluirCadencia}
            onSalvarEtapa={onSalvarEtapa}
            onExcluirEtapa={onExcluirEtapa}
          />
        )}
      </div>
    </div>
  );
}

function CadenciaEditor({
  cadencia, etapas, podeEditar, onSalvar, onExcluir, onSalvarEtapa, onExcluirEtapa,
}: {
  cadencia: CrmCadencia;
  etapas: CrmCadenciaEtapa[];
  podeEditar: boolean;
  onSalvar: Props['onSalvarCadencia'];
  onExcluir: Props['onExcluirCadencia'];
  onSalvarEtapa: Props['onSalvarEtapa'];
  onExcluirEtapa: Props['onExcluirEtapa'];
}) {
  const [form, setForm] = useState(cadencia);
  const [salvando, setSalvando] = useState(false);
  const sujo = JSON.stringify(form) !== JSON.stringify(cadencia);
  const gruposPorDia = useMemo(() => agruparPorDia(etapas), [etapas]);

  const set = (patch: Partial<CrmCadencia>) => setForm(f => ({ ...f, ...patch }));

  const salvar = async () => {
    setSalvando(true);
    try { await onSalvar(form); } finally { setSalvando(false); }
  };

  const alternarDia = (dia: number) =>
    set({
      diasSemana: form.diasSemana.includes(dia)
        ? form.diasSemana.filter(d => d !== dia)
        : [...form.diasSemana, dia].sort(),
    });

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <input
            value={form.nome}
            onChange={e => set({ nome: e.target.value })}
            readOnly={!podeEditar}
            className="w-full bg-transparent text-base font-semibold text-zinc-100 outline-none"
          />
          <input
            value={form.descricao || ''}
            onChange={e => set({ descricao: e.target.value })}
            readOnly={!podeEditar}
            placeholder="Quando esta cadência deve ser usada"
            className="w-full bg-transparent text-[11px] text-zinc-500 outline-none mt-0.5 placeholder:text-zinc-700"
          />
        </div>
        {podeEditar && (
          <div className="flex items-center gap-1.5 shrink-0">
            <CrmButton onClick={() => set({ ativo: !form.ativo })}
              className={form.ativo ? 'text-emerald-400' : ''}>
              <Power size={11} /> {form.ativo ? 'Ativa' : 'Inativa'}
            </CrmButton>
            {sujo && (
              <CrmButton variant="primary" onClick={salvar} disabled={salvando}>
                <Save size={11} /> Salvar
              </CrmButton>
            )}
            <CrmButton variant="danger" onClick={() => onExcluir(cadencia.id)}><Trash2 size={11} /></CrmButton>
          </div>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-[11px] text-zinc-500 bg-zinc-900/40 border border-zinc-900 rounded-md px-2.5 py-2">
        <Info size={12} className="shrink-0 mt-px text-zinc-600" />
        As cadências estão em modo de configuração: os parâmetros abaixo ficam gravados,
        mas nenhum job dispara as etapas ainda — os critérios serão definidos depois.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <Campo label="Gatilho">
          <select value={form.gatilho} onChange={e => set({ gatilho: e.target.value })} disabled={!podeEditar} className={selectCls}>
            <optgroup label="Etapa do funil">
              {CRM_ETAPAS.map(e => <option key={e.id} value={`etapa:${e.id}`}>{e.label}</option>)}
            </optgroup>
            <optgroup label="Situação específica">
              {GATILHOS_SITUACAO.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </optgroup>
          </select>
        </Campo>
        <Campo label="Horário permitido — início">
          <input type="time" value={form.horaInicio} disabled={!podeEditar}
            onChange={e => set({ horaInicio: e.target.value })} className={inputCls} />
        </Campo>
        <Campo label="Horário permitido — fim">
          <input type="time" value={form.horaFim} disabled={!podeEditar}
            onChange={e => set({ horaFim: e.target.value })} className={inputCls} />
        </Campo>
        <div className="md:col-span-3">
          <Campo label="Dias permitidos">
            <div className="flex gap-1">
              {CRM_DIAS_SEMANA.map((d, i) => (
                <button key={d} disabled={!podeEditar} onClick={() => alternarDia(i)}
                  className={`flex-1 text-[10px] font-medium py-1.5 rounded border transition-colors ${
                    form.diasSemana.includes(i)
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}>
                  {d}
                </button>
              ))}
            </div>
          </Campo>
        </div>
      </div>

      {/* etapas */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Etapas da cadência</h4>
          {podeEditar && (
            <CrmButton size="xs" onClick={() => onSalvarEtapa({
              cadenciaId: cadencia.id,
              tipo: CRM_TIPOS_ACAO[0],
              ordem: etapas.length + 1,
              intervaloValor: 24,
              intervaloUnidade: 'horas',
            })}>
              <Plus size={11} /> Nova etapa
            </CrmButton>
          )}
        </div>

        {etapas.length === 0 ? (
          <p className="text-[11px] text-zinc-600 italic">Nenhuma etapa. A cadência precisa de pelo menos uma.</p>
        ) : (
          <div className="space-y-3">
            {gruposPorDia.map((grupo, gi) => {
              const inicioIndex = gruposPorDia.slice(0, gi).reduce((n, g) => n + g.etapas.length, 0);
              return (
                <div key={grupo.dia} className="space-y-1.5">
                  <span className="inline-block text-[10px] font-mono font-semibold text-zinc-500 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5">
                    D{grupo.dia}
                  </span>
                  {grupo.etapas.map((etapa, i) => (
                    <motion.div
                      key={etapa.id}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: (inicioIndex + i) * 0.02 }}
                      className="flex items-center gap-2 bg-[#0f0f12] border border-zinc-900 rounded-lg px-2.5 py-2"
                    >
                      <GripVertical size={12} className="text-zinc-700 shrink-0" />
                      <span className="text-[10px] font-mono text-zinc-600 w-5 shrink-0">{inicioIndex + i + 1}</span>

                      <input
                        list="crm-tipos-acao-cadencia"
                        defaultValue={etapa.tipo}
                        disabled={!podeEditar}
                        onBlur={e => e.target.value !== etapa.tipo && onSalvarEtapa({ ...etapa, cadenciaId: etapa.cadenciaId, tipo: e.target.value })}
                        className={`${inputCls} w-40`}
                      />
                      <label className="flex items-center gap-1.5 text-[10px] text-zinc-500 shrink-0">
                        após
                        <input
                          type="number" min={0} defaultValue={etapa.intervaloValor} disabled={!podeEditar}
                          onBlur={e => Number(e.target.value) !== etapa.intervaloValor &&
                            onSalvarEtapa({ ...etapa, cadenciaId: etapa.cadenciaId, intervaloValor: Math.max(0, Number(e.target.value) || 0) })}
                          className={`${inputCls} w-14`}
                        />
                        <select
                          defaultValue={etapa.intervaloUnidade}
                          disabled={!podeEditar}
                          onChange={e => onSalvarEtapa({ ...etapa, cadenciaId: etapa.cadenciaId, intervaloUnidade: e.target.value as CrmIntervaloUnidade })}
                          className={`${selectCls} !w-24 shrink-0`}
                        >
                          <option value="minutos">minutos</option>
                          <option value="horas">horas</option>
                        </select>
                      </label>
                      <input
                        defaultValue={etapa.mensagem || ''}
                        disabled={!podeEditar}
                        placeholder="mensagem / roteiro"
                        onBlur={e => (e.target.value || null) !== (etapa.mensagem || null) &&
                          onSalvarEtapa({ ...etapa, cadenciaId: etapa.cadenciaId, mensagem: e.target.value || null })}
                        className={`${inputCls} flex-1 min-w-0`}
                      />
                      {podeEditar && (
                        <button onClick={() => onExcluirEtapa(etapa.id)}
                          className="p-1 rounded text-zinc-600 hover:text-rose-400 transition-colors shrink-0">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              );
            })}
            <datalist id="crm-tipos-acao-cadencia">
              {CRM_TIPOS_ACAO.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
        )}
      </div>
    </div>
  );
}
