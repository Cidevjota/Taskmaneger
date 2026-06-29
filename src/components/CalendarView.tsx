import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Inbox, Plus, Calendar as CalendarIcon, Clock, PenTool, Type, CheckSquare, DollarSign, Share2, Tag as TagIcon, AlertTriangle, ArrowUp, ArrowDown, Bell, ChevronsUp, ChevronUp, Minus, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { Task, Project, Label, TaskPriority, TaskStatus } from '../types';
import DatePicker from './DatePicker';
import { useAuth } from '../context/AuthContext';
import { getHolidays } from '../utils/holidays';

interface CalendarViewProps {
  tasks: Task[];
  projects: Project[];
  labels: Label[];
  onSelectTask: (task: Task) => void;
  onAddTask: (task: Task) => void;
  onUpdateTask: (task: Task) => void;
  currentProjectFilter: string | null;
  socialMediaFilter?: boolean;
  setSocialMediaFilter?: (val: boolean) => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function CalendarView({
  tasks,
  projects,
  labels,
  onSelectTask,
  onAddTask,
  onUpdateTask,
  currentProjectFilter,
  socialMediaFilter,
  setSocialMediaFilter
}: CalendarViewProps) {
  // State for the displayed month/year
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const holidays = React.useMemo(() => getHolidays(year), [year]);

  // Navigation functions
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Calendar calculations
  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOffset = firstDayOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const todayDateObj = new Date();
  const isCurrentMonth = todayDateObj.getMonth() === month && todayDateObj.getFullYear() === year;
  const currentDayNum = todayDateObj.getDate();

  const daysHeader = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Filter and Sort states
  const { allUsers: USERS, currentUser } = useAuth();
  const sortedUsers = currentUser
    ? [currentUser, ...USERS.filter(u => u.id !== currentUser.id)]
    : USERS;
  
  const [isPlanningMode, setIsPlanningMode] = useState(false);
  const [filterAssigneeId, setFilterAssigneeId] = useState<string | 'all'>(currentUser?.id || 'all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [sortPriority, setSortPriority] = useState<'none' | 'asc' | 'desc'>('none');
  const hasInitialized = useRef(!!currentUser);

  // Filter tasks
  let filteredTasks = tasks.filter(t => {
    if (currentProjectFilter && t.projectId !== currentProjectFilter) return false;
    if (filterAssigneeId !== 'all' && t.assigneeId !== filterAssigneeId) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return !!t.dueDate || !!t.plannedDate;
  });

  const unplannedTasks = tasks.filter(t => {
    if (currentProjectFilter && t.projectId !== currentProjectFilter) return false;
    if (filterAssigneeId !== 'all' && t.assigneeId !== filterAssigneeId) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    
    // Check if task is unplanned and its dueDate matches the currently viewed calendar month
    // OR if it's within the first 15 days of the next month.
    if (t.plannedDate) return false;
    if (!t.dueDate) return false;
    
    const [tYear, tMonth, tDay] = t.dueDate.split('-').map(Number);
    const isCurrentMonth = (tYear === year && tMonth === month + 1);
    
    let nextMonth = month + 2;
    let nextYear = year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }
    const isNextMonthFirstHalf = (tYear === nextYear && tMonth === nextMonth && tDay <= 15);
    
    if (!isCurrentMonth && !isNextMonthFirstHalf) return false;

    return true;
  });

  // Sort tasks by priority
  if (sortPriority !== 'none') {
    const priorityWeight: Record<TaskPriority, number> = {
      urgent: 4, high: 3, medium: 2, low: 1, no_priority: 0
    };
    filteredTasks = [...filteredTasks].sort((a, b) => {
      const pA = priorityWeight[a.priority];
      const pB = priorityWeight[b.priority];
      if (pA !== pB) return sortPriority === 'asc' ? pA - pB : pB - pA;
      return 0;
    });
  }

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!hasInitialized.current && currentUser) {
      setFilterAssigneeId(currentUser.id);
      hasInitialized.current = true;
    }
  }, [currentUser]);

  // Helper to build range of days
  const gridCells: { type: 'day'; dayNum: number; dateStr: string; isOtherMonth: boolean }[] = [];
  
  // Previous month days
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  for (let i = startDayOffset - 1; i >= 0; i--) {
    const prevDay = daysInPrevMonth - i;
    const prevDate = new Date(year, month - 1, prevDay);
    const m = prevDate.getMonth() + 1;
    const y = prevDate.getFullYear();
    const formattedMonth = m < 10 ? `0${m}` : `${m}`;
    const formattedDay = prevDay < 10 ? `0${prevDay}` : `${prevDay}`;
    
    gridCells.push({
      type: 'day',
      dayNum: prevDay,
      dateStr: `${y}-${formattedMonth}-${formattedDay}`,
      isOtherMonth: true
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const formattedMonth = (month + 1) < 10 ? `0${month + 1}` : `${month + 1}`;
    const formattedDay = i < 10 ? `0${i}` : `${i}`;
    gridCells.push({
      type: 'day',
      dayNum: i,
      dateStr: `${year}-${formattedMonth}-${formattedDay}`,
      isOtherMonth: false
    });
  }

  // Next month days (All of them to allow scrolling 2 months)
  const nextMonthDate = new Date(year, month + 1, 1);
  const nextMonthDays = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, 0).getDate();
  for (let i = 1; i <= nextMonthDays; i++) {
    const nextDate = new Date(year, month + 1, i);
    const m = nextDate.getMonth() + 1;
    const y = nextDate.getFullYear();
    const formattedMonth = m < 10 ? `0${m}` : `${m}`;
    const formattedDay = i < 10 ? `0${i}` : `${i}`;
    
    gridCells.push({
      type: 'day',
      dayNum: i,
      dateStr: `${y}-${formattedMonth}-${formattedDay}`,
      isOtherMonth: true
    });
  }

  // Next-next month trailing days to complete the last row
  const totalCells = Math.ceil(gridCells.length / 7) * 7;
  const remainingCells = totalCells - gridCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    const nextNextDate = new Date(year, month + 2, i);
    const m = nextNextDate.getMonth() + 1;
    const y = nextNextDate.getFullYear();
    const formattedMonth = m < 10 ? `0${m}` : `${m}`;
    const formattedDay = i < 10 ? `0${i}` : `${i}`;
    
    gridCells.push({
      type: 'day',
      dayNum: i,
      dateStr: `${y}-${formattedMonth}-${formattedDay}`,
      isOtherMonth: true
    });
  }

  // ─────────────────────────────────────────────────
  // DRAG AND DROP (GHOST) LOGIC
  // ─────────────────────────────────────────────────
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [hoveredUnplannedTaskId, setHoveredUnplannedTaskId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const draggingCardRef = useRef<string | null>(null);

  const createGhost = useCallback((sourceEl: HTMLElement, clientX: number, clientY: number) => {
    if (ghostRef.current) {
      document.body.removeChild(ghostRef.current);
      ghostRef.current = null;
    }
    const rect = sourceEl.getBoundingClientRect();
    dragOffsetRef.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    const ghost = sourceEl.cloneNode(true) as HTMLDivElement;
    ghost.style.position = 'fixed';
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.style.opacity = '0.95';
    ghost.style.transform = 'rotate(1.5deg) scale(1.03)';
    ghost.style.boxShadow = '0 24px 48px rgba(0,0,0,0.7), 0 8px 24px rgba(0,0,0,0.4)';
    ghost.style.transition = 'transform 0.1s ease, opacity 0.1s ease';
    ghost.style.borderRadius = '6px';
    document.body.appendChild(ghost);
    ghostRef.current = ghost;
  }, []);

  const moveGhost = useCallback((clientX: number, clientY: number) => {
    if (!ghostRef.current) return;
    ghostRef.current.style.left = `${clientX - dragOffsetRef.current.x}px`;
    ghostRef.current.style.top = `${clientY - dragOffsetRef.current.y}px`;
  }, []);

  const removeGhost = useCallback(() => {
    draggingCardRef.current = null;
    const ghost = ghostRef.current;
    if (!ghost) return;
    ghostRef.current = null;
    ghost.style.opacity = '0';
    ghost.style.transform = 'rotate(1.5deg) scale(0.97)';
    ghost.style.transition = 'opacity 0.13s ease, transform 0.13s ease';
    setTimeout(() => {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }, 140);
  }, []);

  useEffect(() => {
    const onDragEnd = () => {
      if (ghostRef.current || draggingCardRef.current) {
        removeGhost();
        setDraggingCardId(null);
        setDragOverDate(null);
      }
    };
    document.addEventListener('dragend', onDragEnd);
    return () => document.removeEventListener('dragend', onDragEnd);
  }, [removeGhost]);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string, sourceEl: HTMLElement) => {
    e.dataTransfer.setData('text/plain', taskId);
    const empty = new Image();
    e.dataTransfer.setDragImage(empty, 0, 0);

    draggingCardRef.current = taskId;
    setDraggingCardId(taskId);

    const cx = e.clientX;
    const cy = e.clientY;
    requestAnimationFrame(() => createGhost(sourceEl, cx, cy));
  }, [createGhost]);

  const handleDragEnd = useCallback(() => {
    removeGhost();
    setDraggingCardId(null);
    setDragOverDate(null);
  }, [removeGhost]);

  const handleDragOver = useCallback((e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(dateStr);
    if (ghostRef.current) moveGhost(e.clientX, e.clientY);
  }, [moveGhost]);

  const handleDragLeave = useCallback((e: React.DragEvent, dateStr: string) => {
    const rel = e.relatedTarget as HTMLElement | null;
    if (rel && (e.currentTarget as HTMLElement).contains(rel)) return;
    setDragOverDate(prev => prev === dateStr ? null : prev);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');

    removeGhost();
    setDraggingCardId(null);
    setDragOverDate(null);

    if (!taskId) return;
    const matchedTask = tasks.find(t => t.id === taskId);
    if (!matchedTask) return;

    if (isPlanningMode) {
      if (matchedTask.plannedDate !== targetDateStr) {
        onUpdateTask({ ...matchedTask, plannedDate: targetDateStr });
      }
    } else {
      if (matchedTask.dueDate !== targetDateStr) {
        onUpdateTask({ ...matchedTask, dueDate: targetDateStr });
      }
    }

    // Snap animation
    setTimeout(() => {
      const cardEl = document.querySelector(`[data-card="${taskId}"]`) as HTMLElement | null;
      if (!cardEl) return;
      cardEl.style.opacity = '0';
      cardEl.style.transform = 'translateY(-8px)';
      requestAnimationFrame(() => {
        cardEl.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
        cardEl.style.opacity = '1';
        cardEl.style.transform = 'translateY(0)';
        setTimeout(() => {
          cardEl.style.transition = '';
          cardEl.style.opacity = '';
          cardEl.style.transform = '';
        }, 220);
      });
    }, 40);
  }, [tasks, onUpdateTask, removeGhost, isPlanningMode]);

  // ─────────────────────────────────────────────────

  const handleDayClick = (dateStr: string) => {
    const title = prompt(`Novo evento para ${dateStr.split('-').reverse().join('/')}:`);
    if (!title || !title.trim()) return;

    const newTask: Task = {
      id: `TSK-${100 + tasks.length + 1}`,
      title: title.trim(),
      description: 'Criado via Calendário.',
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
    <div className="flex-1 flex flex-col min-h-0 bg-[#08080a]">
      {/* Filters Bar */}
      <div className="group relative shrink-0 border-b border-zinc-900/60 bg-[#08080a] z-20">
        {/* Trigger Handle */}
        <div className="h-3 w-full flex items-center justify-center cursor-pointer bg-zinc-950/20 hover:bg-zinc-900/30 transition-colors" title="Filtros">
          <div className="w-12 h-1 rounded-full bg-zinc-800 group-hover:bg-zinc-600 transition-colors" />
        </div>
        
        <div className="max-h-0 overflow-hidden opacity-0 group-hover:max-h-[80px] group-hover:opacity-100 transition-all duration-300 ease-in-out">
          <div className="px-6 pb-3 pt-1 flex items-center">
            <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 font-medium">Responsáveis:</span>
          <div className="flex items-center gap-1.5 bg-zinc-900/40 p-1 rounded-full border border-zinc-800/50">
            <button onClick={() => setFilterAssigneeId('all')} className={`text-[10px] px-3 py-1 rounded-full font-medium transition-all ${filterAssigneeId === 'all' ? 'bg-zinc-800 text-white shadow-sm' : 'bg-transparent text-zinc-500 hover:text-zinc-300'}`}>Todos</button>
            <div className="w-[1px] h-4 bg-zinc-800 mx-0.5" />
            <div className="flex items-center pl-1 pr-1 gap-1">
              {sortedUsers.map(u => (
                <button key={u.id} onClick={() => setFilterAssigneeId(u.id)} title={u.name}
                  className={`relative w-6 h-6 rounded-full border-2 transition-all duration-300 overflow-hidden flex items-center justify-center text-[9px] font-bold shrink-0 ${filterAssigneeId === u.id ? 'border-blue-500 scale-110 shadow-lg shadow-blue-500/20 grayscale-0' : 'border-transparent opacity-50 hover:opacity-100 grayscale hover:grayscale-0 hover:scale-105'}`}
                  style={{ backgroundColor: u.avatarUrl ? 'transparent' : '#27272a' }}
                >
                  {u.avatarUrl ? <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" /> : <span className="text-zinc-400">{u.initials}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-3 ml-6">
          <span className="text-xs text-zinc-500 font-medium">Prioridade:</span>
          <div className="flex items-center gap-1.5 bg-zinc-900/40 p-1 rounded-full border border-zinc-800/50">
            <button onClick={() => setFilterPriority('all')} className={`text-[10px] px-3 py-1 rounded-full font-medium transition-all ${filterPriority === 'all' ? 'bg-zinc-800 text-white shadow-sm' : 'bg-transparent text-zinc-500 hover:text-zinc-300'}`}>Todas</button>
            <div className="w-[1px] h-4 bg-zinc-800 mx-0.5" />
            <div className="flex items-center pl-1 pr-1 gap-1">
              {[
                { id: 'urgent',      label: <ChevronsUp size={12} />, color: 'text-red-400 border-red-500 bg-red-500/10',       title: 'Urgente' },
                { id: 'high',        label: <ChevronUp size={12} />,  color: 'text-orange-400 border-orange-500 bg-orange-500/10', title: 'Alta' },
                { id: 'medium',      label: <Minus size={12} />,      color: 'text-blue-400 border-blue-500 bg-blue-500/10',     title: 'Média' },
                { id: 'low',         label: <ChevronDown size={12} />,color: 'text-emerald-400 border-emerald-500 bg-emerald-500/10', title: 'Baixa' },
                { id: 'no_priority', label: '-',                      color: 'text-zinc-500 border-zinc-500 bg-zinc-900/10',      title: 'Sem prioridade' },
              ].map(p => (
                <button key={p.id} onClick={() => setFilterPriority(p.id as TaskPriority)} title={p.title}
                  className={`relative w-6 h-6 rounded-full border-2 transition-all duration-300 flex items-center justify-center text-[10px] font-bold shrink-0 ${filterPriority === p.id ? `${p.color} scale-110 shadow-lg shadow-black/20` : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sort Filter */}
        <div className="flex items-center gap-3 ml-6">
          <span className="text-xs text-zinc-500 font-medium">Ordenar:</span>
          <div className="flex items-center gap-1.5 bg-zinc-900/40 p-1 rounded-full border border-zinc-800/50">
            <button
              onClick={() => { if (sortPriority === 'asc') setSortPriority('desc'); else if (sortPriority === 'desc') setSortPriority('none'); else setSortPriority('asc'); }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium transition-all ${sortPriority !== 'none' ? 'bg-zinc-800 text-zinc-200 shadow-sm' : 'bg-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              Prioridade
              <div className="flex flex-col gap-[1px]">
                <ArrowUp size={9} className={sortPriority === 'asc' ? 'text-blue-400' : 'opacity-40'} />
                <ArrowDown size={9} className={sortPriority === 'desc' ? 'text-blue-400' : 'opacity-40'} />
              </div>
            </button>
          </div>
        </div>

        {/* Social Media Filter */}
        {setSocialMediaFilter && (
          <div className="flex items-center gap-3 ml-6">
            <span className="text-xs text-zinc-500 font-medium hidden lg:inline">Acesso Rápido:</span>
            <button
              onClick={() => setSocialMediaFilter(!socialMediaFilter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
                socialMediaFilter 
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                  : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <Share2 size={12} className={socialMediaFilter ? 'text-purple-400' : 'text-zinc-500'} />
              Rede Social
            </button>
          </div>
        )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 overflow-y-auto select-none space-y-4">
        {/* Calendar Header */}
      <div className="flex items-center justify-between bg-zinc-950/50 p-4 rounded-lg border border-zinc-900 shrink-0">
        <div className="flex items-center gap-2">
          <CalendarIcon size={14} className="text-zinc-400" />
          <h2 className="text-xs font-semibold text-zinc-350 uppercase tracking-widest font-mono">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            onClick={() => setIsPlanningMode(!isPlanningMode)}
            className={`ml-4 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${isPlanningMode ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'bg-zinc-900/40 text-zinc-500 border-zinc-800/50 hover:text-zinc-300'}`}
          >
            Modo Planejamento
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={goToToday} className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all font-medium">Hoje</button>
          <button onClick={prevMonth} className="p-1 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 hover:text-white transition-all"><ChevronLeft size={12} /></button>
          <button onClick={nextMonth} className="p-1 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 hover:text-white transition-all"><ChevronRight size={12} /></button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-[460px] overflow-hidden">
        {isPlanningMode && (
          <div className="w-[260px] flex flex-col border border-zinc-900 rounded-lg bg-[#121214]/30 overflow-hidden shrink-0">
             <div className="h-10 border-b border-zinc-900 flex items-center px-4 bg-zinc-950 shrink-0">
               <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Aguardando Planejamento</span>
               <span className="ml-auto text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">{unplannedTasks.length}</span>
             </div>
             <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
                {unplannedTasks.length === 0 ? (
                  <div className="text-center p-4 text-xs text-zinc-600">Nenhuma tarefa pendente.</div>
                ) : (
                  unplannedTasks.map(task => {
                    const primaryLabelId = task.labels.length > 0 ? task.labels[0]?.id : null;
                    const primaryLabelData = primaryLabelId ? labels.find(l => l.id === primaryLabelId) : null;
                    
                    return (
                      <div
                        key={`unplanned-${task.id}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id, e.currentTarget as HTMLElement)}
                        onDragEnd={handleDragEnd}
                        onMouseEnter={() => setHoveredUnplannedTaskId(task.id)}
                        onMouseLeave={() => setHoveredUnplannedTaskId(null)}
                        onClick={() => onSelectTask(task)}
                        className="group flex items-center justify-between bg-[#121214] hover:bg-[#161619] rounded-lg transition-all duration-150 cursor-grab active:cursor-grabbing shadow-sm px-3 py-2.5 border border-transparent hover:border-zinc-800"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {(() => {
                            if (task.priority === 'urgent') return <ChevronsUp size={12} className="text-red-500 shrink-0" />;
                            if (task.priority === 'high') return <ChevronUp size={12} className="text-orange-500 shrink-0" />;
                            if (task.priority === 'medium') return <Minus size={12} className="text-blue-500 shrink-0" />;
                            if (task.priority === 'low') return <ChevronDown size={12} className="text-emerald-500 shrink-0" />;
                            return null;
                          })()}
                          <h4 className="text-[11.5px] font-semibold text-zinc-200 truncate">{task.title}</h4>
                        </div>
                        {task.dueDate && (
                          <span className="text-[10px] text-[#3b82f6]/80 font-mono font-medium shrink-0 ml-3">
                            {task.dueDate.split('-')[2]}/{task.dueDate.split('-')[1]}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
             </div>
          </div>
        )}

        <div className="flex-1 border border-zinc-900 rounded-lg overflow-hidden bg-[#121214]/30 flex flex-col min-w-0">
          {/* Days of the week header - sticky */}
          <div className="grid grid-cols-7 h-10 border-b border-zinc-900 text-center items-center font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950 select-none shrink-0 z-10">
            {daysHeader.map(d => (
              <div key={d}>{d}</div>
            ))}
          </div>

        {/* Days grid cells - scrollable */}
        <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-7 min-h-full divide-x divide-y divide-zinc-900/60 bg-transparent auto-rows-max relative z-10">
          {gridCells.map((cell, idx) => {
            const dayNum = cell.dayNum;
            const dateStr = cell.dateStr;
            const isToday = isCurrentMonth && dayNum === currentDayNum && !cell.isOtherMonth;
            const isTarget = dragOverDate === dateStr;
            
            const getHighlightedDate = () => {
              if (draggingCardId) {
                const draggingTask = tasks.find(t => t.id === draggingCardId);
                if (draggingTask && !draggingTask.plannedDate) return draggingTask.dueDate;
              }
              if (hoveredUnplannedTaskId) {
                const hoveredTask = tasks.find(t => t.id === hoveredUnplannedTaskId);
                if (hoveredTask && !hoveredTask.plannedDate) return hoveredTask.dueDate;
              }
              return null;
            };
            const highlightedDueDate = getHighlightedDate();
            const isHighlightedDue = isPlanningMode && highlightedDueDate === dateStr;

            const dayTasks = filteredTasks.flatMap(t => {
              const occurrences = [];
              if (!isPlanningMode && t.dueDate === dateStr) {
                occurrences.push(t);
              }
              if (isPlanningMode && t.plannedDate === dateStr) {
                occurrences.push(t);
              }
              return occurrences;
            });

            return (
              <div 
                key={`day-${dateStr}`} 
                onDragOver={(e) => handleDragOver(e, dateStr)}
                onDragLeave={(e) => handleDragLeave(e, dateStr)}
                onDrop={(e) => handleDrop(e, dateStr)}
                className={`p-1.5 min-h-[150px] hover:bg-zinc-900/40 flex flex-col transition-colors group relative ${
                  isTarget ? 'bg-blue-500/10' : isToday ? 'bg-zinc-900/10' : ''
                } ${isHighlightedDue ? 'ring-2 ring-blue-500/50 bg-blue-500/5' : ''}`}
              >
                {/* Cell title header */}
                <div className="flex items-center justify-between mb-1 shrink-0">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className={`text-[10px] font-mono font-bold px-1 py-0.5 rounded transition-colors shrink-0 ${
                      isTarget ? 'text-blue-400' : isToday 
                        ? 'bg-red-500 text-white shadow-sm shadow-red-500/20' 
                        : cell.isOtherMonth
                          ? 'text-zinc-700'
                          : 'text-zinc-500 group-hover:text-zinc-300'
                    }`}>
                      {dayNum === 1 && cell.isOtherMonth ? `1 ${MONTH_NAMES[parseInt(dateStr.split('-')[1], 10) - 1].slice(0,3)}` : dayNum}
                    </span>
                    
                    {/* Holiday Indicator */}
                    {(() => {
                      const mmdd = dateStr.slice(5);
                      const holiday = holidays.find(h => h.date === mmdd);
                      if (holiday) {
                        const isCommemorative = holiday.type === 'commemorative';
                        const colorClass = isCommemorative 
                          ? (cell.isOtherMonth ? 'text-emerald-400/40' : 'text-emerald-400/80')
                          : (cell.isOtherMonth ? 'text-red-400/40' : 'text-red-400/80');
                        
                        return (
                          <span className={`text-[8.5px] truncate max-w-full font-medium transition-colors ${colorClass}`} title={holiday.name}>
                            {holiday.name}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <button 
                    onClick={() => handleDayClick(dateStr)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all absolute right-1.5 top-1.5 shrink-0"
                    title="Adicionar evento"
                  >
                    <Plus size={9} />
                  </button>
                </div>

                {/* Day Tasks pills inside cell */}
                <div className="overflow-y-auto space-y-1 pr-0.5 scrollbar-thin max-h-[320px]">
                  {dayTasks.map(task => {
                    const primaryLabelId = task.labels.length > 0 ? task.labels[0]?.id : null;
                    const primaryLabelData = primaryLabelId ? labels.find(l => l.id === primaryLabelId) : null;
                    const themeTextColor = primaryLabelData ? (primaryLabelData.color.match(/text-[a-z]+-\d+/) || ['text-zinc-500'])[0] : '';

                    let ThemeIcon: any = null;
                    if (primaryLabelData?.name === 'Design') ThemeIcon = PenTool;
                    else if (primaryLabelData?.name === 'Copy') ThemeIcon = Type;
                    else if (primaryLabelData?.name === 'Tarefa') ThemeIcon = CheckSquare;
                    else if (primaryLabelData?.name === 'Orçamento') ThemeIcon = DollarSign;
                    const isDragging = draggingCardId === task.id;

                    const getProgress = (status: TaskStatus) => {
                      switch (status) {
                        case 'todo': return 0;
                        case 'in_progress': return 25;
                        case 'approval': return 50;
                        case 'rework': return 75;
                        case 'implementation': return 99;
                        case 'done': return 100;
                        default: return 0;
                      }
                    };
                    const progress = getProgress(task.status);

                    let alertType = null;
                    let alertBgClass = '';
                    let AlertIcon: any = null;
                    
                    if (isPlanningMode) {
                      const todayISO = new Date().toISOString().split('T')[0];
                      const dueStr = task.dueDate ? task.dueDate.split('T')[0] : null;
                      
                      if (task.status === 'done' || task.status === 'implementation') {
                        alertType = 'completo';
                        alertBgClass = 'bg-[#1a7a4c]'; // Dark green
                        AlertIcon = CheckCircle2;
                      } else if (dueStr && dueStr < todayISO) {
                        alertType = 'alerta';
                        alertBgClass = 'bg-[#7b1919]'; // Dark red
                        AlertIcon = AlertTriangle;
                      } else if (todayISO > dateStr) {
                        alertType = 'atencao';
                        alertBgClass = 'bg-[#9a7b1b]'; // Dark gold/amber
                        AlertIcon = AlertCircle;
                      }
                    }

                    return (
                      <div
                        key={task.id}
                        data-card={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id, e.currentTarget as HTMLElement)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onSelectTask(task)}
                        className={`group flex items-stretch ${alertBgClass || 'bg-[#121214]'} hover:${alertBgClass || 'bg-[#161619]'} rounded-md transition-all duration-300 cursor-grab active:cursor-grabbing shadow-sm overflow-hidden border ${alertBgClass ? 'border-transparent' : 'border-zinc-900/60 hover:border-zinc-800'} ${isDragging ? 'opacity-30' : ''} ${task.status === 'done' && !isDragging ? 'opacity-60 grayscale' : ''}`}
                      >
                          {alertType && AlertIcon && (
                            <div className={`${isPlanningMode ? 'w-5' : 'w-8'} shrink-0 flex items-center justify-center transition-all duration-500 animate-slide-in-right`}>
                              <AlertIcon size={isPlanningMode ? 11 : 14} className="text-white" />
                            </div>
                          )}
                          <div className={`flex flex-col ${isPlanningMode ? 'gap-1 px-1.5 py-1' : 'gap-1.5 px-2 py-1.5'} w-full bg-[#121214] group-hover:bg-[#161619] transition-colors ${alertType ? 'rounded-l-md border-l border-zinc-900/80' : ''}`}>
                            <div className="flex items-center gap-2 w-full">
                            {/* Theme Icon */}
                            {ThemeIcon && (
                              <div className={`shrink-0 ${themeTextColor}`}>
                                <ThemeIcon size={isPlanningMode ? 10 : 12} />
                              </div>
                            )}

                            {/* Title */}
                            <span className={`flex-1 ${isPlanningMode ? 'text-[9.5px]' : 'text-[11px]'} font-medium truncate min-w-0 ${task.status === 'done' ? 'text-zinc-500 line-through' : 'text-zinc-200'}`} title={task.title}>
                              {task.title}
                            </span>

                            {/* Priority */}
                            {(() => {
                              const pSize = isPlanningMode ? 10 : 13;
                              const map: Record<string, { icon: React.ReactNode; cls: string }> = {
                                urgent: { icon: <ChevronsUp size={pSize} />, cls: 'text-red-400' },
                                high:   { icon: <ChevronUp size={pSize} />, cls: 'text-orange-400' },
                                medium: { icon: <Minus size={pSize} />, cls: 'text-blue-400' },
                                low:    { icon: <ChevronDown size={pSize} />, cls: 'text-emerald-400' },
                              };
                              const p = map[task.priority];
                              return p ? (
                                <span className={`flex items-center justify-center shrink-0 ${p.cls}`}>{p.icon}</span>
                              ) : null;
                            })()}

                            {/* Reminder bell */}
                              <div onClick={(e) => e.stopPropagation()}>
                                <DatePicker
                                  value={task.reminderDate || ''}
                                  onChange={(date) => {
                                    onUpdateTask({ ...task, reminderDate: date || undefined });
                                  }}
                                  enableTime={true}
                                  onQuickAdd={() => {
                                    const tomorrow = new Date();
                                    tomorrow.setDate(tomorrow.getDate() + 1);
                                    onUpdateTask({ ...task, reminderDate: `${tomorrow.toISOString().split('T')[0]}T09:00` });
                                  }}
                                  trigger={
                                    <button type="button" className={`flex items-center justify-center transition-colors ${task.reminderDate ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`} title={task.reminderDate ? 'Desativar lembrete' : 'Ativar lembrete'}>
                                      <Bell size={isPlanningMode ? 10 : 12} className={task.reminderDate ? 'fill-amber-400' : ''} />
                                    </button>
                                  }
                                />
                              </div>
                          </div>
                          {/* Status Progress Bar */}
                          {!isPlanningMode && (
                            <div className="w-full pt-1.5 pb-0.5 relative px-1">
                              <div className="w-full h-[2px] bg-zinc-900 rounded-full" />
                              <div 
                                className="absolute top-[6px] left-1 h-[2px] bg-zinc-600 rounded-full transition-all duration-300" 
                                style={{ width: `calc(${progress}% - 8px)` }}
                              />
                              <div 
                                className="absolute top-[6px] -mt-[3px] w-[8px] h-[8px] bg-zinc-600 rounded-full flex items-center justify-center transition-all duration-300"
                                style={{ left: `calc(${progress}% - 4px)` }}
                              />
                            </div>
                          )}
                          </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
