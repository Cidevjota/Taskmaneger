import React, { useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Check } from 'lucide-react';

export const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface MonthSelectDropdownProps {
  year: number;
  month: number; // 0-11
  onChange: (year: number, month: number) => void;
}

export default function MonthSelectDropdown({ year, month, onChange }: MonthSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [panelYear, setPanelYear] = useState(year);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setPanelYear(year); setOpen(p => !p); }}
        className="flex items-center gap-2 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-300 transition-all shadow-sm"
      >
        <Calendar size={12} className="text-zinc-500" />
        {MONTHS_FULL[month]} {year}
        <ChevronDown size={12} className={`text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-52 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-xl shadow-black/50 z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between px-2 py-2 border-b border-zinc-800/60">
              <button
                type="button"
                onClick={() => setPanelYear(y => y - 1)}
                className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold text-zinc-200 tabular-nums">{panelYear}</span>
              <button
                type="button"
                onClick={() => setPanelYear(y => y + 1)}
                className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto py-1.5">
              {MONTHS_FULL.map((label, idx) => {
                const isSelected = idx === month && panelYear === year;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => { onChange(panelYear, idx); setOpen(false); }}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-left"
                  >
                    {label}
                    {isSelected && <Check size={14} className="text-blue-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
