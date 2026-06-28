import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  trigger?: React.ReactNode;
  enableTime?: boolean;
  onQuickAdd?: () => void;
  fullWidth?: boolean;
  suggestedDate?: string;
  align?: 'left' | 'right';
  disableAutoScroll?: boolean;
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function DatePicker({ value, onChange, trigger, enableTime, onQuickAdd, fullWidth, suggestedDate, align = 'left', disableAutoScroll }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Parse initial date or default to today
  const initialDate = value ? new Date(value.split('T')[0] + 'T00:00:00') : new Date();
  const [viewDate, setViewDate] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));

  let currentDatePart = '';
  let currentTimePart = '09:00';
  if (value) {
    if (value.includes('T')) {
       const parts = value.split('T');
       currentDatePart = parts[0];
       currentTimePart = parts[1];
    } else {
       currentDatePart = value;
    }
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to ensure popover visibility with comfortable space
  useEffect(() => {
    if (isOpen && popoverRef.current && !disableAutoScroll) {
      setTimeout(() => {
        popoverRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }, 50);
    }
  }, [isOpen, disableAutoScroll]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update view when opening
  const handleOpen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!value && onQuickAdd) {
      onQuickAdd();
      return;
    }
    const d = value 
      ? new Date(value.split('T')[0] + 'T00:00:00') 
      : (suggestedDate ? new Date(suggestedDate.split('T')[0] + 'T00:00:00') : new Date());
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    setIsOpen(!isOpen);
  };

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  // Days from previous month to fill the first row
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
  
  const prevMonthDays = Array.from({ length: firstDayIndex }, (_, i) => {
    return { day: daysInPrevMonth - firstDayIndex + i + 1, isCurrentMonth: false, monthOffset: -1 };
  });

  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => {
    return { day: i + 1, isCurrentMonth: true, monthOffset: 0 };
  });

  // Calculate remaining days to fill a 6-row grid (42 cells)
  const remainingCells = 42 - (prevMonthDays.length + currentMonthDays.length);
  const nextMonthDays = Array.from({ length: remainingCells }, (_, i) => {
    return { day: i + 1, isCurrentMonth: false, monthOffset: 1 };
  });

  const allDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

  const handlePrevMonth = (e: React.MouseEvent) => { e.stopPropagation(); setViewDate(new Date(currentYear, currentMonth - 1, 1)); };
  const handleNextMonth = (e: React.MouseEvent) => { e.stopPropagation(); setViewDate(new Date(currentYear, currentMonth + 1, 1)); };

  const handleSelectDay = (day: number, monthOffset: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const selectedDate = new Date(currentYear, currentMonth + monthOffset, day);
    const formatted = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    if (enableTime) {
      onChange(`${formatted}T${currentTimePart}`);
      setIsOpen(false);
    } else {
      onChange(formatted);
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  const handleToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    const formatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (enableTime) {
      onChange(`${formatted}T${currentTimePart}`);
      setIsOpen(false);
    } else {
      onChange(formatted);
      setIsOpen(false);
    }
  };

  // Format display value
  let displayValue = '';
  if (currentDatePart) {
    const [y, m, d] = currentDatePart.split('-');
    if (y && m && d) {
       displayValue = `${d}/${m}/${y}`;
    }
  }

  return (
    <div className={`relative ${trigger && !fullWidth ? 'inline-block' : 'w-full'}`} ref={containerRef}>
      {/* Trigger */}
      {trigger ? (
        <div onClick={handleOpen} className={`cursor-pointer ${fullWidth ? 'w-full' : 'inline-flex'}`}>
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="w-full flex items-center justify-between gap-1.5 text-[10px] font-sans font-medium px-2 py-1 rounded border text-zinc-300 bg-zinc-500/10 border-zinc-500/20 hover:bg-zinc-500/20 transition-colors cursor-pointer min-h-[26px]"
        >
          <span>{displayValue || 'Sem prazo'}</span>
          <span className="text-[9px] opacity-60 ml-1">▼</span>
        </button>
      )}

      {/* Popover */}
      {isOpen && (
        <div ref={popoverRef} className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 w-[230px] bg-[#121214] border border-zinc-800/80 rounded-[8px] shadow-2xl p-3 z-50 animate-fade-in`}>
          
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button 
              type="button" 
              onClick={handlePrevMonth}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-semibold text-zinc-200 font-sans tracking-wide">
              {MONTHS[currentMonth]} {currentYear}
            </span>
            <button 
              type="button" 
              onClick={handleNextMonth}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((wd, i) => (
              <div key={i} className="text-center text-[10px] font-medium text-zinc-500 opacity-70">
                {wd}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-y-1 gap-x-1 mb-3">
            {allDays.map((slot, i) => {
              const targetDate = new Date(currentYear, currentMonth + slot.monthOffset, slot.day);
              const formattedDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
              const isSelected = formattedDate === currentDatePart;
              const isToday = new Date().toDateString() === targetDate.toDateString();
              const isSuggested = suggestedDate && formattedDate === suggestedDate.split('T')[0] && !isSelected;

              return (
                <button
                  key={i}
                  type="button"
                  title={isSuggested ? 'Data sugerida' : undefined}
                  onClick={(e) => handleSelectDay(slot.day, slot.monthOffset, e)}
                  className={`
                    w-6 h-6 flex items-center justify-center text-[10px] rounded-full transition-all mx-auto
                    ${!slot.isCurrentMonth ? 'opacity-35 text-zinc-400' : 'text-zinc-300'}
                    ${isSelected ? 'bg-blue-600 text-white font-bold shadow-md' : 
                      isSuggested ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30' : 'hover:bg-zinc-800/80'}
                    ${isToday && !isSelected && !isSuggested ? 'ring-1 ring-blue-500/50 text-blue-400' : ''}
                  `}
                >
                  {slot.day}
                </button>
              );
            })}
          </div>

          {/* Time Picker */}
          {enableTime && (
            <div className="mb-3 pt-2 border-t border-zinc-800/50 flex items-center justify-between">
              <span className="text-[10px] text-zinc-400 font-medium">Horário:</span>
              <input
                type="time"
                value={currentTimePart}
                onChange={(e) => {
                  e.stopPropagation();
                  const datePartToUse = currentDatePart || (() => {
                    const d = new Date();
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  })();
                  const newTime = e.target.value || '09:00';
                  onChange(`${datePartToUse}T${newTime}`);
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-1.5 py-1 outline-none focus:border-blue-500 font-medium cursor-pointer [color-scheme:dark]"
              />
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
            <button 
              type="button"
              onClick={handleClear}
              className="text-[10px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800/50"
            >
              Limpar
            </button>
            <button 
              type="button"
              onClick={handleToday}
              className="text-[10px] font-medium text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded hover:bg-blue-500/10"
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
