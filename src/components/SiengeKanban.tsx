import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Plus, Hash, DollarSign, Building2, Calendar, Tag, Receipt,
  ChevronRight, AlertTriangle, CheckCircle2, Clock, XCircle,
  Banknote, ArrowRight, Search, SlidersHorizontal, User, BellRing,
  LayoutGrid, AlignJustify, Check, ChevronDown, Paperclip, Copy
} from 'lucide-react';
import { SiengeTitle, SiengeStatus, SiengeLote, Project } from '../types';
import SiengeTitleModal from './SiengeTitleModal';
import DatePicker from './DatePicker';
import { useAuth } from '../context/AuthContext';

interface SiengeKanbanProps {
  titles: SiengeTitle[];
  openLotes: SiengeLote[];
  projects: Project[];
  currentProjectFilter: string | null;
  onSave: (title: SiengeTitle) => void;
  onDelete: (id: string) => void;
}

const COLUMNS: { id: SiengeStatus; label: string; shortLabel: string; color: string; dotColor: string; bg: string; border: string; icon: React.ReactNode }[] = [
  {
    id: 'a_lancar',
    label: 'A Lançar',
    shortLabel: 'A Lançar',
    color: 'text-zinc-400',
    dotColor: 'bg-zinc-500',
    bg: 'bg-zinc-500/5',
    border: 'border-zinc-500/20',
    icon: <Clock size={12} />,
  },
  {
    id: 'aprovacao_1',
    label: 'Aprovação em 1ª Alçada',
    shortLabel: '1ª Alçada',
    color: 'text-sky-400',
    dotColor: 'bg-sky-500',
    bg: 'bg-sky-500/5',
    border: 'border-sky-500/20',
    icon: <ChevronRight size={12} />,
  },
  {
    id: 'aprovacao_2',
    label: 'Aprovação em 2ª Alçada',
    shortLabel: '2ª Alçada',
    color: 'text-blue-400',
    dotColor: 'bg-blue-500',
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    icon: <ChevronRight size={12} />,
  },
  {
    id: 'aprovacao_3',
    label: 'Aprovação em 3ª Alçada',
    shortLabel: '3ª Alçada',
    color: 'text-violet-400',
    dotColor: 'bg-violet-500',
    bg: 'bg-violet-500/5',
    border: 'border-violet-500/20',
    icon: <ChevronRight size={12} />,
  },
  {
    id: 'aguardando_pagamento',
    label: 'Aguardando Pagamento',
    shortLabel: 'Aguardando',
    color: 'text-amber-400',
    dotColor: 'bg-amber-500',
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    icon: <Banknote size={12} />,
  },
  {
    id: 'recusados',
    label: 'Recusados',
    shortLabel: 'Recusados',
    color: 'text-red-400',
    dotColor: 'bg-red-500',
    bg: 'bg-red-500/5',
    border: 'border-red-500/20',
    icon: <XCircle size={12} />,
  },
  {
    id: 'pago',
    label: 'Pago',
    shortLabel: 'Pago',
    color: 'text-emerald-400',
    dotColor: 'bg-emerald-500',
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/20',
    icon: <CheckCircle2 size={12} />,
  },
];

