import React, { useState, useRef, useEffect } from 'react';
import { Inbox, HelpCircle, Clock, AlertTriangle, ArrowDown, Layers, CheckCircle2 } from 'lucide-react';
import { TaskStatus } from '../types';

interface StatusPickerProps {
  value: TaskStatus;
  onChange: (status: TaskStatus) => void;
  trigger?: React.ReactNode;
}

const statuses: { value: TaskStatus; label: string; color: string; dotColor: string; icon: React.ReactNode }[] = [
  { value: 'no_forecast', label: 'Sem previsão', color: 'bg-slate-700/50 text-slate-300', dotColor: 'bg-slate-500', icon: <Inbox size={12} className="shrink-0" /> },
  { value: 'todo', label: 'A fazer', color: 'bg-blue-900/40 text-blue-300 border border-blue-500/20', dotColor: 'bg-blue-500', icon: <HelpCircle size={12} className="shrink-0" /> },
  { value: 'in_progress', label: 'Em progresso', color: 'bg-amber-900/40 text-amber-300 border border-amber-500/20', dotColor: 'bg-amber-500', icon: <Clock size={12} className="shrink-0" /> },
  { value: 'paused', label: 'Pausado', color: 'bg-red-900/40 text-red-300 border border-red-500/20', dotColor: 'bg-red-400', icon: <AlertTriangle size={12} className="shrink-0" /> },
  { value: 'approval', label: 'Aprovação', color: 'bg-purple-900/40 text-purple-300 border border-purple-500/20', dotColor: 'bg-purple-500', icon: <HelpCircle size={12} className="shrink-0" /> },
  { value: 'rework', label: 'Refação', color: 'bg-orange-900/40 text-orange-300 border border-orange-500/20', dotColor: 'bg-orange-500', icon: <ArrowDown size={12} className="shrink-0" /> },
  { value: 'implementation', label: 'Implementação', color: 'bg-blue-900/40 text-blue-300 border border-blue-500/20', dotColor: 'bg-blue-500', icon: <Layers size={12} className="shrink-0" /> },
  { value: 'done', label: 'Concluído', color: 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/20', dotColor: 'bg-emerald-500', icon: <CheckCircle2 size={12} className="shrink-0" /> },
];

export default function StatusPicker({ value, onChange, trigger }: StatusPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = useState<'top' | 'bottom'>('bottom');

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      if (spaceBelow < 280 && spaceAbove > spaceBelow) {
        setPopoverPosition('top');
      } else {
        setPopoverPosition('bottom');
      }
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSelect = (e: React.MouseEvent, val: TaskStatus) => {
    e.stopPropagation();
    onChange(val);
    setIsOpen(false);
  };

  const currentStatus = statuses.find(s => s.value === value) || statuses[0];

  return (
    <div className={`relative ${trigger ? 'inline-block' : 'w-full'}`} ref={containerRef}>
      {trigger ? (
        <div onClick={handleOpen} className="cursor-pointer inline-flex w-full">
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center justify-between gap-1.5 text-[10px] font-sans font-medium px-2 py-1 rounded border text-zinc-300 bg-zinc-500/10 border-zinc-500/20 hover:bg-zinc-500/20 min-h-[26px] transition-colors w-full"
        >
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.dotColor}`} />
            <span>{currentStatus.label}</span>
          </div>
          <span className="text-[9px] opacity-60 ml-1 text-zinc-500">▼</span>
        </button>
      )}

      {isOpen && (
        <div className={`absolute left-0 ${popoverPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} w-44 bg-[#18181b] border border-zinc-800 rounded-md shadow-xl z-50 overflow-hidden animate-fade-in flex flex-col p-1 max-h-64 overflow-y-auto`}>
          <div className="px-2 py-1.5 mb-1 border-b border-zinc-800/80 shrink-0 sticky top-0 bg-[#18181b] z-10">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase">Status da Tarefa</span>
          </div>

          {statuses.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={(e) => handleSelect(e, s.value)}
              className={`flex items-center gap-2 px-2 py-2 text-xs font-medium rounded-md transition-colors ${
                value === s.value 
                  ? 'bg-zinc-800 text-zinc-200' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${s.dotColor}`} />
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
