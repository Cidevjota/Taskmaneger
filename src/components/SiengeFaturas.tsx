import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, X, CheckCircle2, ChevronRight,
  Hash, FileText, CreditCard,
  TrendingUp, BarChart3, Timer, Package, AlertTriangle, Trash2
} from 'lucide-react';
import { SiengeFatura, SiengeTitle, SiengeLote, Project } from '../types';
import { SiengeTaxonomy } from '../lib/siengeCategorias';
import SiengeTitleModal from './SiengeTitleModal';

interface SiengeFaturasProps {
  faturas: SiengeFatura[];
  titles: SiengeTitle[];
  onSaveFatura: (fatura: SiengeFatura) => void;
  onDeleteFatura: (id: string) => void;
  // Despesas e o título gerado são gravados na mesma tabela dos títulos.
  onSaveTitle: (title: SiengeTitle) => void;
  openLotes: SiengeLote[];
  projects: Project[];
  taxonomy: SiengeTaxonomy;
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

const MONTH_FULL: Record<string, string> = {
  JAN: 'JANEIRO', FEV: 'FEVEREIRO', MAR: 'MARÇO', ABR: 'ABRIL', MAI: 'MAIO', JUN: 'JUNHO',
  JUL: 'JULHO', AGO: 'AGOSTO', SET: 'SETEMBRO', OUT: 'OUTUBRO', NOV: 'NOVEMBRO', DEZ: 'DEZEMBRO',
};

// Descrição do título gerado pela fatura. O mês sai do próprio código (FATAGO002 → AGO
// → AGOSTO); se o código fugir do padrão, cai no mês de criação da fatura.
export function faturaDescricao(fatura: SiengeFatura): string {
  const abbr = fatura.codigo?.slice(3, 6).toUpperCase();
  const mes = MONTH_FULL[abbr] || MONTH_FULL[MONTH_ABBR[new Date(fatura.createdAt).getMonth()]];
  return `FATURA CARTÃO DE CRÉDITO ${mes}`;
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

// ─── Gerar Título a partir da fatura ────────────────────────────────────────────
function GerarTituloModal({
  fatura, total, openLotes, onConfirm, onClose,
}: {
  fatura: SiengeFatura;
  total: number;
  openLotes: SiengeLote[];
  onConfirm: (loteId: string) => void;
  onClose: () => void;
}) {
  const [loteId, setLoteId] = useState('');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-[#0d0d10] border border-zinc-800/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
              <FileText size={14} className="text-emerald-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-100">Gerar Título da Fatura</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Descrição</span>
            <span className="text-xs text-zinc-200 font-semibold">{faturaDescricao(fatura)}</span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Valor (soma das despesas)</span>
            <span className="text-xs text-emerald-400 font-semibold">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Lote de Pagamento *</label>
          {openLotes.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-medium">
              <AlertTriangle size={14} />
              Cadastre um lote na aba "Lotes de Pagamento" antes de gerar o título.
            </div>
          ) : (
            <select
              value={loteId}
              onChange={e => setLoteId(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-blue-500/50"
            >
              <option value="">Selecione um lote...</option>
              {openLotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors">Cancelar</button>
          <button
            onClick={() => onConfirm(loteId)}
            disabled={!loteId}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
          >
            Gerar Título
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
  onClose,
  onDelete,
  onGerarTitulo,
  onNovaDespesa,
}: {
  fatura: SiengeFatura;
  titles: SiengeTitle[];
  onClose: (fatura: SiengeFatura) => void;
  onDelete: (id: string) => void;
  onGerarTitulo: (fatura: SiengeFatura) => void;
  onNovaDespesa: (fatura: SiengeFatura) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const despesas = titles.filter(t => t.faturaId === fatura.id);
  const totalValue = despesas.reduce((s, t) => s + t.valor, 0);
  const isAberto = fatura.status === 'aberto';

  // O título gerado é a conta que representa a fatura inteira no kanban. Enquanto
  // ele existir, é o status dele que manda na situação exibida aqui.
  const tituloGerado = fatura.tituloId ? titles.find(t => t.id === fatura.tituloId) : undefined;
  const isPago = tituloGerado?.status === 'pago';

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = !isPago && !!fatura.prazoPagamento && today > fatura.prazoPagamento;
  const isWarning = !isPago && today === fatura.prazoPagamento;

  let prazoColor = "text-zinc-400";
  if (isPago) prazoColor = "text-emerald-400";
  else if (isOverdue) prazoColor = "text-red-400";
  else if (isWarning) prazoColor = "text-amber-400";

  let displayStatus = isAberto ? 'Aberta' : 'Encerrada';
  let statusBadgeClasses = isAberto
    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
    : 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/30';

  if (tituloGerado) {
    displayStatus = STATUS_LABELS[tituloGerado.status] || tituloGerado.status;
    statusBadgeClasses = `${STATUS_COLORS[tituloGerado.status] || 'bg-zinc-700/50 text-zinc-400'} border border-transparent`;
  } else if (isOverdue && isAberto) {
    displayStatus = 'Em Atraso';
    statusBadgeClasses = 'bg-red-500/20 text-red-400 border border-red-500/30';
  }

  // Automação: quando o título gerado é pago, a fatura se encerra sozinha.
  useEffect(() => {
    if (isAberto && isPago) {
      onClose(fatura);
    }
  }, [isAberto, isPago, fatura, onClose]);

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
          <span className="text-xs font-medium text-zinc-400">{despesas.length} despesa{despesas.length !== 1 ? 's' : ''}</span>
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
        <div className="flex items-center justify-end gap-1 shrink-0 w-64">
          {isAberto && (
            <button
              onClick={() => onNovaDespesa(fatura)}
              title="Lançar uma despesa nesta fatura"
              className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 rounded-lg transition-colors"
            >
              <Plus size={13} /> Despesa
            </button>
          )}
          {/* Sem despesas não há o que cobrar; com título já gerado, gerar de novo
              duplicaria a conta no kanban. */}
          {isAberto && !tituloGerado && despesas.length > 0 && (
            <button
              onClick={() => onGerarTitulo(fatura)}
              title="Gerar o título desta fatura no kanban"
              className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 rounded-lg transition-colors"
            >
              <FileText size={13} /> Gerar Título
            </button>
          )}
          {tituloGerado && (
            <span className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold text-emerald-400/80 uppercase tracking-wider" title={`Título gerado: ${tituloGerado.descricao || tituloGerado.titulo}`}>
              <CheckCircle2 size={12} /> Gerada
            </span>
          )}
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
          {despesas.length === 0 && !confirmDelete && (
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
          {despesas.length === 0 ? (
            <div className="px-6 py-5 text-sm text-zinc-600 text-center">Nenhuma despesa nesta fatura ainda.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800/40 bg-zinc-950/40">
                  <th className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Nº Doc.</th>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Descrição</th>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Motivo Detalhado</th>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Empreendimento</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Valor</th>
                </tr>
              </thead>
              <tbody>
                {despesas.map((t, i) => (
                  <tr key={t.id} className={`border-b border-zinc-900/40 hover:bg-zinc-800/20 transition-colors ${i % 2 === 0 ? '' : 'bg-zinc-900/10'}`}>
                    <td className="px-4 py-2.5 font-semibold text-blue-400">{t.titulo || '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-400 truncate max-w-[200px]">{t.descricao || '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-400 max-w-[260px]">
                      <span className="block truncate" title={t.motivoDetalhado || undefined}>{t.motivoDetalhado || '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400 truncate max-w-[160px]">{t.empreendimento || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-400">{formatCurrency(t.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SiengeFaturas({
  faturas, titles, onSaveFatura, onDeleteFatura, onSaveTitle, openLotes, projects, taxonomy,
}: SiengeFaturasProps) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [despesaModalOpen, setDespesaModalOpen] = useState(false);
  const [despesaFatura, setDespesaFatura] = useState<SiengeFatura | null>(null);
  const [gerarTituloFatura, setGerarTituloFatura] = useState<SiengeFatura | null>(null);

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

  // Só despesas: o título gerado por uma fatura não tem faturaId (vive no kanban),
  // então somá-lo aqui contaria a mesma dívida duas vezes.
  const despesas = useMemo(() => titles.filter(t => !!t.faturaId), [titles]);

  // Gera o título que representa a fatura inteira no kanban, com o total das suas
  // despesas. O vínculo nos dois sentidos (fatura.tituloId) é o que faz a situação
  // da fatura passar a seguir o status desse título.
  const handleGerarTitulo = (fatura: SiengeFatura, loteId: string) => {
    const total = titles.filter(t => t.faturaId === fatura.id).reduce((s, t) => s + t.valor, 0);
    const novoTitulo: SiengeTitle = {
      id: crypto.randomUUID(),
      titulo: fatura.codigo,
      descricao: faturaDescricao(fatura),
      valor: total,
      loteId,
      vencimento: fatura.prazoPagamento || fatura.vencimento,
      status: 'a_lancar',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveTitle(novoTitulo);
    onSaveFatura({ ...fatura, tituloId: novoTitulo.id });
    setGerarTituloFatura(null);
  };

  // ── Dashboard metrics ──────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const isFaturaPaga = (faturaId?: string) => {
      const f = faturas.find(fa => fa.id === faturaId);
      if (!f?.tituloId) return false;
      return titles.find(t => t.id === f.tituloId)?.status === 'pago';
    };

    const totalAll = despesas.reduce((s, t) => s + t.valor, 0);
    const paidDespesas = despesas.filter(t => isFaturaPaga(t.faturaId));
    const totalPaid = paidDespesas.reduce((s, t) => s + t.valor, 0);

    const byEmp: Record<string, number> = {};
    despesas.forEach(t => {
      const key = t.empreendimento || 'Não informado';
      byEmp[key] = (byEmp[key] || 0) + t.valor;
    });
    const byEmpSorted = Object.entries(byEmp).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxEmp = byEmpSorted[0]?.[1] || 1;

    // Tempo médio entre abrir a fatura e pagar o título que ela gerou.
    const faturasPagas = faturas.filter(f => f.tituloId && titles.find(t => t.id === f.tituloId)?.status === 'pago');
    const avgDays = faturasPagas.length > 0
      ? Math.round(faturasPagas.reduce((s, f) => {
          const t = titles.find(x => x.id === f.tituloId);
          return s + daysBetween(f.createdAt, t?.paidAt || t?.vencimento);
        }, 0) / faturasPagas.length)
      : null;

    const openFaturas = faturas.filter(f => f.status === 'aberto');
    const openValue = despesas
      .filter(t => faturas.find(fa => fa.id === t.faturaId)?.status === 'aberto')
      .reduce((s, t) => s + t.valor, 0);

    return { totalPaid, totalAll, byEmpSorted, maxEmp, avgDays, openFaturasCount: openFaturas.length, openValue };
  }, [despesas, faturas, titles]);

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus size={13} /> Nova Fatura
          </button>
          <button
            onClick={() => { setDespesaFatura(null); setDespesaModalOpen(true); }}
            title={faturas.some(f => f.status === 'aberto') ? undefined : 'Abra uma fatura antes de lançar despesas'}
            disabled={!faturas.some(f => f.status === 'aberto')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 rounded-lg transition-all"
          >
            <Plus size={13} /> Nova Despesa
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
        {/* Dashboard cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <TrendingUp size={11} className="text-emerald-500" /> Gasto Total
            </div>
            <div className="text-lg font-bold text-emerald-400">{formatCurrency(metrics.totalAll)}</div>
            <div className="text-[11px] text-zinc-600">{despesas.length} despesa{despesas.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <CheckCircle2 size={11} className="text-emerald-500" /> Total Pago
            </div>
            <div className="text-lg font-bold text-zinc-100">{formatCurrency(metrics.totalPaid)}</div>
            <div className="text-[11px] text-zinc-600">faturas quitadas</div>
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
          </div>

          {/* Table Headers */}
          {faturas.length > 0 && (
            <div className="flex items-center gap-3 px-4 pb-2 border-b border-zinc-800/40">
              <div className="flex-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Fatura</div>
              <div className="w-24 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Situação</div>
              <div className="w-24 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">QTD Despesas</div>
              <div className="w-32 text-right text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Valor Total</div>
              <div className="hidden lg:block w-28 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Vencimento</div>
              <div className="hidden lg:block w-28 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Prazo de PGTO</div>
              <div className="w-64 text-right text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Ações</div>
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
            faturas.map(fatura => (
              <FaturaRow
                key={fatura.id}
                fatura={fatura}
                titles={titles}
                onClose={handleClose}
                onDelete={onDeleteFatura}
                onGerarTitulo={setGerarTituloFatura}
                onNovaDespesa={(f) => { setDespesaFatura(f); setDespesaModalOpen(true); }}
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

      {gerarTituloFatura && (
        <GerarTituloModal
          fatura={gerarTituloFatura}
          total={titles.filter(t => t.faturaId === gerarTituloFatura.id).reduce((s, t) => s + t.valor, 0)}
          openLotes={openLotes}
          onConfirm={(loteId) => handleGerarTitulo(gerarTituloFatura, loteId)}
          onClose={() => setGerarTituloFatura(null)}
        />
      )}

      {/* Despesa reaproveita o modal de título em modo despesa. `initialData` já vem
          com a fatura preenchida quando o lançamento parte de uma fatura específica. */}
      <SiengeTitleModal
        isOpen={despesaModalOpen}
        despesaMode
        onClose={() => { setDespesaModalOpen(false); setDespesaFatura(null); }}
        onSave={(t) => { onSaveTitle(t); setDespesaModalOpen(false); setDespesaFatura(null); }}
        initialFaturaId={despesaFatura?.id}
        openLotes={openLotes}
        openFaturas={faturas.filter(f => f.status === 'aberto')}
        projects={projects}
        taxonomy={taxonomy}
      />
    </div>
  );
}