function formatCurrencyDisplay(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function isExpired(vencimento?: string): boolean {
  if (!vencimento) return false;
  return new Date(vencimento + 'T00:00:00') < new Date(new Date().toDateString());
}

function isTodayDate(vencimento?: string): boolean {
  if (!vencimento) return false;
  return new Date(vencimento + 'T00:00:00').getTime() === new Date(new Date().toDateString()).getTime();
}

interface TitleCardProps {
  title: SiengeTitle;
  column: typeof COLUMNS[0];
  onClick: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  isDragging: boolean;
  lotes: SiengeLote[];
  onUpdateTitle: (title: SiengeTitle) => void;
  isCompact: boolean;
}

function TitleCard({ title, column, onClick, onDragStart, isDragging, lotes, onUpdateTitle, isCompact }: TitleCardProps) {
  const [isDraggable, setIsDraggable] = useState(true);
  const [copied, setCopied] = useState(false);
  const { allUsers } = useAuth();
  
  const expired = isExpired(title.vencimento);
  const isDueToday = isTodayDate(title.vencimento);
  const isPaid = title.status === 'pago';
  const resolvedLoteName = title.loteId ? lotes.find(l => l.id === title.loteId)?.nome : title.lote;
  const assignee = title.assigneeId ? allUsers.find(u => u.id === title.assigneeId) : null;

  const handleTextHover = (hovering: boolean) => setIsDraggable(!hovering);

  let badgeColor = 'bg-zinc-800/60 text-zinc-400'; // Default: cinza (dentro do prazo)
  if (isPaid) {
    badgeColor = 'bg-emerald-900/40 text-emerald-300'; // Verde: pago
  } else if (expired) {
    badgeColor = 'bg-red-900/40 text-red-300'; // Vermelho: atrasado e não pago
  } else if (isDueToday) {
    badgeColor = 'bg-amber-900/40 text-amber-300'; // Amarelo: vence hoje
  }

  const handleClick = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return; // If text is selected, don't open modal
    }
    onClick();
  };

  if (isCompact) {
    return (
      <div
        id={`sienge-title-${title.id}`}
        draggable={isDraggable}
        onDragStart={e => {
          if (isDraggable) onDragStart(e, title.id);
        }}
        onClick={handleClick}
        className={`group flex items-center gap-2 bg-[#121214] hover:bg-[#161619] border border-zinc-900/60 hover:border-zinc-800 rounded-md px-2.5 py-1.5 transition-all duration-150 cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-0' : ''}`}
      >
        <span 
          className="text-xs text-blue-400 font-mono tracking-wide cursor-pointer shrink-0 hover:text-blue-300 transition-colors"
          title={copied ? "Copiado!" : "Copiar Título"}
          onClick={(e) => {
            e.stopPropagation();
            if (title.titulo) {
              navigator.clipboard.writeText(title.titulo);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
          onMouseEnter={() => handleTextHover(true)}
          onMouseLeave={() => handleTextHover(false)}
        >
          {title.titulo || '-'}
        </span>
        
        <span className="flex-1 text-[11px] font-medium text-zinc-200 truncate min-w-0 cursor-text"
          onMouseEnter={() => handleTextHover(true)}
          onMouseLeave={() => handleTextHover(false)}
          title={title.descricao}
        >
          {title.descricao || ''}
        </span>

        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <DatePicker
            value={title.reminderDate || ''}
            align="right"
            disableAutoScroll
            onChange={(date) => { onUpdateTitle({ ...title, reminderDate: date || undefined }); }}
            enableTime={true}
            onQuickAdd={() => { const t = new Date(); t.setDate(t.getDate() + 1); onUpdateTitle({ ...title, reminderDate: `${t.toISOString().split('T')[0]}T09:00` }); }}
            trigger={
              <button 
                type="button" 
                className={`flex items-center justify-center transition-colors ${title.reminderDate ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-600 hover:text-zinc-400'} hover:scale-110 active:scale-95`} 
                title={title.reminderDate ? "Desativar lembretes" : "Ativar lembretes"}
              >
                <BellRing size={11} />
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div
      id={`sienge-title-${title.id}`}
      draggable={isDraggable}
      onDragStart={e => {
        if (isDraggable) onDragStart(e, title.id);
      }}
      onClick={handleClick}
      className={`group relative bg-[#18181b] hover:bg-[#1f1f23] border border-transparent hover:border-zinc-800/80 rounded-xl p-3 cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-black/40 ${isDragging ? 'opacity-0' : ''}`}
    >
      {/* Top Row: Título & Descrição */}
      <div className="flex flex-col mb-3">
        <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-widest mb-0.5">Título</span>
        <div className="flex items-center gap-3">
          <div 
            className="flex items-center gap-1.5 cursor-pointer shrink-0 group/copy"
            title={copied ? "Copiado!" : "Copiar Título"}
            onClick={(e) => {
              e.stopPropagation();
              if (title.titulo) {
                navigator.clipboard.writeText(title.titulo);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
            onMouseEnter={() => handleTextHover(true)}
            onMouseLeave={() => handleTextHover(false)}
          >
            <span className={`text-sm font-medium tracking-wide transition-colors ${copied ? 'text-emerald-400' : 'text-zinc-100 group-hover/copy:text-blue-400'}`}>
              {title.titulo || '-'}
            </span>
            {copied ? (
              <Check size={12} className="text-emerald-400 animate-in fade-in zoom-in" />
            ) : (
              <Copy size={12} className="text-blue-400 opacity-0 group-hover/copy:opacity-100 transition-opacity" />
            )}
          </div>
          <span 
            className="text-sm text-zinc-100 font-medium tracking-wide truncate cursor-text"
            onMouseEnter={() => handleTextHover(true)}
            onMouseLeave={() => handleTextHover(false)}
            title={title.descricao}
          >
            {title.descricao || ''}
          </span>
        </div>
      </div>

      {/* Middle Row: Empreendimento, Lote, Vencimento */}
      <div className="flex justify-between items-end mb-3">
        <div className="flex gap-4">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-widest mb-0.5">Empreendimento:</span>
            <span 
              className="text-xs text-zinc-300 font-normal cursor-text truncate max-w-[90px]"
              onMouseEnter={() => handleTextHover(true)}
              onMouseLeave={() => handleTextHover(false)}
            >
              {title.empreendimento || '-'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-widest mb-0.5">Lote</span>
            <span 
              className="text-xs text-zinc-300 font-normal cursor-text"
              onMouseEnter={() => handleTextHover(true)}
              onMouseLeave={() => handleTextHover(false)}
            >
              {resolvedLoteName || '-'}
            </span>
          </div>
        </div>
        {title.vencimento && (
          <div className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide border border-transparent ${
            isPaid ? 'border-emerald-500/20' : expired ? 'border-red-500/20' : isDueToday ? 'border-amber-500/20' : 'border-zinc-700/30'
          } ${badgeColor}`}>
            {formatDate(title.vencimento)}
          </div>
        )}
      </div>

      {/* Bottom Row: Valor & Ícones */}
      <div className="flex justify-between items-center pt-2 border-t border-zinc-800/40">
        <span className="text-sm text-white font-bold tracking-tight">
          {formatCurrencyDisplay(title.valor)}
        </span>
        <div className="flex items-center gap-2">
          {title.attachments && title.attachments.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Download the first attachment
                const att = title.attachments![0];
                const link = document.createElement('a');
                link.href = att.data;
                link.download = att.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="flex items-center justify-center w-5 h-5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 transition-colors border border-blue-500/20 mr-1"
              title={`Baixar anexo: ${title.attachments[0].name}`}
            >
              <Paperclip size={11} />
            </button>
          )}
          {assignee && (
            assignee.avatarUrl ? (
              <img 
                src={assignee.avatarUrl} 
                alt={assignee.name} 
                title={assignee.name}
                className="w-5 h-5 rounded-full object-cover border border-zinc-800"
              />
            ) : (
              <div 
                title={assignee.name}
                className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[9px] font-bold border border-zinc-800"
              >
                {assignee.initials}
              </div>
            )
          )}
          {/* Lembrete de Sino (Bell Reminder) */}
          <div onClick={(e) => e.stopPropagation()}>
            <DatePicker
              value={title.reminderDate || ''}
              align="right"
              disableAutoScroll
              onChange={(date) => { onUpdateTitle({ ...title, reminderDate: date || undefined }); }}
              enableTime={true}
              onQuickAdd={() => { const t = new Date(); t.setDate(t.getDate() + 1); onUpdateTitle({ ...title, reminderDate: `${t.toISOString().split('T')[0]}T09:00` }); }}
              trigger={
                <button 
                  type="button" 
                  className={`flex items-center justify-center transition-colors ${title.reminderDate ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-600 hover:text-zinc-400'} hover:scale-110 active:scale-95 ml-1`} 
                  title={title.reminderDate ? "Desativar lembretes" : "Ativar lembretes"}
                >
                  <BellRing size={13} />
                </button>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function LoteFilterDropdown({ openLotes, value, onChange }: { openLotes: SiengeLote[], value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const selectedLote = value === 'all' ? null : openLotes.find(l => l.id === value);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all bg-[#121214] border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 min-w-[140px] shadow-sm"
      >
        <span className="truncate flex-1 text-left">{selectedLote ? selectedLote.nome : 'Todos os Lotes'}</span>
        <ChevronDown size={12} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-[220px] bg-[#1a1a1e] border border-zinc-800 rounded-lg shadow-2xl py-1 z-50 animate-fade-in origin-top-right flex flex-col max-h-[300px] overflow-y-auto no-scrollbar">
          <button
            onClick={() => { onChange('all'); setIsOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${value === 'all' ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-white'}`}
          >
            <span>Todos os Lotes</span>
            {value === 'all' && <Check size={14} />}
          </button>
          
          {openLotes.length > 0 && <div className="h-px bg-zinc-800/50 my-1 mx-2" />}

          {openLotes.map(lote => (
            <button
              key={lote.id}
              onClick={() => { onChange(lote.id); setIsOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${value === lote.id ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-white'}`}
            >
              <span className="truncate pr-2 text-left">{lote.nome}</span>
              {value === lote.id && <Check size={14} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SiengeKanban({ titles, openLotes, projects, currentProjectFilter, onSave, onDelete }: SiengeKanbanProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState<SiengeTitle | null>(null);
  const [modalInitialStatus, setModalInitialStatus] = useState<SiengeStatus>('a_lancar');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<SiengeStatus | null>(null);
  const [search, setSearch] = useState('');
  const [isCompact, setIsCompact] = useState(false);
  const [filterLoteId, setFilterLoteId] = useState<string | 'all'>('all');

  // Horizontal pan state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colId: SiengeStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(colId);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetStatus: SiengeStatus) => {
    e.preventDefault();
    if (!dragId) return;
    const dragged = titles.find(t => t.id === dragId);
    if (dragged && dragged.status !== targetStatus) {
      onSave({ ...dragged, status: targetStatus, updatedAt: new Date().toISOString() });
    }
    setDragId(null);
    setDropTarget(null);
  }, [dragId, titles, onSave]);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDropTarget(null);
  }, []);

  const openNew = (status: SiengeStatus) => {
    setEditingTitle(null);
    setModalInitialStatus(status);
    setModalOpen(true);
  };

  // Horizontal Pan Handlers
  const handleWheel = (e: React.WheelEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.kanban-column')) return;
    if (e.deltaY !== 0) {
      document.querySelectorAll('.kanban-column').forEach(col => { (col as HTMLElement).scrollTop += e.deltaY; });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('[draggable]') || target.closest('.cursor-text')) return;
    setIsPanning(true);
    setStartX(e.pageX - (scrollContainerRef.current?.offsetLeft || 0));
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
  };

  const handleMouseLeave = () => setIsPanning(false);
  const handleMouseUp = () => setIsPanning(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollContainerRef.current.scrollLeft = scrollLeft - (x - startX) * 1.5;
  };

  const openEdit = (title: SiengeTitle) => {
    setEditingTitle(title);
    setModalOpen(true);
  };

  const handleSave = (title: SiengeTitle) => {
    onSave(title);
    setModalOpen(false);
    setEditingTitle(null);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    setModalOpen(false);
    setEditingTitle(null);
  };

  const filteredTitles = useMemo(() => {
    let list = titles;

    // Filter by project if active
    if (currentProjectFilter) {
      const activeProject = projects.find(p => p.id === currentProjectFilter);
      if (activeProject) {
        list = list.filter(t => t.empreendimento === activeProject.name);
      }
    }

    // Filter by lote if active
    if (filterLoteId !== 'all') {
      list = list.filter(t => t.loteId === filterLoteId);
    }

    if (!search) return list;
    const lower = search.toLowerCase();
    return list.filter(t => 
      t.titulo.toLowerCase().includes(lower) ||
      (t.empreendimento || '').toLowerCase().includes(lower) ||
      (t.descricao || '').toLowerCase().includes(lower) ||
      (t.lote || '').toLowerCase().includes(lower)
    );
  }, [titles, search, projects, currentProjectFilter]);

  const totalValue = titles.reduce((sum, t) => sum + t.valor, 0);
  const pendingCount = titles.filter(t => t.status !== 'pago' && t.status !== 'recusados').length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#08080a]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
            <Receipt size={16} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-100">Títulos Sienge</h1>
            <p className="text-[11px] text-zinc-600">
              {titles.length} título{titles.length !== 1 ? 's' : ''} · {pendingCount} em andamento · {formatCurrencyDisplay(totalValue)} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Lote Filter */}
          <LoteFilterDropdown 
            openLotes={openLotes} 
            value={filterLoteId} 
            onChange={setFilterLoteId} 
          />
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar título..."
              className="w-48 bg-zinc-900/60 border border-zinc-800 rounded-lg pl-7 pr-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
            />
          </div>
          <button
            onClick={() => setIsCompact(v => !v)}
            title={isCompact ? 'Modo Normal' : 'Modo Ultra-Compacto'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${isCompact ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-500 hover:text-zinc-300'}`}
          >
            {isCompact ? <LayoutGrid size={12} /> : <AlignJustify size={12} />}
            <span className="hidden sm:inline">{isCompact ? 'Normal' : 'Compacto'}</span>
          </button>
          <button
            onClick={() => openNew('a_lancar')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
          >
            <Plus size={13} /> Novo Título
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div 
        ref={scrollContainerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className={`flex-1 flex overflow-x-auto min-h-0 p-5 gap-4 select-none scrollbar-minimal ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        {COLUMNS.map(col => {
          const colTitles = filteredTitles.filter(t => t.status === col.id);
          const colValue = colTitles.reduce((sum, t) => sum + t.valor, 0);
          const isDropTarget = dropTarget === col.id;

          return (
            <div
              key={col.id}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={() => setDropTarget(null)}
              onDrop={e => handleDrop(e, col.id)}
              onDragEnd={handleDragEnd}
              className={`flex flex-col flex-shrink-0 w-[300px] rounded-xl border transition-all duration-200 overflow-hidden ${
                isDropTarget ? `${col.bg} ${col.border}` : 'border-zinc-900/60 bg-zinc-900/20'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-3 pt-3 pb-2 sticky top-0 z-10 bg-[#08080a]">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${col.dotColor} shrink-0`} />
                  <span className={`${col.color} shrink-0`}>{col.icon}</span>
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
                    {col.shortLabel}
                  </span>
                  <span className="text-[10px] text-zinc-600 bg-zinc-900 border border-zinc-800 rounded-full px-1.5 py-0.5 font-mono leading-none">
                    {colTitles.length}
                  </span>
                </div>
                {colValue > 0 && (
                  <span className="text-[10px] font-semibold text-zinc-500 truncate ml-1">
                    {formatCurrencyDisplay(colValue)}
                  </span>
                )}
              </div>

              {/* Cards */}
              <div className={`kanban-column flex flex-col px-2 pb-2 flex-1 overflow-y-auto no-scrollbar ${isCompact ? 'gap-1' : 'gap-2'}`}>
                {colTitles.map(title => (
                  <TitleCard
                    key={title.id}
                    title={title}
                    column={col}
                    lotes={openLotes}
                    onClick={() => { setEditingTitle(title); setModalOpen(true); }}
                    onDragStart={handleDragStart}
                    isDragging={dragId === title.id}
                    onUpdateTitle={onSave}
                    isCompact={isCompact}
                  />
                ))}

                {/* Add Button */}
                <button
                  onClick={() => openNew(col.id)}
                  className="w-full mt-1 py-2 flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/40 rounded-lg transition-colors border border-dashed border-transparent hover:border-zinc-700/50"
                >
                  <Plus size={11} /> Adicionar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      <SiengeTitleModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTitle(null); }}
        onSave={handleSave}
        onDelete={handleDelete}
        initialData={editingTitle}
        initialStatus={modalInitialStatus}
        openLotes={openLotes}
        projects={projects}
      />
    </div>
  );
}
