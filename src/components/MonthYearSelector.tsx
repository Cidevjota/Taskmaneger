import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthYearSelectorProps {
  year: number;
  month: number; // 0-11
  onChange: (year: number, month: number) => void;
}

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function MonthYearSelector({ year, month, onChange }: MonthYearSelectorProps) {
  return (
    <div className="flex flex-col gap-2.5 bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-3">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onChange(year - 1, month)}
          className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-bold text-zinc-200 tabular-nums w-12 text-center">{year}</span>
        <button
          type="button"
          onClick={() => onChange(year + 1, month)}
          className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
        {MONTHS_SHORT.map((label, idx) => {
          const isSelected = idx === month;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onChange(year, idx)}
              className={`px-2 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
                isSelected
                  ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
