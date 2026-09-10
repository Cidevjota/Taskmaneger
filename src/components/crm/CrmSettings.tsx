import React, { useState } from 'react';
import { Plus, Trash2, Save, Lock } from 'lucide-react';
import { Project } from '../../types';
import { UserProfile } from '../../context/AuthContext';
import {
  CrmConfig, CrmEventType, CrmFaixaInvestimento, CrmOrigem, CrmRole,
  CRM_DIAS_SEMANA,
} from '../../lib/crmTypes';
import { Campo, CrmButton, EventIcon, CRM_CORES, inputCls, selectCls } from './CrmShared';

interface Props {
  origens: CrmOrigem[];
  faixas: CrmFaixaInvestimento[];
  eventTypes: CrmEventType[];
  config: CrmConfig;
  projects: Project[];
  users: UserProfile[];
  isAdmin: boolean;
  onSalvarOrigem: (o: Partial<CrmOrigem> & { nome: string }) => Promise<void>;
  onExcluirOrigem: (id: string) => Promise<void>;
  onSalvarFaixa: (f: Partial<CrmFaixaInvestimento> & { label: string }) => Promise<void>;
  onExcluirFaixa: (id: string) => Promise<void>;
  onSalvarEventType: (t: Partial<CrmEventType> & { slug: string; label: string }) => Promise<void>;
  onExcluirEventType: (id: string) => Promise<void>;
  onSalvarConfig: (c: CrmConfig) => Promise<void>;
  onSalvarRole: (user: UserProfile, role: CrmRole) => Promise<void>;
}

const PAPEIS: { id: CrmRole; label: string; descricao: string }[] = [
  { id: 'administrador', label: 'Administrador', descricao: 'Acesso completo, inclusive às configurações.' },
  { id: 'sdr',           label: 'SDR',           descricao: 'Trabalha leads, eventos e ações.' },
  { id: 'gestao',        label: 'Gestão',        descricao: 'Somente leitura: indicadores e acompanhamento.' },
];

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export default function CrmSettings(props: Props) {
  const { isAdmin } = props;
  const [secao, setSecao] = useState<'operacao' | 'catalogos' | 'eventos' | 'usuarios'>('operacao');

  const secoes = [
    { id: 'operacao' as const,  label: 'Operação' },
    { id: 'catalogos' as const, label: 'Origens e faixas' },
    { id: 'eventos' as const,   label: 'Eventos' },
    { id: 'usuarios' as const,  label: 'Usuários e permissões' },
  ];

  return (
    <div className="h-full flex min-h-0">
      <aside className="w-52 shrink-0 border-r border-zinc-900/60 p-2 space-y-1">
        {secoes.map(s => (
          <button key={s.id} onClick={() => setSecao(s.id)}
            className={`w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors ${
              secao === s.id ? 'bg-[#161619] text-zinc-100' : 'text-zinc-400 hover:bg-[#121214] hover:text-zinc-200'
            }`}>
            {s.label}
          </button>
        ))}
      </aside>

      <div className="flex-1 min-w-0 overflow-y-auto scrollbar-minimal view-pad">
        {!isAdmin && (
          <p className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/[0.06] border border-amber-500/20 rounded-md px-2.5 py-2 mb-4 max-w-2xl">
            <Lock size={12} /> Só o perfil Administrador altera as configurações. Você está vendo em modo leitura.
          </p>
        )}
        {secao === 'operacao'  && <SecaoOperacao {...props} />}
        {secao === 'catalogos' && <SecaoCatalogos {...props} />}
        {secao === 'eventos'   && <SecaoEventos {...props} />}
        {secao === 'usuarios'  && <SecaoUsuarios {...props} />}
      </div>
    </div>
  );
}

