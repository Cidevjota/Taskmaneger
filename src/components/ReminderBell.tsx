import React, { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import DatePicker from './DatePicker';

export type ReminderType = '3h' | '1d' | 'custom' | 'seen';

interface ReminderBellProps {
  reminderDate?: string;
  reminderType?: ReminderType;
  onChange: (update: { reminderDate?: string; reminderType?: ReminderType }) => void;
  size?: number;
  showLabel?: boolean;
  align?: 'left' | 'right';
  disableAutoScroll?: boolean;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toISOLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addHours(h: number): string {
  const t = new Date();
  t.setHours(t.getHours() + h);
  return toISOLocal(t);
}

function tomorrowAt8(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T08:00`;
}

export default function ReminderBell({
  reminderDate,
  reminderType,
  onChange,
  size = 13,
  showLabel = false,
  align = 'right',
  disableAutoScroll,
}: ReminderBellProps) {
  const [forceOpenKey, setForceOpenKey] = useState(0);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();

    if (!reminderType || reminderType === 'seen') {
      // Sem lembrete ou já visto → cria +3h
      onChange({ reminderDate: addHours(3), reminderType: '3h' });
    } else if (reminderType === '3h') {
      // +3h → amanhã às 8h
      onChange({ reminderDate: tomorrowAt8(), reminderType: '1d' });
    } else {
      // +1d ou custom → abre calendário personalizado
      setForceOpenKey(k => k + 1);
    }
  }

  const isSeen = reminderType === 'seen';

  const bellColor =
    isSeen
      ? 'text-emerald-400'
      : reminderType === '3h'
      ? 'text-blue-400'
      : reminderType === '1d'
      ? 'text-yellow-400'
      : reminderType === 'custom'
      ? 'text-orange-400'
      : 'text-zinc-600 hover:text-zinc-400';

  const labelText =
    isSeen
      ? '✓'
      : reminderType === '3h'
      ? '+3h'
      : reminderType === '1d'
      ? '+1d'
      : reminderType === 'custom' && reminderDate
      ? (() => {
          const [, m, d] = reminderDate.split('T')[0].split('-');
          return `${d}/${m}`;
        })()
      : null;

  const labelColor =
    isSeen
      ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
      : reminderType === '3h'
      ? 'text-blue-400 bg-blue-400/10 border-blue-400/20'
      : reminderType === '1d'
      ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
      : 'text-orange-400 bg-orange-400/10 border-orange-400/20';

  const title =
    isSeen
      ? 'Lembrete visto — clique para criar novo (+3h)'
      : !reminderType
      ? 'Adicionar lembrete (+3h)'
      : reminderType === '3h'
      ? 'Lembrete em 3h — clique para amanhã 8h'
      : reminderType === '1d'
      ? 'Lembrete amanhã 8h — clique para personalizar'
      : 'Lembrete personalizado — clique para personalizar';

  return (
    <div className="inline-flex items-center gap-1">
      {showLabel && labelText && (
        <span
          className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded border cursor-pointer ${labelColor}`}
          onClick={handleClick}
        >
          {labelText}
        </span>
      )}
      <DatePicker
        value={reminderDate || ''}
        align={align}
        disableAutoScroll={disableAutoScroll}
        enableTime={true}
        forceOpen={forceOpenKey}
        onChange={(date) => {
          if (date) {
            onChange({ reminderDate: date, reminderType: 'custom' });
          } else {
            onChange({ reminderDate: undefined, reminderType: undefined });
          }
        }}
        trigger={
          <button
            type="button"
            className={`flex items-center justify-center transition-colors ${bellColor}`}
            title={title}
            onClick={handleClick}
          >
            {isSeen
              ? <BellOff size={size} className="fill-current" />
              : <Bell size={size} className={reminderType ? 'fill-current' : ''} />
            }
          </button>
        }
      />
    </div>
  );
}
