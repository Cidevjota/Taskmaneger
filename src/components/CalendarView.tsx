import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Inbox, Plus, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Task, Project } from '../types';

interface CalendarViewProps {
  tasks: Task[];
  projects: Project[];
  onSelectTask: (task: Task) => void;
  onAddTask: (task: Task) => void;
  currentProjectFilter: string | null;
}

export default function CalendarView({
  tasks,
  projects,
  onSelectTask,
  onAddTask,
  currentProjectFilter
}: CalendarViewProps) {
  // June 2026 constants (June 1st, 2026 starts on a Monday)
  const daysInMonth = 30;
  const startDayOffset = 1; // 0 = Sunday, 1 = Monday, etc.
  const currentDay = 16; // Current simulated date is June 16, 2026

  const daysHeader = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Filter tasks based on projects
  const filteredTasks = tasks.filter(t => {
    if (currentProjectFilter && t.projectId !== currentProjectFilter) return false;
    return !!t.dueDate;
  });

  // Helper to build range of days
  const gridCells: { type: 'empty' | 'day'; dayNum?: number; dateStr?: string }[] = [];
  
  // Fill initial empty offset days
  for (let i = 0; i < startDayOffset; i++) {
    gridCells.push({ type: 'empty' });
  }

  // Fill actual month days
  for (let i = 1; i <= daysInMonth; i++) {
    const formattedDay = i < 10 ? `0${i}` : `${i}`;
    gridCells.push({
      type: 'day',
      dayNum: i,
      dateStr: `2026-06-${formattedDay}`
    });
  }

  // Fill trailing empty days to make perfect rectangular rows of 7
  const totalCells = Math.ceil(gridCells.length / 7) * 7;
  for (let i = gridCells.length; i < totalCells; i++) {
    gridCells.push({ type: 'empty' });
  }

  // Quick task addition on double-click or plus-click
  const handleDayClick = (dateStr: string) => {
    const title = prompt('Novo evento no Calendário:');
    if (!title || !title.trim()) return;

    const newTask: Task = {
      id: `TSK-${100 + tasks.length + 1}`,
      title: title.trim(),
      description: 'Criado via Calendário interativo.',
      status: 'todo',
      priority: 'medium',
      projectId: currentProjectFilter || (projects[0]?.id || 'p1'),
      labels: [],
      subtasks: [],
      dueDate: dateStr,
      createdAt: new Date().toISOString().split('T')[0],
    };
    onAddTask(newTask);
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto select-none space-y-4 bg-[#08080a]">
      {/* Calendar Header */}
      <div className="flex items-center justify-between bg-zinc-950/50 p-4 rounded-lg border border-zinc-900 shrink-0">
        <div className="flex items-center gap-2">
          <CalendarIcon size={14} className="text-zinc-400" />
          <h2 className="text-xs font-semibold text-zinc-350 uppercase tracking-widest font-mono">Junho 2026</h2>
          <span className="text-[9px] bg-zinc-900 text-zinc-500 border border-zinc-800 py-0.5 px-2 rounded-full font-mono font-medium">Simulado</span>
        </div>

        <div className="flex items-center gap-1">
          <button className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all font-medium">Hoje</button>
          <button className="p-1 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 hover:text-white transition-all"><ChevronLeft size={12} /></button>
          <button className="p-1 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 hover:text-white transition-all"><ChevronRight size={12} /></button>
        </div>
      </div>

      {/* Calendar Main Grid container */}
      <div className="flex-1 border border-zinc-900 rounded-lg overflow-hidden bg-[#121214]/30 flex flex-col min-h-[460px]">
        {/* Days of the week header */}
        <div className="grid grid-cols-7 h-10 border-b border-zinc-900 text-center items-center font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950 select-none">
          {daysHeader.map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Days grid cells */}
        <div className="grid grid-cols-7 flex-1 divide-x divide-y divide-zinc-900/60 bg-transparent">
          {gridCells.map((cell, idx) => {
            if (cell.type === 'empty') {
              return (
                <div key={`empty-${idx}`} className="bg-transparent" />
              );
            }

            const dayNum = cell.dayNum!;
            const dateStr = cell.dateStr!;
            const isToday = dayNum === currentDay;

            // Get tasks scheduled on this day
            const dayTasks = filteredTasks.filter(t => t.dueDate === dateStr);

            return (
              <div 
                key={`day-${dayNum}`} 
                className={`p-1.5 min-h-[85px] hover:bg-zinc-900/40 flex flex-col transition-colors group relative ${
                  isToday ? 'bg-zinc-900/10' : ''
                }`}
              >
                {/* Cell title header */}
                <div className="flex items-center justify-between mb-1 shrink-0">
                  <span className={`text-[10px] font-mono font-bold px-1 py-0.5 rounded ${
                    isToday 
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60' 
                      : 'text-zinc-500 group-hover:text-zinc-300'
                  }`}>
                    {dayNum}
                  </span>

                  {/* Icon add trigger on cell hover */}
                  <button 
                    onClick={() => handleDayClick(dateStr)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all absolute right-1.5 top-1.5 shrink-0"
                    title="Adicionar evento"
                  >
                    <Plus size={9} />
                  </button>
                </div>

                {/* Day Tasks pills inside cell */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
                  {dayTasks.map(task => {
                    const project = projects.find(p => p.id === task.projectId);
                    return (
                      <button
                        key={task.id}
                        onClick={() => onSelectTask(task)}
                        className={`w-full text-left p-1 text-[9px] rounded truncate font-sans font-medium transition-all border block ${
                          task.status === 'done'
                            ? 'bg-zinc-950/40 text-zinc-500 border-zinc-900 line-through'
                            : 'bg-zinc-900/60 text-zinc-300 border-zinc-850 hover:border-zinc-700'
                        }`}
                        title={`[${task.id}] ${task.title}`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`w-1 h-1 rounded-full shrink-0 bg-current ${project?.color || 'text-zinc-400'}`} />
                          <span className="truncate">{task.title}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