function SecaoOperacao({ config, isAdmin, onSalvarConfig }: Props) {
  const [form, setForm] = useState(config);
  const [salvando, setSalvando] = useState(false);
  const sujo = JSON.stringify(form) !== JSON.stringify(config);
  const set = (patch: Partial<CrmConfig>) => setForm(f => ({ ...f, ...patch }));

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">Regras da operação</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          São estes números que a tela usa para dizer o que está atrasado e o que é para agora.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Campo label="Janela do “agora” (min)" hint="O que vence dentro disso conta como agora.">
          <input type="number" min={5} value={form.janelaAgoraMin} disabled={!isAdmin}
            onChange={e => set({ janelaAgoraMin: Math.max(5, Number(e.target.value) || 5) })} className={inputCls} />
        </Campo>
        <Campo label="SLA 1º contato (min)" hint="Alvo para atender um lead novo.">
          <input type="number" min={1} value={form.slaPrimeiroContatoMin} disabled={!isAdmin}
            onChange={e => set({ slaPrimeiroContatoMin: Math.max(1, Number(e.target.value) || 1) })} className={inputCls} />
        </Campo>
        <Campo label="Parou de responder (h)" hint="Silêncio até o lead mudar de etapa.">
          <input type="number" min={1} value={form.horasParaParouDeResponder} disabled={!isAdmin}
            onChange={e => set({ horasParaParouDeResponder: Math.max(1, Number(e.target.value) || 1) })} className={inputCls} />
        </Campo>
        <Campo label="Horário permitido — início">
          <input type="time" value={form.horarioInicio} disabled={!isAdmin}
            onChange={e => set({ horarioInicio: e.target.value })} className={inputCls} />
        </Campo>
        <Campo label="Horário permitido — fim">
          <input type="time" value={form.horarioFim} disabled={!isAdmin}
            onChange={e => set({ horarioFim: e.target.value })} className={inputCls} />
        </Campo>
      </div>

      <Campo label="Dias de operação">
        <div className="flex gap-1 max-w-md">
          {CRM_DIAS_SEMANA.map((d, i) => (
            <button key={d} disabled={!isAdmin}
              onClick={() => set({
                diasSemana: form.diasSemana.includes(i)
                  ? form.diasSemana.filter(x => x !== i)
                  : [...form.diasSemana, i].sort(),
              })}
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

      {isAdmin && sujo && (
        <CrmButton variant="primary" disabled={salvando}
          onClick={async () => { setSalvando(true); try { await onSalvarConfig(form); } finally { setSalvando(false); } }}>
          <Save size={12} /> Salvar
        </CrmButton>
      )}
    </div>
  );
}

function SecaoCatalogos({ origens, faixas, isAdmin, onSalvarOrigem, onExcluirOrigem, onSalvarFaixa, onExcluirFaixa }: Props) {
  const [novaOrigem, setNovaOrigem] = useState('');
  const [novaFaixa, setNovaFaixa] = useState('');

  return (
    <div className="max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6">
      <section>
        <h3 className="text-sm font-semibold text-zinc-100 mb-2">Origens</h3>
        <div className="space-y-1.5">
          {origens.map(o => (
            <div key={o.id} className="flex items-center gap-2 bg-[#0f0f12] border border-zinc-900 rounded-lg px-2.5 py-1.5">
              <input defaultValue={o.nome} disabled={!isAdmin}
                onBlur={e => e.target.value !== o.nome && e.target.value.trim() && onSalvarOrigem({ ...o, nome: e.target.value.trim() })}
                className={`${inputCls} flex-1`} />
              <button disabled={!isAdmin} onClick={() => onSalvarOrigem({ ...o, ativo: !o.ativo })}
                className={`text-[10px] px-1.5 py-1 rounded border ${o.ativo ? 'border-emerald-500/25 text-emerald-400' : 'border-zinc-800 text-zinc-600'}`}>
                {o.ativo ? 'ativa' : 'inativa'}
              </button>
              {isAdmin && (
                <button onClick={() => onExcluirOrigem(o.id)} className="p-1 text-zinc-600 hover:text-rose-400"><Trash2 size={12} /></button>
              )}
            </div>
          ))}
        </div>
        {isAdmin && (
          <form className="flex gap-1.5 mt-2"
            onSubmit={async e => { e.preventDefault(); if (!novaOrigem.trim()) return; await onSalvarOrigem({ nome: novaOrigem.trim(), ordem: origens.length + 1 }); setNovaOrigem(''); }}>
            <input value={novaOrigem} onChange={e => setNovaOrigem(e.target.value)} placeholder="Nova origem" className={`${inputCls} flex-1`} />
            <CrmButton type="submit"><Plus size={11} /></CrmButton>
          </form>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-zinc-100 mb-2">Faixas de investimento</h3>
        <div className="space-y-1.5">
          {faixas.map(f => (
            <div key={f.id} className="flex items-center gap-2 bg-[#0f0f12] border border-zinc-900 rounded-lg px-2.5 py-1.5">
              <input defaultValue={f.label} disabled={!isAdmin}
                onBlur={e => e.target.value !== f.label && e.target.value.trim() && onSalvarFaixa({ ...f, label: e.target.value.trim() })}
                className={`${inputCls} flex-1`} />
              <button disabled={!isAdmin} onClick={() => onSalvarFaixa({ ...f, ativo: !f.ativo })}
                className={`text-[10px] px-1.5 py-1 rounded border ${f.ativo ? 'border-emerald-500/25 text-emerald-400' : 'border-zinc-800 text-zinc-600'}`}>
                {f.ativo ? 'ativa' : 'inativa'}
              </button>
              {isAdmin && (
                <button onClick={() => onExcluirFaixa(f.id)} className="p-1 text-zinc-600 hover:text-rose-400"><Trash2 size={12} /></button>
              )}
            </div>
          ))}
        </div>
        {isAdmin && (
          <form className="flex gap-1.5 mt-2"
            onSubmit={async e => { e.preventDefault(); if (!novaFaixa.trim()) return; await onSalvarFaixa({ label: novaFaixa.trim(), ordem: faixas.length + 1 }); setNovaFaixa(''); }}>
            <input value={novaFaixa} onChange={e => setNovaFaixa(e.target.value)} placeholder="Nova faixa" className={`${inputCls} flex-1`} />
            <CrmButton type="submit"><Plus size={11} /></CrmButton>
          </form>
        )}
      </section>
    </div>
  );
}

function SecaoEventos({ eventTypes, isAdmin, onSalvarEventType, onExcluirEventType }: Props) {
  const [novo, setNovo] = useState('');

  return (
    <div className="max-w-3xl">
      <h3 className="text-sm font-semibold text-zinc-100">Botões de evento</h3>
      <p className="text-[11px] text-zinc-500 mt-0.5 mb-3">
        São os botões que a SDR usa na tela do lead. Os marcados como “sistema” são
        emitidos pelo próprio app e não podem ser removidos.
      </p>

      <div className="space-y-1.5">
        {eventTypes.sort((a, b) => a.ordem - b.ordem).map(t => (
          <div key={t.id} className="flex items-center gap-2 bg-[#0f0f12] border border-zinc-900 rounded-lg px-2.5 py-1.5">
            <EventIcon name={t.icone} size={13} className={(CRM_CORES[t.cor] || CRM_CORES.zinc).text} />
            <input defaultValue={t.label} disabled={!isAdmin || t.sistema}
              onBlur={e => e.target.value !== t.label && e.target.value.trim() && onSalvarEventType({ ...t, label: e.target.value.trim() })}
              className={`${inputCls} flex-1`} />
            <input defaultValue={t.icone} disabled={!isAdmin || t.sistema} title="Nome do ícone lucide-react"
              onBlur={e => e.target.value !== t.icone && onSalvarEventType({ ...t, icone: e.target.value.trim() || 'Circle' })}
              className={`${inputCls} w-32`} />
            <select value={t.cor} disabled={!isAdmin || t.sistema}
              onChange={e => onSalvarEventType({ ...t, cor: e.target.value })} className={`${selectCls} w-24`}>
              {Object.keys(CRM_CORES).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button disabled={!isAdmin} onClick={() => onSalvarEventType({ ...t, ativo: !t.ativo })}
              className={`text-[10px] px-1.5 py-1 rounded border shrink-0 ${t.ativo ? 'border-emerald-500/25 text-emerald-400' : 'border-zinc-800 text-zinc-600'}`}>
              {t.ativo ? 'ativo' : 'inativo'}
            </button>
            {t.sistema ? (
              <span className="text-[10px] text-zinc-600 px-1 shrink-0">sistema</span>
            ) : isAdmin ? (
              <button onClick={() => onExcluirEventType(t.id)} className="p-1 text-zinc-600 hover:text-rose-400 shrink-0"><Trash2 size={12} /></button>
            ) : null}
          </div>
        ))}
      </div>

      {isAdmin && (
        <form className="flex gap-1.5 mt-2 max-w-md"
          onSubmit={async e => {
            e.preventDefault();
            const label = novo.trim();
            if (!label) return;
            await onSalvarEventType({ slug: slugify(label), label, ordem: eventTypes.length + 1 });
            setNovo('');
          }}>
          <input value={novo} onChange={e => setNovo(e.target.value)} placeholder="Novo evento" className={`${inputCls} flex-1`} />
          <CrmButton type="submit"><Plus size={11} /> Adicionar</CrmButton>
        </form>
      )}
    </div>
  );
}

function SecaoUsuarios({ users, isAdmin, onSalvarRole }: Props) {
  return (
    <div className="max-w-3xl">
      <h3 className="text-sm font-semibold text-zinc-100">Usuários e permissões</h3>
      <p className="text-[11px] text-zinc-500 mt-0.5 mb-3">
        O papel vale só dentro do CRM; o acesso ao restante do app continua vindo das preferências do perfil.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        {PAPEIS.map(p => (
          <div key={p.id} className="bg-[#0f0f12] border border-zinc-900 rounded-lg px-2.5 py-2">
            <p className="text-xs font-semibold text-zinc-200">{p.label}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{p.descricao}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {users.map(u => {
          const atual: CrmRole =
            (u.preferences?.crmRole as CrmRole) ||
            (u.permissionLevel === 1 ? 'administrador' : 'sdr');
          return (
            <div key={u.id} className="flex items-center gap-2 bg-[#0f0f12] border border-zinc-900 rounded-lg px-2.5 py-1.5">
              <span className="w-6 h-6 rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300 flex items-center justify-center shrink-0">
                {u.initials}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-200 truncate">{u.name}</p>
                <p className="text-[10px] text-zinc-600 truncate">{u.email}</p>
              </div>
              <select
                value={atual}
                disabled={!isAdmin}
                onChange={e => onSalvarRole(u, e.target.value as CrmRole)}
                className={`${selectCls} w-40 shrink-0`}
              >
                {PAPEIS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
