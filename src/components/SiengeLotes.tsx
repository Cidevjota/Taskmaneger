import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, X, CheckCircle2, Clock, ChevronDown, ChevronRight,
  DollarSign, Building2, Calendar, Hash, FileText, Layers,
  TrendingUp, Timer, AlertTriangle, Trash2, Check
} from 'lucide-react';
import { SiengeLote, SiengeTitle, SiengeLoteStatus, SiengeTitleStatusHistoryEntry } from '../types';
import MonthSelectDropdown, { MONTHS_FULL } from './MonthSelectDropdown';

interface SiengeLotesProps {
  lotes: SiengeLote[];
  titles: SiengeTitle[];
  statusHistory: SiengeTitleStatusHistoryEntry[];
  onSaveLote: (lote: SiengeLote) => void;
  onDeleteLote: (id: string) => void;
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

// ─── Lógica de Datas ────────────────────────────────────────────────────────────
function getNextTuesday(fromDate: Date): Date {
  const date = new Date(fromDate);
  const day = date.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue
  const daysUntilTuesday = (2 - day + 7) % 7 || 7; // If today is Tuesday, get *next* Tuesday
  date.setDate(date.getDate() + daysUntilTuesday);
  return date;
}

function calculateNextAvailableDates(lotes: SiengeLote[]) {
  const existingVencimentos = new Set(lotes.map(l => l.vencimento).filter(Boolean));
  let candidateDate = getNextTuesday(new Date());
  
  const toLocalISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  while (true) {
    const candidateISO = toLocalISO(candidateDate);
    if (!existingVencimentos.has(candidateISO)) {
      break;
    }
    candidateDate = getNextTuesday(candidateDate);
  }
  
  const vencimentoISO = toLocalISO(candidateDate);
  const prazoPagamentoDate = new Date(candidateDate);
  prazoPagamentoDate.setDate(prazoPagamentoDate.getDate() + 6);
  const prazoPagamentoISO = toLocalISO(prazoPagamentoDate);
  
  return { vencimento: vencimentoISO, prazoPagamento: prazoPagamentoISO };
}

// ─── New Lote Form ────────────────────────────────────────────────────────────
function NewLoteModal({ 
  defaultName, 
  calculatedDates,
  onSave, 
  onClose 
}: { 
  defaultName: string; 
  calculatedDates: { vencimento: string; prazoPagamento: string };
  onSave: (nome: string, dates: { vencimento: string; prazoPagamento: string }) => void; 
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
              <Layers size={14} className="text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-100">Novo Lote de Pagamento</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors">
            <X size={14} />
          </button>
        </div>
        
        <div className="text-sm text-zinc-400 my-2">
          Abertura de um novo lote receberá automaticamente a seguinte numeração sequencial:
          <div className="mt-4 p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg text-center flex items-center justify-center gap-2">
            <Hash size={14} className="text-blue-500/50" />
            <span className="text-lg font-mono font-bold text-blue-400 tracking-wider">{defaultName}</span>
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
            onClick={() => { onSave(defaultName, calculatedDates); onClose(); }}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            Confirmar Criação
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lote Row (accordion) ─────────────────────────────────────────────────────
function LoteRow({
  lote,
  titles,
  filterStatus,
  onClose,
  onDelete,
}: {
  lote: SiengeLote;
  titles: SiengeTitle[];
  filterStatus: string;
  onClose: (lote: SiengeLote) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const allLoteTitles = titles.filter(t => t.loteId === lote.id);
  const loteTitles = allLoteTitles.filter(t => filterStatus === 'todos' || t.status === filterStatus);
  const totalValue = loteTitles.reduce((s, t) => s + t.valor, 0);
  const isAberto = lote.status === 'aberto';

  const today = new Date().toISOString().split('T')[0];
  const unpaidTitles = allLoteTitles.filter(t => t.status !== 'pago');
  const isAllPaid = allLoteTitles.length > 0 && unpaidTitles.length === 0;
  const isOverdue = unpaidTitles.length > 0 && today > lote.prazoPagamento;
  const isWarning = unpaidTitles.length > 0 && today === lote.prazoPagamento;

  let prazoColor = "text-zinc-400";
  if (isAllPaid) prazoColor = "text-emerald-400";
  else if (isOverdue) prazoColor = "text-red-400";
  else if (isWarning) prazoColor = "text-amber-400";

  let displayStatus = isAberto ? 'Aberto' : 'Encerrado';
  let statusBadgeClasses = isAberto 
    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
    : 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/30';

  if (isOverdue && isAberto) {
    displayStatus = 'Em Atraso';
    statusBadgeClasses = 'bg-red-500/20 text-red-400 border border-red-500/30';
  }

  // Automação: Encerra o lote automaticamente se todos estiverem pagos
  useEffect(() => {
    if (isAberto && isAllPaid) {
      onClose(lote);
    }
  }, [isAberto, isAllPaid, lote, onClose]);

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${isAberto ? 'border-zinc-800/60 bg-zinc-900/20' : 'border-zinc-900/40 bg-zinc-950/20'}`}>
      {/* Lote header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded(p => !p)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
            <ChevronRight size={14} className="text-zinc-500 hover:text-zinc-300 transition-colors" />
          </span>
          <span className="text-sm font-semibold text-zinc-200 truncate">{lote.nome}</span>
        </button>

        {/* Status badge */}
        <div className="w-24 flex justify-center shrink-0">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${statusBadgeClasses}`}>
            {displayStatus}
          </span>
        </div>

        {/* Stats */}
        <div className="w-24 flex justify-center shrink-0">
          <span className="text-xs font-medium text-zinc-400">{loteTitles.length} título{loteTitles.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="w-32 flex justify-end shrink-0">
          <span className="text-sm font-medium text-zinc-300">{formatCurrency(totalValue)}</span>
        </div>

        {/* Dates */}
        <div className="hidden lg:flex justify-center shrink-0 w-28">
          <span className="text-sm font-medium text-zinc-400">{formatDate(lote.vencimento)}</span>
        </div>
        <div className="hidden lg:flex justify-center shrink-0 w-28">
          <span className={`text-sm font-medium ${prazoColor}`}>{formatDate(lote.prazoPagamento)}</span>
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
              <span className="text-[10px] text-amber-400">Encerrar lote?</span>
              <button onClick={() => { onClose(lote); setConfirmClose(false); }} className="px-2 py-0.5 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded hover:bg-amber-500/20 transition-colors">Sim</button>
              <button onClick={() => setConfirmClose(false)} className="px-2 py-0.5 text-[10px] text-zinc-600 hover:text-zinc-400 rounded transition-colors">Não</button>
            </div>
          )}
          {loteTitles.length === 0 && !confirmDelete && (
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
              <button onClick={() => { onDelete(lote.id); setConfirmDelete(false); }} className="px-2 py-0.5 text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors">Sim</button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-0.5 text-[10px] text-zinc-600 hover:text-zinc-400 rounded transition-colors">Não</button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded: titles table */}
      {expanded && (
        <div className="border-t border-zinc-800/40 overflow-x-auto">
          {loteTitles.length === 0 ? (
            <div className="px-6 py-5 text-sm text-zinc-600 text-center">Nenhum título neste lote ainda.</div>
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
                {loteTitles.map((t, i) => {
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
export default function SiengeLotes({ lotes, titles, statusHistory, onSaveLote, onDeleteLote }: SiengeLotesProps) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const generateNextName = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const seq = String(lotes.length + 1).padStart(4, '0');
    return `${day}${month}${seq}`;
  };

  const handleCreate = (nome: string, dates: { vencimento: string; prazoPagamento: string }) => {
    const newLote: SiengeLote = {
      id: crypto.randomUUID(),
      nome,
      status: 'aberto',
      createdAt: new Date().toISOString(),
      vencimento: dates.vencimento,
      prazoPagamento: dates.prazoPagamento,
    };
    onSaveLote(newLote);
  };

  const handleClose = (lote: SiengeLote) => {
    onSaveLote({ ...lote, status: 'encerrado', closedAt: new Date().toISOString() });
  };

  // ── Dashboard metrics ──────────────────────────────────────────────────────
  // Base do filtro do mês: o vencimento do LOTE (não do título individual) — é essa
  // data que define a que mês um lote de pagamento pertence.
  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const periodLotes = useMemo(() => lotes.filter(l => l.vencimento?.startsWith(monthKey)), [lotes, monthKey]);

  const metrics = useMemo(() => {
    const periodLoteIds = new Set(periodLotes.map(l => l.id));
    const periodTitles = titles.filter(t => t.loteId && periodLoteIds.has(t.loteId));

    const totalPeriodValue = periodTitles.reduce((s, t) => s + t.valor, 0);
    const paidInPeriod = periodTitles.filter(t => t.status === 'pago');
    const totalPaidInPeriod = paidInPeriod.reduce((s, t) => s + t.valor, 0);

    // Títulos em atraso dentro dos lotes do mês selecionado
    const today = new Date().toISOString().split('T')[0];
    const overdueTitles = periodTitles.filter(t => t.status !== 'pago' && t.vencimento && t.vencimento < today);
    const overdueValue = overdueTitles.reduce((s, t) => s + t.valor, 0);

    // A Pagar: títulos aguardando pagamento dentro do mês selecionado
    const aPagarTitles = periodTitles.filter(t => t.status === 'aguardando_pagamento');
    const aPagarValue = aPagarTitles.reduce((s, t) => s + t.valor, 0);

    const openLotesInPeriod = periodLotes.filter(l => l.status === 'aberto');

    return {
      totalPeriodValue,
      totalPaidInPeriod,
      paidInPeriodCount: paidInPeriod.length,
      periodTitlesCount: periodTitles.length,
      overdueValue,
      overdueCount: overdueTitles.length,
      aPagarValue,
      aPagarCount: aPagarTitles.length,
      openLotesCount: openLotesInPeriod.length,
    };
  }, [titles, periodLotes]);

  // ── Histórico (mês a mês não se aplica: sempre olha a base inteira) ────────
  const historico = useMemo(() => {
    const paidTitles = titles.filter(t => t.status === 'pago' && t.paidAt);

    const onTimePaid = paidTitles.filter(t => t.vencimento && t.paidAt!.split('T')[0] <= t.vencimento);
    const latePaid = paidTitles.filter(t => !t.vencimento || t.paidAt!.split('T')[0] > t.vencimento);

    const avgPaymentDays = paidTitles.length > 0
      ? Math.round(paidTitles.reduce((s, t) => s + daysBetween(t.createdAt, t.paidAt!), 0) / paidTitles.length)
      : null;

    // Tempo médio de aprovação: da 1ª entrada em '1ª alçada' até a 1ª entrada
    // subsequente em 'aguardando pagamento' — inclui o tempo perdido em eventuais
    // recusas/reenvios no meio do caminho. Só existe para títulos com histórico
    // registrado (a partir da criação da tabela de histórico de status).
    const byTitle = new Map<string, SiengeTitleStatusHistoryEntry[]>();
    statusHistory.forEach(h => {
      const list = byTitle.get(h.titleId) || [];
      list.push(h);
      byTitle.set(h.titleId, list);
    });
    const approvalDurationsDays: number[] = [];
    byTitle.forEach(entries => {
      const sorted = [...entries].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
      const firstAprovacao1 = sorted.find(e => e.status === 'aprovacao_1');
      if (!firstAprovacao1) return;
      const firstAprovacao1Time = new Date(firstAprovacao1.changedAt).getTime();
      const firstAguardando = sorted.find(e => e.status === 'aguardando_pagamento' && new Date(e.changedAt).getTime() > firstAprovacao1Time);
      if (!firstAguardando) return;
      approvalDurationsDays.push((new Date(firstAguardando.changedAt).getTime() - firstAprovacao1Time) / 86400000);
    });
    const avgApprovalDays = approvalDurationsDays.length > 0
      ? Math.round(approvalDurationsDays.reduce((s, d) => s + d, 0) / approvalDurationsDays.length)
      : null;

    return {
      onTimePaidCount: onTimePaid.length,
      onTimeValue: onTimePaid.reduce((s, t) => s + t.valor, 0),
      latePaidCount: latePaid.length,
      lateValue: latePaid.reduce((s, t) => s + t.valor, 0),
      avgPaymentDays,
      avgApprovalDays,
      approvalSampleSize: approvalDurationsDays.length,
    };
  }, [titles, statusHistory]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#08080a]">
      {/* Header — mês em destaque, "Lotes de Pagamento" como subtítulo */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
            <Layers size={16} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-100 leading-tight">{MONTHS_FULL[selectedMonth]} {selectedYear}</h1>
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Lotes de Pagamento · {periodLotes.length} no mês
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MonthSelectDropdown
            year={selectedYear}
            month={selectedMonth}
            onChange={(y, m) => { setSelectedYear(y); setSelectedMonth(m); }}
          />
          <button
            onClick={() => setShowHistorico(p => !p)}
            title="Exibir métricas históricas (todos os títulos, sem filtro de mês)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              showHistorico ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <Clock size={12} />
            Histórico
            <span className={`ml-0.5 flex items-center h-4 w-7 rounded-full transition-colors ${showHistorico ? 'bg-blue-500' : 'bg-zinc-700'}`}>
              <span className={`h-3 w-3 rounded-full bg-white transition-transform ${showHistorico ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </span>
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus size={13} /> Novo Lote
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
        {/* Dashboard cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Valor total do período */}
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <TrendingUp size={11} className="text-emerald-500" /> Valor Total
            </div>
            <div className="text-lg font-bold text-emerald-400">{formatCurrency(metrics.totalPeriodValue)}</div>
            <div className="text-[11px] text-zinc-600">{metrics.periodTitlesCount} título{metrics.periodTitlesCount !== 1 ? 's' : ''} no mês</div>
          </div>
          {/* Pagos no período */}
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <CheckCircle2 size={11} className="text-emerald-500" /> Total Pago
            </div>
            <div className="text-lg font-bold text-zinc-100">{formatCurrency(metrics.totalPaidInPeriod)}</div>
            <div className="text-[11px] text-zinc-600">{metrics.paidInPeriodCount} título{metrics.paidInPeriodCount !== 1 ? 's' : ''} pago{metrics.paidInPeriodCount !== 1 ? 's' : ''}</div>
          </div>
          {/* Títulos em atraso */}
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <AlertTriangle size={11} className="text-red-400" /> Títulos em Atraso
            </div>
            <div className="text-lg font-bold text-red-400">{formatCurrency(metrics.overdueValue)}</div>
            <div className="text-[11px] text-zinc-600">{metrics.overdueCount} título{metrics.overdueCount !== 1 ? 's' : ''} em atraso</div>
          </div>
          {/* A Pagar */}
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <Clock size={11} className="text-amber-400" /> A Pagar
            </div>
            <div className="text-lg font-bold text-amber-400">{formatCurrency(metrics.aPagarValue)}</div>
            <div className="text-[11px] text-zinc-600">{metrics.aPagarCount} aguardando pagamento</div>
          </div>
        </div>

        {/* Histórico — métricas globais, sem filtro de mês */}
        {showHistorico && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <CheckCircle2 size={11} className="text-emerald-500" /> Total Pago em Dia
              </div>
              <div className="text-lg font-bold text-emerald-400">{formatCurrency(historico.onTimeValue)}</div>
              <div className="text-[11px] text-zinc-600">{historico.onTimePaidCount} Títulos pagos em dia.</div>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <AlertTriangle size={11} className="text-red-400" /> Total Pago em Atraso
              </div>
              <div className="text-lg font-bold text-red-400">{formatCurrency(historico.lateValue)}</div>
              <div className="text-[11px] text-zinc-600">{historico.latePaidCount} Títulos pago em atraso</div>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <Timer size={11} className="text-amber-400" /> Tempo Médio até Pagamento
              </div>
              <div className="text-lg font-bold text-amber-400">{historico.avgPaymentDays !== null ? `${historico.avgPaymentDays}d` : '—'}</div>
              <div className="text-[11px] text-zinc-600">considerando todos os títulos</div>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <Timer size={11} className="text-blue-400" /> Tempo Médio de Aprovação
              </div>
              <div className="text-lg font-bold text-blue-400">{historico.avgApprovalDays !== null ? `${historico.avgApprovalDays}d` : '—'}</div>
              <div className="text-[11px] text-zinc-600">
                {historico.approvalSampleSize > 0 ? `1ª alçada até aguardando · ${historico.approvalSampleSize} títulos` : 'sem dados desde a criação do histórico'}
              </div>
            </div>
          </div>
        )}

        {/* Lotes list */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Layers size={13} /> Lotes de {MONTHS_FULL[selectedMonth]}
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
          {periodLotes.length > 0 && (
            <div className="flex items-center gap-3 px-4 pb-2 border-b border-zinc-800/40">
              <div className="flex-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Lote</div>
              <div className="w-24 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Situação</div>
              <div className="w-24 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">QTD Títulos</div>
              <div className="w-32 text-right text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Valor Total</div>
              <div className="hidden lg:block w-28 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Vencimento</div>
              <div className="hidden lg:block w-28 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Prazo de PGTO</div>
              <div className="w-28 text-right text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Ações</div>
            </div>
          )}

          {lotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-700 gap-2">
              <Layers size={28} />
              <p className="text-sm">Nenhum lote criado ainda.</p>
              <button onClick={() => setShowNewModal(true)} className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                + Criar primeiro lote
              </button>
            </div>
          ) : periodLotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-700 gap-2">
              <Layers size={28} />
              <p className="text-sm">Nenhum lote com vencimento em {MONTHS_FULL[selectedMonth]} de {selectedYear}.</p>
            </div>
          ) : (
            periodLotes.filter(lote => {
              if (filterStatus === 'todos') return true;
              return titles.some(t => t.loteId === lote.id && t.status === filterStatus);
            }).map(lote => (
              <LoteRow
                key={lote.id}
                lote={lote}
                titles={titles}
                filterStatus={filterStatus}
                onClose={handleClose}
                onDelete={onDeleteLote}
              />
            ))
          )}
        </div>
      </div>

        {showNewModal && (
          <NewLoteModal
            defaultName={generateNextName()}
            calculatedDates={calculateNextAvailableDates(lotes)}
            onSave={handleCreate}
            onClose={() => setShowNewModal(false)}
          />
        )}
    </div>
  );
}
