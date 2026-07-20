import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, X, CheckCircle2, ChevronDown, ChevronRight,
  Building2, Calendar, Hash, FileText, CreditCard,
  TrendingUp, BarChart3, Timer, Package, AlertTriangle, Trash2, Check
} from 'lucide-react';
import { SiengeFatura, SiengeTitle } from '../types';

interface SiengeFaturasProps {
  faturas: SiengeFatura[];
  titles: SiengeTitle[];
  onSaveFatura: (fatura: SiengeFatura) => void;
  onDeleteFatura: (id: string) => void;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function daysBetween(a: string, b?: string): number {
  const dateA = new Date(a);
  const dateB = b ? new Date(b) : new Date();
  return Math.round(Math.abs(dateB.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24));
}

const STATUS_LABELS: Record<string, string> = {
  a_lancar: 'A Lançar',
  aprovacao_1: '1ª Alçada',
  aprovacao_2: '2ª Alçada',
  aprovacao_3: '3ª Alçada',
  aguardando_pagamento: 'Aguardando',
  recusados: 'Recusado',
  pago: 'Pago',
};

const STATUS_COLORS: Record<string, string> = {
  a_lancar: 'bg-zinc-700/50 text-zinc-400',
  aprovacao_1: 'bg-sky-500/15 text-sky-400',
  aprovacao_2: 'bg-blue-500/15 text-blue-400',
  aprovacao_3: 'bg-violet-500/15 text-violet-400',
  aguardando_pagamento: 'bg-amber-500/15 text-amber-400',
  recusados: 'bg-red-500/15 text-red-400',
  pago: 'bg-emerald-500/15 text-emerald-400',
};

const MONTH_ABBR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

// ─── Lógica de Datas ────────────────────────────────────────────────────────────
function getNextTuesday(fromDate: Date): Date {
  const date = new Date(fromDate);
  const day = date.getDay();
  const daysUntilTuesday = (2 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilTuesday);
  return date;
}

function calculateNextAvailableDates(faturas: SiengeFatura[]) {
  const existingVencimentos = new Set(faturas.map(f => f.vencimento).filter(Boolean));
  let candidateDate = getNextTuesday(new Date());

  const toLocalISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  while (true) {
    const candidateISO = toLocalISO(candidateDate);
    if (!existingVencimentos.has(candidateISO)) break;
    candidateDate = getNextTuesday(candidateDate);
  }

  const vencimentoISO = toLocalISO(candidateDate);
  const prazoPagamentoDate = new Date(candidateDate);
  prazoPagamentoDate.setDate(prazoPagamentoDate.getDate() + 6);
  const prazoPagamentoISO = toLocalISO(prazoPagamentoDate);

  return { vencimento: vencimentoISO, prazoPagamento: prazoPagamentoISO };
}

// Continuous count across every fatura ever created — never resets per month.
export function generateNextFaturaCodigo(faturas: SiengeFatura[]): string {
  const monthAbbr = MONTH_ABBR[new Date().getMonth()];
  const seq = String(faturas.length + 1).padStart(3, '0');
  return `FAT${monthAbbr}${seq}`;
}

// ─── New Fatura Form ────────────────────────────────────────────────────────────
function NewFaturaModal({
  defaultCodigo,
  calculatedDates,
  onSave,
  onClose
}: {
  defaultCodigo: string;
  calculatedDates: { vencimento: string; prazoPagamento: string };
  onSave: (codigo: string, dates: { vencimento: string; prazoPagamento: string }) => void;
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-[#0d0d10] border border-zinc-800/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
              <CreditCard size={14} className="text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-100">Nova Fatura</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="text-sm text-zinc-400 my-2">
          Abertura de uma nova fatura receberá automaticamente o seguinte código:
          <div className="mt-4 p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg text-center flex items-center justify-center gap-2">
            <Hash size={14} className="text-blue-500/50" />
            <span className="text-lg font-mono font-bold text-blue-400 tracking-wider">{defaultCodigo}</span>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between p-2 rounded bg-zinc-900/40 border border-zinc-800/60">
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Vencimento (Prox. Terça Livre)</span>
              <span className="text-xs text-zinc-300 font-semibold">{formatDate(calculatedDates.vencimento)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-zinc-900/40 border border-zinc-800/60">
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Prazo de Pagamento (+6 dias)</span>
              <span className="text-xs text-emerald-400 font-semibold">{formatDate(calculatedDates.prazoPagamento)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors">Cancelar</button>
          <button
            onClick={() => { onSave(defaultCodigo, calculatedDates); onClose(); }}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            Confirmar Criação
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fatura Row (accordion) ─────────────────────────────────────────────────────
function FaturaRow({
  fatura,
  titles,
  filterStatus,
  onClose,
  onDelete,
}: {
  fatura: SiengeFatura;
  titles: SiengeTitle[];
  filterStatus: string;
  onClose: (fatura: SiengeFatura) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const allFaturaTitles = titles.filter(t => t.faturaId === fatura.id);
  const faturaTitles = allFaturaTitles.filter(t => filterStatus === 'todos' || t.status === filterStatus);
  const totalValue = faturaTitles.reduce((s, t) => s + t.valor, 0);
  const isAberto = fatura.status === 'aberto';

  const today = new Date().toISOString().split('T')[0];
  const unpaidTitles = allFaturaTitles.filter(t => t.status !== 'pago');
  const isAllPaid = allFaturaTitles.length > 0 && unpaidTitles.length === 0;
  const isOverdue = unpaidTitles.length > 0 && !!fatura.prazoPagamento && today > fatura.prazoPagamento;
  const isWarning = unpaidTitles.length > 0 && today === fatura.prazoPagamento;

  let prazoColor = "text-zinc-400";
  if (isAllPaid) prazoColor = "text-emerald-400";
  else if (isOverdue) prazoColor = "text-red-400";
  else if (isWarning) prazoColor = "text-amber-400";

  let displayStatus = isAberto ? 'Aberta' : 'Encerrada';
  let statusBadgeClasses = isAberto
    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
    : 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/30';

  if (isOverdue && isAberto) {
    displayStatus = 'Em Atraso';
    statusBadgeClasses = 'bg-red-500/20 text-red-400 border border-red-500/30';
  }

  // Automação: Encerra a fatura automaticamente se todos os títulos estiverem pagos
  useEffect(() => {
    if (isAberto && isAllPaid) {
      onClose(fatura);
    }
  }, [isAberto, isAllPaid, fatura, onClose]);

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${isAberto ? 'border-zinc-800/60 bg-zinc-900/20' : 'border-zinc-900/40 bg-zinc-950/20'}`}>
      {/* Fatura header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded(p => !p)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
            <ChevronRight size={14} className="text-zinc-500 hover:text-zinc-300 transition-colors" />
          </span>
          <span className="text-sm font-semibold text-zinc-200 truncate">{fatura.codigo}</span>
        </button>

        {/* Status badge */}
        <div className="w-24 flex justify-center shrink-0">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${statusBadgeClasses}`}>
            {displayStatus}
          </span>
        </div>

        {/* Stats */}
        <div className="w-24 flex justify-center shrink-0">
          <span className="text-xs font-medium text-zinc-400">{faturaTitles.length} título{faturaTitles.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="w-32 flex justify-end shrink-0">
          <span className="text-sm font-medium text-zinc-300">{formatCurrency(totalValue)}</span>
        </div>

        {/* Dates */}
        <div className="hidden lg:flex justify-center shrink-0 w-28">
          <span className="text-sm font-medium text-zinc-400">{formatDate(fatura.vencimento)}</span>
        </div>
        <div className="hidden lg:flex justify-center shrink-0 w-28">
          <span className={`text-sm font-medium ${prazoColor}`}>{formatDate(fatura.prazoPagamento)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1 shrink-0 w-28">
          {isAberto && !confirmClose && (
            <button
              onClick={() => setConfirmClose(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 rounded-lg transition-colors"
            >
              <CheckCircle2 size={13} /> Encerrar
            </button>
          )}
          {confirmClose && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-amber-400">Encerrar fatura?</span>
              <button onClick={() => { onClose(fatura); setConfirmClose(false); }} className="px-2 py-0.5 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded hover:bg-amber-500/20 transition-colors">Sim</button>
              <button onClick={() => setConfirmClose(false)} className="px-2 py-0.5 text-[10px] text-zinc-600 hover:text-zinc-400 rounded transition-colors">Não</button>
            </div>
          )}
          {faturaTitles.length === 0 && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-red-400">Excluir?</span>
              <button onClick={() => { onDelete(fatura.id); setConfirmDelete(false); }} className="px-2 py-0.5 text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors">Sim</button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-0.5 text-[10px] text-zinc-600 hover:text-zinc-400 rounded transition-colors">Não</button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded: titles table */}
      {expanded && (
        <div className="border-t border-zinc-800/40 overflow-x-auto">
          {faturaTitles.length === 0 ? (
            <div className="px-6 py-5 text-sm text-zinc-600 text-center">Nenhum título nesta fatura ainda.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800/40 bg-zinc-950/40">
                  <th className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Nº Título</th>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Descrição</th>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Empreendimento</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Valor</th>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Vencimento</th>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {faturaTitles.map((t, i) => {
                  const expired = t.vencimento && new Date(t.vencimento + 'T00:00:00') < new Date(new Date().toDateString());
                  return (
                    <tr key={t.id} className={`border-b border-zinc-900/40 hover:bg-zinc-800/20 transition-colors ${i % 2 === 0 ? '' : 'bg-zinc-900/10'}`}>
                      <td className="px-4 py-2.5 font-semibold text-blue-400">{t.titulo}</td>
                      <td className="px-4 py-2.5 text-zinc-600 truncate max-w-[200px]">{t.descricao || '—'}</td>
                      <td className="px-4 py-2.5 text-zinc-400 truncate max-w-[160px]">{t.empreendimento || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-400">{formatCurrency(t.valor)}</td>
                      <td className="px-4 py-2.5">
                        {t.vencimento ? (
                          <span className={`flex items-center gap-1 ${expired ? 'text-red-400' : 'text-zinc-400'}`}>
                            {expired && <AlertTriangle size={10} />}
                            {formatDate(t.vencimento)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[t.status] || 'bg-zinc-700 text-zinc-400'}`}>
                          {STATUS_LABELS[t.status] || t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────
const FILTER_OPTIONS = [
  { value: 'todos', label: 'Todos os Status' },
  { value: 'a_lancar', label: 'A Lançar' },
  { value: 'aprovacao_1', label: '1ª Alçada' },
  { value: 'aprovacao_2', label: '2ª Alçada' },
  { value: 'aprovacao_3', label: '3ª Alçada' },
  { value: 'aguardando_pagamento', label: 'Aguardando Pagamento' },
  { value: 'recusados', label: 'Recusados' },
  { value: 'pago', label: 'Pago' }
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SiengeFaturas({ faturas, titles, onSaveFatura, onDeleteFatura }: SiengeFaturasProps) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  const handleCreate = (codigo: string, dates: { vencimento: string; prazoPagamento: string }) => {
    const newFatura: SiengeFatura = {
      id: crypto.randomUUID(),
      codigo,
      status: 'aberto',
      createdAt: new Date().toISOString(),
      vencimento: dates.vencimento,
      prazoPagamento: dates.prazoPagamento,
    };
    onSaveFatura(newFatura);
  };

  const handleClose = (fatura: SiengeFatura) => {
    onSaveFatura({ ...fatura, status: 'encerrado', closedAt: new Date().toISOString() });
  };

  const relevantTitles = useMemo(() => titles.filter(t => !!t.faturaId), [titles]);

  // ── Dashboard metrics ──────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const paidTitles = relevantTitles.filter(t => t.status === 'pago');
    const totalPaid = paidTitles.reduce((s, t) => s + t.valor, 0);
    const totalAll = relevantTitles.reduce((s, t) => s + t.valor, 0);

    const byEmp: Record<string, number> = {};
    relevantTitles.forEach(t => {
      const key = t.empreendimento || 'Não informado';
      byEmp[key] = (byEmp[key] || 0) + t.valor;
    });
    const byEmpSorted = Object.entries(byEmp).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxEmp = byEmpSorted[0]?.[1] || 1;

    const avgDays = paidTitles.length > 0
      ? Math.round(paidTitles.reduce((s, t) => s + daysBetween(t.createdAt, t.vencimento), 0) / paidTitles.length)
      : null;

    const openFaturas = faturas.filter(f => f.status === 'aberto');
    const openValue = relevantTitles.filter(t => {
      if (t.status === 'pago') return false;
      const f = faturas.find(fa => fa.id === t.faturaId);
      return f?.status === 'aberto';
    }).reduce((s, t) => s + t.valor, 0);

    return { totalPaid, totalAll, byEmpSorted, maxEmp, avgDays, openFaturasCount: openFaturas.length, openValue };
  }, [relevantTitles, faturas]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#08080a]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
            <CreditCard size={16} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-100">Faturas</h1>
            <p className="text-[11px] text-zinc-600">
              {faturas.length} fatura{faturas.length !== 1 ? 's' : ''} · {faturas.filter(f => f.status === 'aberto').length} em aberto
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus size={13} /> Nova Fatura
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
        {/* Dashboard cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <TrendingUp size={11} className="text-emerald-500" /> Gasto Total
            </div>
            <div className="text-lg font-bold text-emerald-400">{formatCurrency(metrics.totalAll)}</div>
            <div className="text-[11px] text-zinc-600">{relevantTitles.length} título{relevantTitles.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <CheckCircle2 size={11} className="text-emerald-500" /> Total Pago
            </div>
            <div className="text-lg font-bold text-zinc-100">{formatCurrency(metrics.totalPaid)}</div>
            <div className="text-[11px] text-zinc-600">{relevantTitles.filter(t => t.status === 'pago').length} pagos</div>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <Package size={11} className="text-blue-400" /> Faturas em Aberto
            </div>
            <div className="text-lg font-bold text-blue-400">{metrics.openFaturasCount}</div>
            <div className="text-[11px] text-zinc-600">{formatCurrency(metrics.openValue)} pendente</div>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <Timer size={11} className="text-amber-400" /> Tempo Médio
            </div>
            <div className="text-lg font-bold text-amber-400">
              {metrics.avgDays !== null ? `${metrics.avgDays}d` : '—'}
            </div>
            <div className="text-[11px] text-zinc-600">até pagamento</div>
          </div>
        </div>

        {/* Gastos por empreendimento */}
        {metrics.byEmpSorted.length > 0 && (
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={13} className="text-blue-400" />
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Gastos por Empreendimento</h3>
            </div>
            <div className="flex flex-col gap-2.5">
              {metrics.byEmpSorted.map(([emp, val]) => (
                <div key={emp} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 truncate w-40 shrink-0">{emp}</span>
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500"
                      style={{ width: `${(val / metrics.maxEmp) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-zinc-300 shrink-0 text-right w-28">{formatCurrency(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Faturas list */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <CreditCard size={13} /> Todas as Faturas
            </h3>

            <div className="flex items-center gap-2 relative">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Filtrar Títulos:</span>

              <button
                onClick={() => setFilterDropdownOpen(p => !p)}
                className="flex items-center gap-2 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-300 transition-all shadow-sm"
              >
                {FILTER_OPTIONS.find(o => o.value === filterStatus)?.label}
                <ChevronDown size={12} className={`text-zinc-500 transition-transform ${filterDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {filterDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setFilterDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-xl shadow-black/50 z-50 overflow-hidden flex flex-col py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    {FILTER_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setFilterStatus(opt.value);
                          setFilterDropdownOpen(false);
                        }}
                        className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left"
                      >
                        {opt.label}
                        {filterStatus === opt.value && <Check size={14} className="text-blue-500" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Table Headers */}
          {faturas.length > 0 && (
            <div className="flex items-center gap-3 px-4 pb-2 border-b border-zinc-800/40">
              <div className="flex-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Fatura</div>
              <div className="w-24 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Situação</div>
              <div className="w-24 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">QTD Títulos</div>
              <div className="w-32 text-right text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Valor Total</div>
              <div className="hidden lg:block w-28 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Vencimento</div>
              <div className="hidden lg:block w-28 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Prazo de PGTO</div>
              <div className="w-28 text-right text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Ações</div>
            </div>
          )}

          {faturas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-700 gap-2">
              <CreditCard size={28} />
              <p className="text-sm">Nenhuma fatura criada ainda.</p>
              <button onClick={() => setShowNewModal(true)} className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                + Criar primeira fatura
              </button>
            </div>
          ) : (
            faturas.filter(fatura => {
              if (filterStatus === 'todos') return true;
              return titles.some(t => t.faturaId === fatura.id && t.status === filterStatus);
            }).map(fatura => (
              <FaturaRow
                key={fatura.id}
                fatura={fatura}
                titles={titles}
                filterStatus={filterStatus}
                onClose={handleClose}
                onDelete={onDeleteFatura}
              />
            ))
          )}
        </div>
      </div>

      {showNewModal && (
        <NewFaturaModal
          defaultCodigo={generateNextFaturaCodigo(faturas)}
          calculatedDates={calculateNextAvailableDates(faturas)}
          onSave={handleCreate}
          onClose={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
}
