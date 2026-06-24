import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Clock, 
  CheckCircle2, 
  HelpCircle, 
  AlertTriangle, 
  ArrowUp, 
  ArrowDown, 
  Layers, 
  Bookmark,
  Sparkles,
  Inbox,
  Calendar,
  PenTool,
  Type,
  CheckSquare,
  DollarSign,
  Share2,
  LayoutTemplate,
  Tag as TagIcon,
  BellRing
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, Project, Label } from '../types';
import { useAuth } from '../context/AuthContext';

interface KanbanViewProps {
  tasks: Task[];
  projects: Project[];
  labels: Label[];
  onSelectTask: (task: Task) => void;
  onUpdateTask: (task: Task) => void;
  onAddTask: (task: Task) => void;
  currentProjectFilter: string | null;
}

const COLUMNS: { id: TaskStatus; label: string; dotColor: string; icon: React.ReactNode }[] = [
  { id: 'no_forecast', label: 'Sem previsão', dotColor: 'bg-slate-500', icon: <Inbox size={14} className="text-slate-400 shrink-0" /> },
  { id: 'todo', label: 'A fazer', dotColor: 'bg-blue-500', icon: <HelpCircle size={14} className="text-blue-400 shrink-0" /> },
  { id: 'in_progress', label: 'Em progresso', dotColor: 'bg-amber-500', icon: <Clock size={14} className="text-amber-400 shrink-0 animate-pulse" /> },
  { id: 'paused', label: 'Pausado', dotColor: 'bg-red-400', icon: <AlertTriangle size={14} className="text-red-400 shrink-0" /> },
  { id: 'approval', label: 'Aprovação', dotColor: 'bg-purple-500', icon: <HelpCircle size={14} className="text-purple-400 shrink-0" /> },
  { id: 'rework', label: 'Refação', dotColor: 'bg-orange-500', icon: <ArrowDown size={14} className="text-orange-400 shrink-0" /> },
  { id: 'implementation', label: 'Implementação', dotColor: 'bg-blue-500', icon: <Layers size={14} className="text-blue-400 shrink-0" /> },
  { id: 'done', label: 'Concluído', dotColor: 'bg-emerald-500', icon: <CheckCircle2 size={14} className="text-emerald-450 shrink-0" /> },
];

