import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle2, ChevronsUp, ChevronUp, Minus, ChevronDown, AlertTriangle, AlertCircle } from 'lucide-react';
import { Task } from '../types';

interface WeeklyPlannerProps {
  tasks: Task[];
  onUpdateTask: (updates: Partial<Task> & { id: string }) => void;
  onSelectTask: (task: Task) => void;
}

// Helpers for Date
const getRealToday = () => new Date();

const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

const formatISO = (date: Date) => date.toISOString().split('T')[0];

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const WEEK_DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

export default function WeeklyPlanner({ tasks, onUpdateTask, onSelectTask }: WeeklyPlannerProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const getWeekStartForOffset = () => {
    const d = getRealToday();
    d.setDate(d.getDate() + weekOffset * 7);
    return getMonday(d);
  };

  const weekStart = getWeekStartForOffset();
  const weekDates = Array.from({ length: 5 }).map((_, i) => addDays(weekStart, i));
  const todayISO = formatISO(getRealToday());

  // Columns definition: 7 days
  const columns = weekDates.map((date, i) => ({
    id: formatISO(date),
    title: WEEK_DAYS[i],
    date: date
  }));

  const getColTasks = (colId: string) => {
    return tasks.filter(t => t.plannedDate === colId);
  };

  // DND State
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggingCardId(taskId);
  };

  const handleDragEnd = () => {
    setDraggingCardId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverColumn(colId);
  };

  const handleDragLeave = (e: React.DragEvent, colId: string) => {
    const rel = e.relatedTarget as HTMLElement | null;
    if (rel && (e.currentTarget as HTMLElement).contains(rel)) return;
    setDragOverColumn(prev => prev === colId ? null : prev);
  };

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    setDraggingCardId(null);
    setDragOverColumn(null);

    const targetDate = colId;
    
    // Update task
    const task = tasks.find(t => t.id === taskId);
    if (task && task.plannedDate !== targetDate) {
      onUpdateTask({ id: taskId, plannedDate: targetDate }); 
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent w-full">
      {/* Header controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-zinc-400" /> 
          <h2 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">AGENDAMENTO SEMANAL</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="p-1.5 rounded bg-[#121214] border border-zinc-900 hover:bg-zinc-800 transition-colors"
          >
            <ChevronLeft size={16} className="text-zinc-400" />
          </button>
          <button 
            onClick={() => setWeekOffset(0)}
            className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${weekOffset === 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-[#121214] border border-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
          >
            Atual
          </button>
          <button 
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="p-1.5 rounded bg-[#121214] border border-zinc-900 hover:bg-zinc-800 transition-colors"
          >
            <ChevronRight size={16} className="text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 flex overflow-x-auto min-h-0 gap-5 custom-scrollbar pb-4 -mx-2 px-2 animate-fade-in">
        {columns.map(column => {
          const colTasks = getColTasks(column.id);
          const isTarget = dragOverColumn === column.id;
          const isToday = column.id === todayISO;

          return (
            <div 
              key={column.id}
              data-col={column.id}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={(e) => handleDragLeave(e, column.id)}
              onDrop={(e) => handleDrop(e, column.id)}
              className={`flex-1 flex flex-col min-w-[280px] max-w-[400px] rounded-xl border transition-all duration-200 bg-zinc-950/40 ${
                isTarget ? 'border-zinc-700 bg-zinc-900/40' : 
                isToday ? 'border-blue-500/30 bg-blue-950/5' : 
                'border-zinc-900/80'
              }`}
            >
              {/* Column Header */}
              <div className={`px-3 py-2.5 border-b flex items-center justify-between sticky top-0 z-10 rounded-t-xl bg-[#0a0a0c] ${isToday ? 'border-blue-500/30' : 'border-zinc-900/80'}`}>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold uppercase tracking-[0.1em] ${isToday ? 'text-blue-400' : 'text-zinc-300'}`}>
                      {column.title.substring(0, 3)}
                    </span>
                    {column.date && (
                      <span className="text-[10px] text-zinc-500 font-medium">{column.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                    )}
                    {isToday && (
                      <span className="text-[8px] font-bold bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded ml-1">HOJE</span>
                    )}
                  </div>
                </div>
                <div className={`px-1.5 py-0.5 bg-[#121214] rounded text-[10px] font-mono font-semibold border ${isToday ? 'text-blue-400 border-blue-500/30' : 'text-zinc-400 border-zinc-900'}`}>
                  {colTasks.length}
                </div>
              </div>

              {/* Tasks List */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
                {colTasks.map((task) => {
                  const isDragging = draggingCardId === task.id;
                  
                  let alertType = null;
                  let alertBgClass = '';
                  let AlertIcon = null;
                  
                  const dueStr = task.dueDate ? task.dueDate.split('T')[0] : null;
                  
                  if (task.status === 'done' || task.status === 'implementation') {
                    alertType = 'completo';
                    alertBgClass = 'bg-[#1a7a4c]'; // Dark green
                    AlertIcon = CheckCircle2;
                  } else if (dueStr && dueStr < todayISO) {
                    alertType = 'alerta';
                    alertBgClass = 'bg-[#7b1919]'; // Dark red
                    AlertIcon = AlertTriangle;
                  } else if (todayISO > column.id) {
                    alertType = 'atencao';
                    alertBgClass = 'bg-[#9a7b1b]'; // Dark gold/amber
                    AlertIcon = AlertCircle;
                  }
                  
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onSelectTask(task)}
                      className={`group flex items-stretch ${alertBgClass || 'bg-[#121214]'} rounded-lg transition-all duration-300 cursor-grab active:cursor-grabbing shadow-sm overflow-hidden border ${alertBgClass ? 'border-transparent' : 'border-zinc-900/60'} ${isDragging ? 'opacity-30' : ''}`}
                    >
                      {alertType && AlertIcon && (
                        <div className="w-10 shrink-0 flex items-center justify-center transition-all duration-500 animate-slide-in-right">
                          <AlertIcon size={16} className="text-white" />
                        </div>
                      )}

                      <div className={`flex-1 flex items-center justify-between gap-2 p-2.5 bg-[#121214] hover:bg-[#161619] transition-colors ${alertType ? 'rounded-l-lg border-l border-zinc-900/80' : ''}`}>
                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                          <div className="shrink-0 flex items-center justify-center">
                            {task.priority === 'urgent' && <ChevronsUp size={14} className="text-red-500" />}
                            {task.priority === 'high' && <ChevronUp size={14} className="text-orange-400" />}
                            {task.priority === 'medium' && <Minus size={14} className="text-blue-500" />}
                            {task.priority === 'low' && <ChevronDown size={14} className="text-emerald-500" />}
                          </div>
                          <span className={`text-[11px] font-medium truncate ${task.status === 'done' ? 'text-zinc-500 line-through' : 'text-zinc-200 group-hover:text-white transition-colors'}`}>
                            {task.title}
                          </span>
                        </div>
                        
                        {task.dueDate && (
                          <span className={`text-[9px] font-mono font-medium shrink-0 ml-1 ${
                            task.status !== 'done' && task.dueDate < new Date().toISOString() 
                              ? 'text-red-400' 
                              : 'text-zinc-500 group-hover:text-zinc-400'
                          }`}>
                            {task.dueDate.split('-').reverse().slice(0,2).join('/')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {colTasks.length === 0 && (
                  <div className="h-full min-h-[60px] flex items-center justify-center border-2 border-dashed border-zinc-900/40 rounded-lg m-1 bg-zinc-950/20">
                    <span className="text-[10px] text-zinc-600 font-medium">Solte tarefas aqui</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
