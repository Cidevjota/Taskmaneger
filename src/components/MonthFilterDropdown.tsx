import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { MONTHS_FULL } from './MonthSelectDropdown';

export type MonthFilterValue = { year: number; month: number } | null;

interface MonthFilterDropdownProps {
  value: MonthFilterValue;
  onChange: (val: MonthFilterValue) => void;
  allLabel?: string;
}

export default function MonthFilterDropdown({ value, onChange, allLabel = 'Todos os Meses' }: MonthFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [panelYear, setPanelYear] = useState(value?.year ?? new Date().getFullYear());

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => { setPanelYear(value?.year ?? new Date().getFullYear()); setIsOpen(!isOpen); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-normal bg-[#1A1A1C] text-[#A0A0A5] hover:bg-[#1F1F22] hover:text-[#EDEDED] transition-colors min-w-[140px]"
      >
        <Calendar size={12} className="text-[#6B6B70] shrink-0" />
        <span className="truncate flex-1 text-left">{value ? `${MONTHS_FULL[value.month]} ${value.year}` : allLabel}</span>
        <ChevronDown size={12} className={`text-[#6B6B70] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-[220px] bg-[#111113] rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-50 animate-fade-in origin-top-right flex flex-col overflow-hidden">
          <button
            onClick={() => { onChange(null); setIsOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${!value ? 'text-blue-400' : 'text-[#A0A0A5] hover:bg-[#1A1A1C] hover:text-[#EDEDED]'}`}
          >
            <span>{allLabel}</span>
            {!value && <Check size={14} />}
          </button>
          <div className="h-px bg-[#1F1F22] my-1 mx-2" />
          <div className="flex items-center justify-between px-2 py-1.5">
            <button type="button" onClick={() => setPanelYear(y => y - 1)} className="p-1 text-[#6B6B70] hover:text-[#EDEDED] hover:bg-[#1A1A1C] rounded-md transition-colors">
              <ChevronDown size={12} className="rotate-90" />
            </button>
            <span className="text-xs font-normal text-[#EDEDED] tabular-nums">{panelYear}</span>
            <button type="button" onClick={() => setPanelYear(y => y + 1)} className="p-1 text-[#6B6B70] hover:text-[#EDEDED] hover:bg-[#1A1A1C] rounded-md transition-colors">
              <ChevronDown size={12} className="-rotate-90" />
            </button>
          </div>
          <div className="max-h-[220px] overflow-y-auto no-scrollbar">
            {MONTHS_FULL.map((label, idx) => {
              const isSelected = value?.year === panelYear && value?.month === idx;
              return (
                <button
                  key={label}
                  onClick={() => { onChange({ year: panelYear, month: idx }); setIsOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${isSelected ? 'text-blue-400' : 'text-[#A0A0A5] hover:bg-[#1A1A1C] hover:text-[#EDEDED]'}`}
                >
                  <span>{label}</span>
                  {isSelected && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