export default function KanbanView({
  tasks,
  projects,
  labels,
  onSelectTask,
  onUpdateTask,
  onAddTask,
  currentProjectFilter
}: KanbanViewProps) {
  const { allUsers: USERS } = useAuth();
  
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [filterAssigneeId, setFilterAssigneeId] = useState<string | 'all'>('all');
  
  // Track open state of inline quick-add box per column
  const [inlineQuickAdd, setInlineQuickAdd] = useState<{columnId: string, title: string} | null>(null);

  const handleAddNewTaskInColumn = (statusId: TaskStatus) => {
    const idNum = 100 + tasks.length + 1;
    const newTask: Task = {
      id: `TSK-${idNum}`,
      title: '',
      description: '',
      status: statusId,
      priority: 'medium',
      projectId: '',
      labels: [labels.find(l => l.name === 'Tarefa') || labels[0]].filter(Boolean) as Label[],
      subtasks: [],
      createdAt: new Date().toISOString().split('T')[0],
    };
    onAddTask(newTask);
    onSelectTask(newTask);
  };
  const [quickAddColId, setQuickAddColId] = useState<TaskStatus | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Wheel-scroll state
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filter tasks based on project selection and assignee
  const filteredTasks = tasks.filter(task => {
    if (currentProjectFilter && task.projectId !== currentProjectFilter) return false;
    if (filterAssigneeId !== 'all' && task.assigneeId !== filterAssigneeId) return false;
    return true;
  });

  // Get tasks for a specific column
  const getColTasks = (colId: TaskStatus) => {
    return filteredTasks.filter(t => t.status === colId);
  };

  // Drag and Drop callbacks
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggingCardId(taskId);
  };

  const handleDragEnd = () => {
    setDraggingCardId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, colId: TaskStatus) => {
    e.preventDefault();
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const matchedTask = tasks.find(t => t.id === taskId);
    if (matchedTask && matchedTask.status !== targetStatus) {
      onUpdateTask({
        ...matchedTask,
        status: targetStatus
      });
    }

    setDraggingCardId(null);
    setDragOverColumn(null);
  };

  // Quick Task Addition inside column
  const triggerQuickAdd = (status: TaskStatus) => {
    setQuickAddColId(status);
    setQuickAddTitle('');
  };

  const submitQuickAdd = (e: React.FormEvent, status: TaskStatus) => {
    e.preventDefault();
    if (!quickAddTitle.trim()) {
      setQuickAddColId(null);
      return;
    }

    const newTask: Task = {
      id: `TSK-${100 + tasks.length + 1}`,
      title: quickAddTitle.trim(),
      description: 'Criada via Adição Rápida de Coluna.',
      status: status,
      priority: 'medium',
      projectId: currentProjectFilter || (projects[0]?.id || 'p1'),
      labels: [labels.find(l => l.name === 'Tarefa') || labels[0]].filter(Boolean) as Label[],
      subtasks: [],
      createdAt: new Date().toISOString().split('T')[0],
    };

    onAddTask(newTask);
    setQuickAddTitle('');
    setQuickAddColId(null);
  };

  // Scroll handlers
  const handleWheel = (e: React.WheelEvent) => {
    const target = e.target as HTMLElement;
    const closestScrollable = target.closest('.overflow-y-auto');
    
    if (closestScrollable) {
      const { scrollHeight, clientHeight } = closestScrollable;
      const isScrollable = scrollHeight > clientHeight;
      // If the column can scroll vertically, let the native vertical scroll happen
      if (isScrollable && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        return;
      }
    }
    
    // Translate vertical wheel to horizontal scrolling
    if (scrollContainerRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  // Build helpers for priority style allocations
  const getPriorityBadge = (prio: TaskPriority) => {
    const baseBadgeCls = "inline-flex items-center gap-1 text-[10px] font-sans font-medium px-1.5 py-0.5 rounded border select-none";
    switch (prio) {
      case 'urgent':
        return <span className={`${baseBadgeCls} text-red-400 bg-red-500/10 border-red-500/15`}><AlertTriangle size={10} className="shrink-0" /> Urgente</span>;
      case 'high':
        return <span className={`${baseBadgeCls} text-orange-400 bg-orange-500/10 border-orange-500/15`}><ArrowUp size={10} className="shrink-0" /> Alta</span>;
      case 'medium':
        return <span className={`${baseBadgeCls} text-blue-400 bg-blue-500/10 border-blue-500/15`}>Média</span>;
      case 'low':
        return <span className={`${baseBadgeCls} text-emerald-400 bg-emerald-500/10 border-emerald-500/15`}><ArrowDown size={10} className="shrink-0" /> Baixa</span>;
      default:
        return <span className={`${baseBadgeCls} text-zinc-600 bg-zinc-900/5 border-transparent`}>Sem prioridade</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#08080a]">
      {/* Filters Bar */}
      <div className="px-6 py-3 border-b border-zinc-900/60 flex items-center shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 font-medium">Responsáveis:</span>
          
          <div className="flex items-center gap-1.5 bg-zinc-900/40 p-1 rounded-full border border-zinc-800/50">
            <button
              onClick={() => setFilterAssigneeId('all')}
              className={`text-[10px] px-3 py-1 rounded-full font-medium transition-all ${
                filterAssigneeId === 'all' 
                  ? 'bg-zinc-800 text-white shadow-sm' 
                  : 'bg-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Todos
            </button>
            <div className="w-[1px] h-4 bg-zinc-800 mx-0.5"></div>
            <div className="flex items-center pl-1 pr-1 gap-1">
              {USERS.map(u => (
                <button
                  key={u.id}
                  onClick={() => setFilterAssigneeId(u.id)}
                  title={u.name}
                  className={`relative w-6 h-6 rounded-full border-2 transition-all duration-300 overflow-hidden flex items-center justify-center text-[9px] font-bold shrink-0 ${
                    filterAssigneeId === u.id 
                      ? 'border-blue-500 scale-110 shadow-lg shadow-blue-500/20 grayscale-0' 
                      : 'border-transparent opacity-50 hover:opacity-100 grayscale hover:grayscale-0 hover:scale-105'
                  }`}
                  style={{ backgroundColor: u.avatarUrl ? 'transparent' : '#27272a' }}
                >
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-zinc-400">{u.initials}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        onWheel={handleWheel}
        className="flex-1 flex overflow-x-auto min-h-0 p-6 gap-6 select-none scrollbar-thin"
      >
      {COLUMNS.map(column => {
        const colTasks = getColTasks(column.id);
        const isTarget = dragOverColumn === column.id;
        const isQuickAddOpen = quickAddColId === column.id;

        return (
          <div
            key={column.id}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDrop={(e) => handleDrop(e, column.id)}
            className={`group/column flex-1 min-w-[280px] max-w-[340px] bg-transparent rounded-xl flex flex-col p-2 border border-transparent transition-all duration-200 scrollbar-none`}
          >
            {/* Column Title header */}
            <div className="flex items-center justify-between mb-4 px-1 shrink-0">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${column.dotColor}`} />
                {column.icon}
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-sans">
                  {column.label}
                </span>
                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-1.5 py-0.2 rounded border border-zinc-900/60 font-medium">
                  {colTasks.length}
                </span>
              </div>

              <button 
                onClick={() => triggerQuickAdd(column.id)}
                className="opacity-0 group-hover/column:opacity-100 focus:opacity-100 p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all duration-150"
                title="Adicionar Tarefa na Coluna"
              >
                <Plus size={13} />
              </button>
            </div>

            {/* Quick Add block */}
            {isQuickAddOpen && (
              <form 
                onSubmit={(e) => submitQuickAdd(e, column.id)}
                className="mb-3 p-3 bg-zinc-950 border border-zinc-900 rounded-lg animate-fade-in shrink-0"
              >
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="Nome do cartão..."
                  value={quickAddTitle}
                  onChange={(e) => setQuickAddTitle(e.target.value)}
                  className="w-full bg-[#08080a] border border-zinc-800 p-2 text-xs rounded-md text-zinc-150 outline-none focus:border-zinc-700/60 mb-2"
                />
                <div className="flex justify-end gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setQuickAddColId(null)}
                    className="px-2 py-1 text-zinc-500 hover:text-zinc-300 font-sans font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-750 text-white rounded font-medium transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
              </form>
            )}

            {/* Scrollable list of cards inside column */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 no-scrollbar">
              {colTasks.length === 0 ? (
                <div className="h-24 border border-dashed border-zinc-900 rounded-xl flex flex-col items-center justify-center text-xs text-zinc-650 italic bg-transparent">
                  <Layers size={13} className="mb-1 text-zinc-750" />
                  <span>Sem cards</span>
                </div>
              ) : (
                colTasks.map(task => {
                const project = projects.find(p => p.id === task.projectId);
                
                // Calculate subtask ratio
                const totalSub = task.subtasks.length;
                const completedSub = task.subtasks.filter(s => s.completed).length;
                const isDragging = draggingCardId === task.id;

                const primaryLabelId = task.labels.length > 0 ? task.labels[0]?.id : null;
                const primaryLabelData = primaryLabelId ? labels.find(l => l.id === primaryLabelId) : null;
                const themeTextColor = primaryLabelData ? (primaryLabelData.color.match(/text-[a-z]+-\d+/) || ['text-zinc-500'])[0] : '';

                let ThemeIcon: any = null;
                if (primaryLabelData?.name === 'Design') ThemeIcon = PenTool;
                else if (primaryLabelData?.name === 'Copy') ThemeIcon = Type;
                else if (primaryLabelData?.name === 'Tarefa') ThemeIcon = CheckSquare;
                else if (primaryLabelData?.name === 'Orçamento') ThemeIcon = DollarSign;
                else if (primaryLabelData?.name === 'Social Mídia') ThemeIcon = Share2;
                else if (primaryLabelData) ThemeIcon = TagIcon;

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onSelectTask(task)}
                    className={`group relative bg-[#121214] hover:bg-[#161619] border border-zinc-900/60 hover:border-zinc-800 rounded-lg p-3 transition-all duration-200 cursor-grab active:cursor-grabbing hover:shadow-xl hover:shadow-black/50 ${
                      isDragging ? 'opacity-30 border-dashed border-zinc-700 scale-[0.98]' : ''
                    }`}
                  >
                    {/* Linha Superior (ID & Assignee) */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-zinc-500 font-mono font-semibold tracking-tight uppercase flex items-center gap-1.5">
                        <span>{task.id.split('-')[0]}</span>
                        {project && (
                          <>
                            <span className="text-zinc-700 font-sans font-light">|</span>
                            <span className="truncate max-w-[120px]">
                              {project.name}
                            </span>
                          </>
                        )}
                      </span>
                      {task.assigneeId && USERS.find(u => u.id === task.assigneeId) ? (
                        <div 
                          className="w-5 h-5 rounded-full border border-zinc-800 shrink-0 overflow-hidden"
                          title={USERS.find(u => u.id === task.assigneeId)?.name}
                        >
                          <img src={USERS.find(u => u.id === task.assigneeId)?.avatarUrl} alt="Avatar" className="w-full h-full object-cover grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-dashed border-zinc-900 flex items-center justify-center text-[10px] text-zinc-600 shrink-0" title="Sem responsável">
                          -
                        </div>
                      )}
                    </div>

                    {/* Centro (Título) */}
                    <div className="mb-2 flex items-start gap-1.5">
                      {ThemeIcon && (
                        <div className={`shrink-0 mt-[1px] ${themeTextColor}`}>
                          <ThemeIcon size={14} />
                        </div>
                      )}
                      <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-white leading-snug tracking-normal break-words w-full">
                        {task.title}
                      </h4>
                    </div>

                    {/* Barra de progresso discreta de 2px (se houver subtasks) */}
                    {totalSub > 0 && (
                      <div className="w-full h-[2px] bg-zinc-950 rounded-full overflow-hidden mb-2">
                        <div 
                          className="h-full bg-zinc-700 transition-all duration-300" 
                          style={{ width: `${(completedSub / totalSub) * 100}%` }}
                        />
                      </div>
                    )}

                    {/* Footer: Prioridade e Prazo */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-900/40">
                      <div className="flex items-center gap-1.5 flex-wrap w-full">
                        {getPriorityBadge(task.priority)}
                        {task.dueDate && (() => {
                          const isOverdue = task.status !== 'done' && task.dueDate < new Date().toISOString().split('T')[0];
                          return (
                            <div className={`flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${isOverdue ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-zinc-400 bg-zinc-900/50 border-zinc-800/50'}`}>
                              <Calendar size={9} />
                              <span>{task.dueDate.split('-').reverse().join('/')}</span>
                            </div>
                          );
                        })()}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (task.reminderDate) {
                              onUpdateTask({ ...task, reminderDate: undefined });
                            } else {
                              const tomorrow = new Date();
                              tomorrow.setDate(tomorrow.getDate() + 1);
                              const baseDate = tomorrow.toISOString().split('T')[0];
                              onUpdateTask({ ...task, reminderDate: `${baseDate}T09:00` });
                            }
                          }}
                          className={`ml-auto flex items-center justify-center transition-colors ${
                            task.reminderDate 
                              ? 'text-amber-400 hover:text-amber-300' 
                              : 'text-zinc-600 hover:text-zinc-400'
                          }`}
                          title={task.reminderDate ? "Desativar lembretes" : "Ativar lembretes"}
                        >
                          <BellRing size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
              )}
              
              {/* Discreet New Task Button */}
              <button 
                onClick={() => handleAddNewTaskInColumn(column.id)}
                className="w-full mt-2 py-2 flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 rounded-lg transition-colors border border-transparent border-dashed hover:border-zinc-700/50"
              >
                <Plus size={12} />
                Nova Tarefa
              </button>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
