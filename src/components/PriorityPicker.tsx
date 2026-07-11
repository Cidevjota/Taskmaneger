import React, { useState, useRef, useEffect } from 'react';
import { ArrowDown, ArrowUp, AlertTriangle } from 'lucide-react';
import { TaskPriority } from '../types';

interface PriorityPickerProps {
  value: TaskPriority;
  onChange: (priority: TaskPriority) => void;
  trigger?: React.ReactNode;
}

const priorities: { value: TaskPriority; label: string; badgeStyle: string; icon: React.ReactNode }[] = [
  { value: 'no_priority', label: 'Sem Prioridade', badgeStyle: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/15 hover:bg-zinc-500/20', icon: null },
  { value: 'low', label: 'Baixa', badgeStyle: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15 hover:bg-emerald-500/20', icon: <ArrowDown size={10} className="shrink-0" /> },
  { value: 'medium', label: 'Média', badgeStyle: 'text-blue-400 bg-blue-500/10 border-blue-500/15 hover:bg-blue-500/20', icon: null },
  { value: 'high', label: 'Alta', badgeStyle: 'text-orange-400 bg-orange-500/10 border-orange-500/15 hover:bg-orange-500/20', icon: <ArrowUp size={10} className="shrink-0" /> },
  { value: 'urgent', label: 'Urgente', badgeStyle: 'text-red-400 bg-red-500/10 border-red-500/15 hover:bg-red-500/20', icon: <AlertTriangle size={10} className="shrink-0" /> },
];

export default function PriorityPicker({ value, onChange, trigger }: PriorityPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && popoverRef.current) {
      setTimeout(() => {
        popoverRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }, 50);
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

  const handleSelect = (e: React.MouseEvent, val: TaskPriority) => {
    e.stopPropagation();
    onChange(val);
    setIsOpen(false);
  };

  const currentPrio = priorities.find(p => p.value === value) || priorities[0];

  return (
    <div className={`relative ${trigger ? 'inline-flex items-center' : 'w-full'}`} ref={containerRef}>
      {trigger ? (
        <div onClick={handleOpen} className="cursor-pointer flex items-center">
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className={`inline-flex items-center justify-between gap-1.5 text-[10px] font-sans font-medium px-2 py-1 rounded border min-h-[26px] transition-colors ${currentPrio.badgeStyle} w-full`}
        >
          <div className="flex items-center gap-1.5">
            {currentPrio.icon}
            <span>{currentPrio.label}</span>
          </div>
          <span className="text-[9px] opacity-60 ml-1">▼</span>
        </button>
      )}

      {isOpen && (
        <div ref={popoverRef} className="absolute left-0 top-full mt-1 w-44 bg-[#18181b] border border-zinc-800 rounded-md shadow-xl z-50 overflow-hidden animate-fade-in flex flex-col p-1">
          <div className="px-2 py-1.5 mb-1 border-b border-zinc-800/80">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase">Prioridade</span>
          </div>
          {priorities.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={(e) => handleSelect(e, p.value)}
              className={`flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                value === p.value 
                  ? 'bg-zinc-800 text-zinc-200' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded border ${p.badgeStyle.split(' hover:')[0]}`}>
                 {p.icon}
                 <span className="text-[9px] uppercase tracking-wider">{p.label}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
