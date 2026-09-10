import React from 'react';
import * as Lucide from 'lucide-react';
import {
  CrmEtapa,
  CrmPrioridade,
  CrmTemperatura,
  CRM_ETAPAS,
  CRM_PRIORIDADES,
  CRM_TEMPERATURAS,
} from '../../lib/crmTypes';
import { UrgenciaAcao } from '../../lib/crmDerive';

/**
 * O ícone do tipo de evento é configurável (guardamos só o nome lucide), então
 * a resolução é dinâmica — com um fallback para não quebrar a tela se alguém
 * digitar um nome que não existe.
 */
export function EventIcon({ name, size = 13, className }: { name: string; size?: number; className?: string }) {
  const Icon = (Lucide as any)[name] || Lucide.Circle;
  return <Icon size={size} className={className} />;
}

/** Famílias de cor permitidas nos tipos de evento (Tailwind precisa das classes literais). */
export const CRM_CORES: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  zinc:    { text: 'text-zinc-400',    bg: 'bg-zinc-500/10',    border: 'border-zinc-500/25',    dot: 'bg-zinc-500' },
  blue:    { text: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25',    dot: 'bg-blue-500' },
  sky:     { text: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/25',     dot: 'bg-sky-500' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', dot: 'bg-emerald-500' },
  teal:    { text: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/25',    dot: 'bg-teal-500' },
  amber:   { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   dot: 'bg-amber-500' },
  rose:    { text: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/25',    dot: 'bg-rose-500' },
  violet:  { text: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/25',  dot: 'bg-violet-500' },
};

export const corCrm = (cor: string) => CRM_CORES[cor] || CRM_CORES.zinc;

export function EtapaChip({ etapa, className = '' }: { etapa: CrmEtapa; className?: string }) {
  const e = CRM_ETAPAS.find(x => x.id === etapa)!;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium text-zinc-300 bg-zinc-900/70 border border-zinc-800 rounded px-1.5 py-0.5 ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${e.dot}`} />
      {e.label}
    </span>
  );
}

export function TemperaturaChip({ valor }: { valor: CrmTemperatura }) {
  const t = CRM_TEMPERATURAS.find(x => x.id === valor)!;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded px-1.5 py-0.5 border ${t.bg} ${t.text}`}>
      <Lucide.Flame size={10} />
      {t.label}
    </span>
  );
}

export function PrioridadeChip({ valor }: { valor: CrmPrioridade }) {
  const p = CRM_PRIORIDADES.find(x => x.id === valor)!;
  return <span className={`text-[10px] font-semibold ${p.text}`}>{p.label}</span>;
}

/** Cor da próxima ação no card: é o sinal mais importante do kanban. */
export const CORES_URGENCIA: Record<UrgenciaAcao | 'sem_acao', { text: string; bg: string; border: string; label: string }> = {
  atrasada: { text: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/30',   label: 'Atrasada' },
  agora:    { text: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  label: 'Agora' },
  hoje:     { text: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/25',    label: 'Hoje' },
  futura:   { text: 'text-zinc-400',   bg: 'bg-zinc-800/40',   border: 'border-zinc-800',      label: 'Agendada' },
  sem_acao: { text: 'text-zinc-500',   bg: 'bg-transparent',   border: 'border-dashed border-zinc-800', label: 'Sem próxima ação' },
};

/** Botão-padrão das barras de ação do CRM. */
export function CrmButton({
  children, onClick, variant = 'ghost', size = 'sm', type = 'button', disabled, title, className = '',
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'xs';
  type?: 'button' | 'submit';
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const base = 'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const sizes = size === 'xs' ? 'text-[10px] px-2 py-1' : 'text-xs px-2.5 py-1.5';
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    ghost: 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800',
    danger: 'bg-transparent hover:bg-rose-500/10 text-rose-400 border border-rose-500/25',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      className={`${base} ${sizes} ${variants} ${className}`}>
      {children}
    </button>
  );
}

/** Campo de formulário — rótulo em cima, controle embaixo, como no resto do app. */
export function Campo({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-zinc-600">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full bg-[#0b0b0e] border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600';

export const selectCls = `${inputCls} appearance-none cursor-pointer`;
