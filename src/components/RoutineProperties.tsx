import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Repeat, ChevronDown, Check, X } from 'lucide-react';
import { RoutineConfig } from '../types';

interface RoutinePropertiesProps {
  routine?: RoutineConfig;
  onChange: (update: RoutineConfig | undefined) => void;
  align?: 'left' | 'right';
}

const WEEKDAYS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
];

export default function RoutineProperties({ routine, onChange, align = 'right' }: RoutinePropertiesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Local state for edits
  const [type, setType] = useState<'interval' | 'weekdays'>(routine?.type || 'interval');
  const [intervalValue, setIntervalValue] = useState<number>(routine?.intervalValue || 1);
  const [intervalUnit, setIntervalUnit] = useState<'days' | 'weeks' | 'months'>(routine?.intervalUnit || 'days');
  const [weekdays, setWeekdays] = useState<number[]>(routine?.weekdays || []);
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const unitDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutsideUnit = (event: MouseEvent) => {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(event.target as Node)) {
        setIsUnitDropdownOpen(false);
      }
    };

    if (isUnitDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutsideUnit);
    }
    return () => document.removeEventListener('mousedown', handleClickOutsideUnit);
  }, [isUnitDropdownOpen]);

  const handleSave = () => {
    onChange({
      active: true,
      type,
      intervalValue: type === 'interval' ? intervalValue : undefined,
      intervalUnit: type === 'interval' ? intervalUnit : undefined,
      weekdays: type === 'weekdays' ? weekdays : undefined,
      lastDuplicatedAt: new Date().toISOString(), // Inicia a contagem de agora
    });
    setIsOpen(false);
  };

  const toggleWeekday = (day: number) => {
    setWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const activeLabel = routine?.active ? (
    routine.type === 'interval' ? `A cada ${routine.intervalValue} ${routine.intervalUnit === 'days' ? 'dias' : routine.intervalUnit === 'weeks' ? 'semanas' : 'meses'}` :
    `Dias: ${WEEKDAYS.filter(d => (routine.weekdays || []).includes(d.value)).map(d => d.label.substring(0,3)).join(', ')}`
  ) : 'Adicionar Rotina';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full inline-flex items-center justify-between gap-1.5 text-[10px] font-sans font-medium px-2 py-1 rounded border min-h-[26px] transition-colors ${
          routine?.active 
            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20' 
            : 'text-zinc-300 bg-zinc-500/10 border-zinc-500/20 hover:bg-zinc-500/20'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Repeat size={13} className={routine?.active ? "animate-pulse" : ""} />
          <span>{activeLabel}</span>
        </div>
        <span className="text-[10px] opacity-60 ml-1">▼</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute top-full mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            <div className="p-3 border-b border-zinc-800 bg-zinc-900/50">
              <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                <Repeat size={14} className="text-purple-400" />
                Configurar Rotina
              </h3>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex gap-2 p-1 bg-zinc-800/50 rounded-lg">
                <button
                  onClick={() => setType('interval')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    type === 'interval' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  Intervalo
                </button>
                <button
                  onClick={() => setType('weekdays')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    type === 'weekdays' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  Dias da Semana
                </button>
              </div>

              {type === 'interval' ? (
                <div className="space-y-3">
                  <label className="text-xs text-zinc-500 block mb-1">Repetir a cada:</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={intervalValue}
                      onChange={(e) => setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-center text-white focus:outline-none focus:border-purple-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="relative flex-1" ref={unitDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                        className="w-full flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white hover:border-zinc-700 transition-colors focus:outline-none focus:border-purple-500"
                      >
                        <span>{intervalUnit === 'days' ? 'Dia(s)' : intervalUnit === 'weeks' ? 'Semana(s)' : 'Mês(es)'}</span>
                        <ChevronDown size={12} className="opacity-50" />
                      </button>
                      
                      <AnimatePresence>
                        {isUnitDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.1 }}
                            className="absolute top-full left-0 w-full mt-1 bg-[#121214] border border-zinc-800 rounded-md shadow-2xl py-1 z-50 overflow-hidden"
                          >
                            {[
                              { value: 'days', label: 'Dia(s)' },
                              { value: 'weeks', label: 'Semana(s)' },
                              { value: 'months', label: 'Mês(es)' }
                            ].map(option => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setIntervalUnit(option.value as any);
                                  setIsUnitDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-zinc-800 ${
                                  intervalUnit === option.value ? 'text-purple-400 bg-purple-500/10' : 'text-zinc-300'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500">Repetir toda:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {WEEKDAYS.map(day => (
                      <button
                        key={day.value}
                        onClick={() => toggleWeekday(day.value)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs transition-colors ${
                          weekdays.includes(day.value)
                            ? 'bg-purple-500/10 border-purple-500/50 text-purple-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-sm flex items-center justify-center border ${
                          weekdays.includes(day.value) ? 'bg-purple-500 border-purple-500' : 'border-zinc-600'
                        }`}>
                          {weekdays.includes(day.value) && <Check size={10} className="text-white" />}
                        </div>
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 bg-zinc-950/50 border-t border-zinc-800 flex justify-between items-center">
              {routine?.active ? (
                <button
                  onClick={() => {
                    onChange(undefined);
                    setIsOpen(false);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                >
                  <X size={14} />
                  Desativar
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={handleSave}
                disabled={type === 'weekdays' && weekdays.length === 0}
                className="px-4 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Salvar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
