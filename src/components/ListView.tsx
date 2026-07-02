import React, { useState, useEffect, useRef } from 'react';
import { 
  Inbox, 
  HelpCircle, 
  Clock, 
  CheckCircle2, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  ArrowUp, 
  ArrowDown, 
  AlertTriangle, 
  Plus, 
  Calendar as CalendarIcon,
  ChevronsUpDown,
  Layers,
  SlidersHorizontal,
  GripVertical,
  Columns,
  PenTool,
  Type,
  CheckSquare,
  DollarSign,
  Share2,
  Tag as TagIcon,
  Eye,
  EyeOff,
  Minus
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, Project, Label } from '../types';
import { useAuth } from '../context/AuthContext';
import ReminderBell from './ReminderBell';
import StatusPicker from './StatusPicker';
import PriorityPicker from './PriorityPicker';
import AssigneePicker from './AssigneePicker';

interface ListViewProps {
  tasks: Task[];
  projects: Project[];
  labels: Label[];
  onSelectTask: (task: Task) => void;
  onUpdateTask: (task: Task) => void;
  onAddTask: (task: Task) => void;
  currentProjectFilter: string | null;
}

type GroupByOption = 'none' | 'status' | 'priority';

export type ColumnId = 'status' | 'title' | 'labels' | 'project' | 'priority' | 'dueDate' | 'assignee' | 'reminder';

export interface ColumnDef {
  id: ColumnId;
  label: string;
  width: number;
  visible?: boolean;
}

const defaultColumns: ColumnDef[] = [
  { id: 'status', label: 'Status', width: 140, visible: true },
  { id: 'title', label: 'Nome da Tarefa', width: 350, visible: true },
  { id: 'labels', label: 'Tags', width: 120, visible: true },
  { id: 'project', label: 'Projeto', width: 130, visible: true },
  { id: 'priority', label: 'Prioridade', width: 100, visible: true },
  { id: 'dueDate', label: 'Prazo', width: 100, visible: true },
  { id: 'assignee', label: 'Responsável', width: 120, visible: true },
  { id: 'reminder', label: 'Lembrete', width: 100, visible: true }
];

export default function ListView({
  tasks,
  projects,
  labels,
  onSelectTask,
  onUpdateTask,
  onAddTask,
  currentProjectFilter
}: ListViewProps) {
  const { currentUser, updateProfile, allUsers: USERS } = useAuth();
  
  const [search, setSearch] = useState('');
  const [filterAssigneeId, setFilterAssigneeId] = useState<string | 'all'>(currentUser?.id || 'all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [sortPriority, setSortPriority] = useState<'none' | 'asc' | 'desc'>('desc');
  const [sortDue, setSortDue] = useState<'none' | 'asc' | 'desc'>('asc');
  
  const hasInitializedUserFilter = useRef(!!currentUser);

  useEffect(() => {
    if (!hasInitializedUserFilter.current && currentUser) {
      setFilterAssigneeId(currentUser.id);
      hasInitializedUserFilter.current = true;
    }
  }, [currentUser]);
  const [groupBy, setGroupBy] = useState<GroupByOption>('status');
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [inlineNewTaskText, setInlineNewTaskText] = useState('');
  const [showColToggle, setShowColToggle] = useState(false);

  // Column management state
  const [columns, setColumns] = useState<ColumnDef[]>(() => {
    // 1. Try to load from user profile preferences first
    if (currentUser?.preferences?.listViewColumns) {
      try {
        const parsed = currentUser.preferences.listViewColumns;
        const merged = defaultColumns.map(dc => {
          const found = parsed.find((p: ColumnDef) => p.id === dc.id);
          return found ? { ...dc, ...found } : dc;
        });
        const ordered = parsed
          .filter((p: ColumnDef) => merged.find(m => m.id === p.id))
          .map((p: ColumnDef) => merged.find(m => m.id === p.id)!)
          .concat(merged.filter(m => !parsed.find((p: ColumnDef) => p.id === m.id)));
        return ordered;
      } catch (e) {
        return defaultColumns;
      }
    }
    
    // 2. Fallback to local storage (legacy) or default
    const saved = localStorage.getItem('listViewColumns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const merged = defaultColumns.map(dc => {
          const found = parsed.find((p: ColumnDef) => p.id === dc.id);
          return found ? { ...dc, ...found } : dc;
        });
        const ordered = parsed
          .filter((p: ColumnDef) => merged.find(m => m.id === p.id))
          .map((p: ColumnDef) => merged.find(m => m.id === p.id)!)
          .concat(merged.filter(m => !parsed.find((p: ColumnDef) => p.id === m.id)));
        return ordered;
      } catch (e) {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  const hasInitializedColumns = useRef(!!currentUser?.preferences?.listViewColumns);

  useEffect(() => {
    if (!hasInitializedColumns.current && currentUser?.preferences?.listViewColumns) {
      try {
        const parsed = currentUser.preferences.listViewColumns;
        const merged = defaultColumns.map(dc => {
          const found = parsed.find((p: ColumnDef) => p.id === dc.id);
          return found ? { ...dc, ...found } : dc;
        });
        const ordered = parsed
          .filter((p: ColumnDef) => merged.find(m => m.id === p.id))
          .map((p: ColumnDef) => merged.find(m => m.id === p.id)!)
          .concat(merged.filter(m => !parsed.find((p: ColumnDef) => p.id === m.id)));
        setColumns(ordered);
        hasInitializedColumns.current = true;
      } catch (e) {
        console.error(e);
      }
    }
  }, [currentUser?.preferences?.listViewColumns]);

  // Track the timeout to debounce API calls
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Save locally for quick response
    localStorage.setItem('listViewColumns', JSON.stringify(columns));
    
    // Save to user profile with debounce
    if (currentUser && updateProfile) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        const newPreferences = {
          ...currentUser.preferences,
          listViewColumns: columns
        };
        // Avoid sending if it's already exactly the same
        const currentSavedStr = JSON.stringify(currentUser.preferences?.listViewColumns || []);
        if (JSON.stringify(columns) !== currentSavedStr) {
          updateProfile({ preferences: newPreferences }).catch(console.error);
        }
      }, 1000);
    }
    
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [columns, currentUser?.id]);

  // Drag and drop state for reordering columns
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  // Resizing state
  const resizingColRef = useRef<string | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  // Filter tasks based on project selector, assignee & search input
  let filteredTasks = tasks.filter(task => {
    if (currentProjectFilter && task.projectId !== currentProjectFilter) return false;
    if (filterAssigneeId !== 'all' && task.assigneeId !== filterAssigneeId) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        task.title.toLowerCase().includes(q) ||
        task.description.toLowerCase().includes(q) ||
        (task.labels && task.labels.some(l => l.name.toLowerCase().includes(q)))
      );
    }
    return true;
  });

  if (sortPriority !== 'none' || sortDue !== 'none') {
    const priorityWeight: Record<TaskPriority, number> = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
      no_priority: 0
    };

    filteredTasks = [...filteredTasks].sort((a, b) => {
      // 1. Sort by Priority
      if (sortPriority !== 'none') {
        const pA = priorityWeight[a.priority];
        const pB = priorityWeight[b.priority];
        if (pA !== pB) {
          return sortPriority === 'asc' ? pA - pB : pB - pA;
        }
      }

      // 2. Sort by Due Date
      if (sortDue !== 'none') {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        
        if (!a.dueDate && b.dueDate) return 1;
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && !b.dueDate) return 0;
        
        if (dateA !== dateB) {
          return sortDue === 'asc' ? dateA - dateB : dateB - dateA;
        }
      }
      
      return 0;
    });
  }

  // Toggle state to quickly cycle task status from the list itself!
  const cycleStatus = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation(); // prevent opening sheet
    const nextStatuses: Record<TaskStatus, TaskStatus> = {
      'no_forecast': 'todo',
      'todo': 'in_progress',
      'in_progress': 'paused',
      'paused': 'approval',
      'approval': 'rework',
      'rework': 'implementation',
      'implementation': 'done',
      'done': 'no_forecast'
    };
    onUpdateTask({
      ...task,
      status: nextStatuses[task.status]
    });
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'no_forecast':
        return <Inbox size={14} className="text-slate-400" />;
      case 'todo':
        return <HelpCircle size={14} className="text-blue-400" />;
      case 'in_progress':
        return <Clock size={14} className="text-amber-400 animate-pulse" />;
      case 'paused':
        return <AlertTriangle size={14} className="text-red-400" />;
      case 'approval':
        return <HelpCircle size={14} className="text-purple-400" />;
      case 'rework':
        return <ArrowDown size={14} className="text-orange-400" />;
      case 'implementation':
        return <Layers size={14} className="text-blue-400" />;
      case 'done':
        return <CheckCircle2 size={14} className="text-emerald-400" />;
    }
  };

  const getStatusLabel = (status: TaskStatus) => {
    const labels: Record<TaskStatus, string> = {
      'no_forecast': 'Sem previsão',
      'todo': 'A fazer',
      'in_progress': 'Em progresso',
      'paused': 'Pausado',
      'approval': 'Aprovação',
      'rework': 'Refação',
      'implementation': 'Implementação',
      'done': 'Concluído'
    };
    return labels[status] || status;
  };

  const getPriorityBadge = (prio: TaskPriority) => {
    const baseBadgeCls = "inline-flex items-center gap-1.5 text-[10px] font-sans font-medium px-1.5 py-0.5 rounded border select-none w-fit";
    switch (prio) {
      case 'urgent':
        return <span className={`${baseBadgeCls} text-red-400 bg-red-500/10 border-red-500/15`}><AlertTriangle size={10} className="shrink-0" /> Urgente</span>;
      case 'high':
        return <span className={`${baseBadgeCls} text-orange-400 bg-orange-500/10 border-orange-500/15`}><ArrowUp size={10} className="shrink-0" /> Alta</span>;
      case 'medium':
        return <span className={`${baseBadgeCls} text-blue-400 bg-blue-500/10 border-blue-500/15`}><Minus size={10} className="shrink-0" /> Média</span>;
      case 'low':
        return <span className={`${baseBadgeCls} text-emerald-400 bg-emerald-500/10 border-emerald-500/15`}><ArrowDown size={10} className="shrink-0" /> Baixa</span>;
      default:
        return <span className={`${baseBadgeCls} text-zinc-650 bg-zinc-900/10 border-transparent`}>Sem prioridade</span>;
    }
  };

  const handleInlineAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineNewTaskText.trim()) return;

    const newTask: any = {
      id: crypto.randomUUID(),
      title: inlineNewTaskText.trim(),
      description: 'Criada instantaneamente via Lista Compacta.',
      status: 'todo',
      priority: 'medium',
      projectId: currentProjectFilter || (projects[0]?.id || 'p1'),
      labels: [labels.find(l => l.name === 'Tarefa') || labels[0]].filter(Boolean) as Label[],
      subtasks: [],
      createdAt: new Date().toISOString().split('T')[0],
      assigneeId: currentUser?.id,
      _isLocal: true,
    };

    onAddTask(newTask as Task);
    setInlineNewTaskText('');
  };

  // --- Resize Logic ---
  const handleResizeStart = (e: React.MouseEvent, colId: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingColRef.current = colId;
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingColRef.current) return;
    const diffX = e.clientX - startXRef.current;
    const newWidth = Math.max(60, startWidthRef.current + diffX); // min width 60px
    setColumns(prev => prev.map(c => c.id === resizingColRef.current ? { ...c, width: newWidth } : c));
  };

  const handleResizeEnd = () => {
    resizingColRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  // --- Drag and Drop Logic ---
  const handleDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedColumn(colId);
    e.dataTransfer.effectAllowed = 'move';
    // Small delay to prevent the dragged element from looking like a ghost immediately
    setTimeout(() => {
      // optional styling logic
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
    if (!draggedColumn || draggedColumn === colId) return;

    setColumns(prev => {
      const draggedIndex = prev.findIndex(c => c.id === draggedColumn);
      const targetIndex = prev.findIndex(c => c.id === colId);
      
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      const newCols = [...prev];
      const [removed] = newCols.splice(draggedIndex, 1);
      newCols.splice(targetIndex, 0, removed);
      return newCols;
    });
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  // --- Cell Renderers ---
  const renderCellContent = (task: Task, col: ColumnDef) => {
    const project = projects.find(p => p.id === task.projectId);
    
    switch (col.id) {
      case 'status':
        return (
          <StatusPicker
            value={task.status}
            onChange={(val) => onUpdateTask({ ...task, status: val })}
            trigger={
              <div className="flex items-center gap-2 max-w-full cursor-pointer hover:bg-zinc-800/60 p-1 rounded-md transition-colors -ml-1">
                <div className="shrink-0 text-zinc-500">
                  {getStatusIcon(task.status)}
                </div>
                <span className="text-[11px] font-medium text-zinc-300 capitalize truncate">
                  {getStatusLabel(task.status)}
                </span>
              </div>
            }
          />
        );
      case 'title': {
        const primaryLabelId = task.labels.length > 0 ? task.labels[0]?.id : null;
        const primaryLabelData = primaryLabelId ? labels.find(l => l.id === primaryLabelId) : null;
        const themeTextColor = primaryLabelData ? (primaryLabelData.color.match(/text-[a-z]+-\d+/) || ['text-zinc-500'])[0] : '';

        let ThemeIcon: any = null;
        if (primaryLabelData?.name === 'Design') ThemeIcon = PenTool;
        else if (primaryLabelData?.name === 'Copy') ThemeIcon = Type;
        else if (primaryLabelData?.name === 'Tarefa') ThemeIcon = CheckSquare;
        else if (primaryLabelData?.name === 'Orçamento') ThemeIcon = DollarSign;
        else if (primaryLabelData?.name === 'Social Media') ThemeIcon = Share2;
        else if (primaryLabelData) ThemeIcon = TagIcon;

        return (
          <div className="flex items-center gap-2 max-w-full">
            {ThemeIcon && (
              <div className={`shrink-0 ${themeTextColor}`}>
                <ThemeIcon size={12} />
              </div>
            )}
            <span className="font-semibold text-zinc-200 group-hover:text-white truncate block">
              {task.title}
            </span>
          </div>
        );
      }
      case 'labels':
        return (
          <div className="flex items-center gap-1.5 overflow-hidden">
            {task.labels && task.labels.slice(0, 2).map(l => {
              const isCriticalTag = l.name.toLowerCase().includes('bug') || l.name.toLowerCase().includes('urgente') || l.name.toLowerCase().includes('crítico');
              return (
                <span 
                  key={l.id} 
                  className={`text-[9px] px-1.5 py-0.2 rounded font-sans tracking-tight font-medium shrink-0 ${
                    isCriticalTag 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/15'
                      : 'bg-zinc-800/40 text-zinc-400 border border-zinc-800/30'
                  }`}
                >
                  {l.name}
                </span>
              );
            })}
          </div>
        );
      case 'project':
        return project ? (
          <div className="flex items-center gap-1.5 bg-zinc-950 px-1.5 py-0.5 rounded text-[9px] text-zinc-500 font-medium border border-zinc-900/50 w-fit max-w-full">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 bg-current ${project.color}`} />
            <span className="text-zinc-400 font-medium truncate">
              {project.name}
            </span>
          </div>
        ) : null;
      case 'priority':
        return (
          <PriorityPicker
            value={task.priority}
            onChange={(val) => onUpdateTask({ ...task, priority: val })}
            trigger={
              <button type="button" className="hover:scale-105 transition-transform active:scale-95 text-left">
                {getPriorityBadge(task.priority)}
              </button>
            }
          />
        );
      case 'dueDate':
        return task.dueDate ? (
          <div className="flex items-center gap-1 text-zinc-500 font-mono text-[10px]">
            <CalendarIcon size={11} className="shrink-0" />
            <span className="truncate">{task.dueDate}</span>
          </div>
        ) : (
          <span className="text-zinc-500 pl-4">-</span>
        );
      case 'assignee':
        return (
          <AssigneePicker
            value={task.assigneeId}
            onChange={(val) => onUpdateTask({ ...task, assigneeId: val })}
            trigger={
              <div className="flex items-center gap-2 overflow-hidden cursor-pointer hover:bg-zinc-800/60 p-1 rounded-md transition-colors -ml-1">
                {task.assigneeId && USERS.find(u => u.id === task.assigneeId) ? (
                  <>
                    <div className="w-5 h-5 rounded-full bg-zinc-850 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                      <img src={USERS.find(u => u.id === task.assigneeId)?.avatarUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[11px] font-medium text-zinc-400 truncate hidden md:block">
                      {USERS.find(u => u.id === task.assigneeId)?.name}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-5 h-5 rounded-full border border-dashed border-zinc-800 shrink-0 bg-zinc-900/50 flex items-center justify-center text-[10px] text-zinc-600">
                      -
                    </div>
                    <span className="text-[11px] font-medium text-zinc-500 truncate hidden md:block">
                      Não atribuído
                    </span>
                  </>
                )}
              </div>
            }
          />
        );
      case 'reminder':
        return (
          <div className="w-[80px] flex items-center">
            <ReminderBell
              reminderDate={task.reminderDate}
              reminderType={task.reminderType}
              size={11}
              showLabel={true}
              align="right"
              onChange={({ reminderDate, reminderType }) => onUpdateTask({ ...task, reminderDate, reminderType })}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const renderList = (taskList: Task[]) => (
    <div className="border border-zinc-900 rounded-lg bg-[#121214]/40 flex flex-col select-none relative w-max min-w-full">
      
      {/* Table Header Row */}
      <div className="flex items-stretch bg-zinc-950/95 backdrop-blur-md border-b border-zinc-900 sticky top-0 z-10 text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold rounded-t-lg">
        {columns.filter(c => c.visible !== false).map((col) => (
          <div 
            key={col.id}
            draggable
            onDragStart={(e) => handleDragStart(e, col.id)}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragEnd={handleDragEnd}
            style={{ width: col.width }}
            className={`relative flex items-center px-4 py-2 hover:bg-zinc-900/60 transition-colors shrink-0 ${draggedColumn === col.id ? 'opacity-50' : ''}`}
          >
            <GripVertical size={12} className="opacity-0 hover:opacity-100 cursor-grab text-zinc-600 absolute left-1" />
            <span className="truncate">{col.label}</span>
            {/* Resizer Handle */}
            <div 
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/20 active:bg-blue-500/40"
              onMouseDown={(e) => handleResizeStart(e, col.id, col.width)}
            />
          </div>
        ))}
      </div>

      {/* Table Body */}
      <div className="flex flex-col divide-y divide-zinc-900">
        {taskList.map(task => (
          <div
            key={task.id}
            onClick={() => onSelectTask(task)}
            className="flex items-stretch hover:bg-zinc-900/50 transition-all cursor-pointer group text-xs text-zinc-350"
          >
            {columns.filter(c => c.visible !== false).map(col => (
              <div 
                key={col.id} 
                style={{ width: col.width }}
                className="px-4 py-2.5 shrink-0 flex flex-col justify-center"
              >
                {renderCellContent(task, col)}
              </div>
            ))}
          </div>
        ))}

        {/* Quick Add inline row */}
        <form onSubmit={handleInlineAddSubmit} className="flex items-center gap-3 px-4 py-2 bg-zinc-950/80">
          <div className="p-1 text-zinc-650 shrink-0">
            <Plus size={13} />
          </div>
          <input
            type="text"
            value={inlineNewTaskText}
            onChange={(e) => setInlineNewTaskText(e.target.value)}
            placeholder="+ Criar tarefa rapidamente no empreendimento atual... (Pressione Enter para salvar)"
            className="flex-1 bg-transparent border-0 ring-0 focus:ring-0 focus:outline-none outline-none text-xs text-gray-300 placeholder-gray-600 min-w-[300px]"
          />
          {inlineNewTaskText.trim() !== '' && (
            <span className="text-[10px] text-blue-500 font-mono tracking-wider animate-pulse shrink-0">
              ENTER PARA CRIAR
            </span>
          )}
        </form>
      </div>
    </div>
  );

  const renderGroupedContent = () => {
    if (groupBy === 'status') {
      const statusesList: { id: TaskStatus; label: string; color: string }[] = [
        { id: 'no_forecast', label: 'Sem previsão', color: 'bg-slate-500' },
        { id: 'todo', label: 'A fazer', color: 'bg-blue-500' },
        { id: 'in_progress', label: 'Em progresso', color: 'bg-amber-500' },
        { id: 'paused', label: 'Pausado', color: 'bg-red-400' },
        { id: 'approval', label: 'Aprovação', color: 'bg-purple-500' },
        { id: 'rework', label: 'Refação', color: 'bg-orange-500' },
        { id: 'implementation', label: 'Implementação', color: 'bg-blue-500' },
        { id: 'done', label: 'Concluído', color: 'bg-emerald-500' },
      ];

      return (
        <div className="space-y-6">
          {statusesList.map(statusData => {
            const statusTasks = filteredTasks.filter(t => t.status === statusData.id);
            if (statusTasks.length === 0) return null;
            const isCollapsed = collapsedGroups.includes(statusData.id);
            return (
              <div key={statusData.id} className="space-y-2">
                <div className="flex items-center gap-2 px-1 sticky left-0 z-10 w-fit">
                  <button 
                    onClick={() => setCollapsedGroups(prev => isCollapsed ? prev.filter(g => g !== statusData.id) : [...prev, statusData.id])} 
                    className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 -ml-1 rounded hover:bg-zinc-800/50"
                  >
                    {isCollapsed ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusData.color}`} />
                  <span className="text-xs font-semibold text-gray-300 uppercase tracking-widest font-mono">{statusData.label}</span>
                  <span className="text-[10px] font-mono text-gray-500 bg-[#161b22] px-1.5 rounded-md border border-[#30363d]/45">
                    {statusTasks.length}
                  </span>
                </div>
                {!isCollapsed && renderList(statusTasks)}
              </div>
            );
          })}
        </div>
      );
    }

    if (groupBy === 'priority') {
      const prioritiesList: { id: TaskPriority; label: string; color: string }[] = [
        { id: 'urgent', label: 'Urgente', color: 'bg-red-500' },
        { id: 'high', label: 'Alta', color: 'bg-orange-500' },
        { id: 'medium', label: 'Média', color: 'bg-amber-500' },
        { id: 'low', label: 'Baixa', color: 'bg-blue-500' },
        { id: 'no_priority', label: 'Sem Prioridade', color: 'bg-slate-500' },
      ];

      return (
        <div className="space-y-6">
          {prioritiesList.map(prioData => {
            const prioTasks = filteredTasks.filter(t => t.priority === prioData.id);
            if (prioTasks.length === 0) return null;
            const isCollapsed = collapsedGroups.includes(prioData.id);
            return (
              <div key={prioData.id} className="space-y-2">
                <div className="flex items-center gap-2 px-1 sticky left-0 z-10 w-fit">
                  <button 
                    onClick={() => setCollapsedGroups(prev => isCollapsed ? prev.filter(g => g !== prioData.id) : [...prev, prioData.id])} 
                    className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 -ml-1 rounded hover:bg-zinc-800/50"
                  >
                    {isCollapsed ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <span className={`w-1.5 h-1.5 rounded-full ${prioData.color}`} />
                  <span className="text-xs font-semibold text-gray-300 uppercase tracking-widest font-mono">{prioData.label}</span>
                  <span className="text-[10px] font-mono text-gray-500 bg-[#161b22] px-1.5 rounded-md border border-[#30363d]/45">
                    {prioTasks.length}
                  </span>
                </div>
                {!isCollapsed && renderList(prioTasks)}
              </div>
            );
          })}
        </div>
      );
    }

    return renderList(filteredTasks);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-6 py-6 pb-2 space-y-4 bg-[#08080a]">
      {/* Header filter options strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/50 p-3 rounded-lg border border-zinc-900 shrink-0">
        
        {/* Search input */}
        <div className="relative flex-1 max-w-sm">
          <Search size={12} className="absolute left-2.5 top-2 text-zinc-500" />
          <input
            type="text"
            placeholder="Pesquisar nesta página..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-7 bg-[#08080a] border border-zinc-900 pl-8 pr-3 text-xs text-zinc-200 rounded-md outline-none focus:border-zinc-750 font-sans"
          />
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Assignee Filter */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-semibold">Responsável:</span>
            
            <div className="flex items-center gap-1.5 bg-zinc-900/40 p-1 rounded-full border border-zinc-800/50">
              <button
                onClick={() => setFilterAssigneeId('all')}
                className={`text-[9px] px-2.5 py-1 rounded-full font-medium transition-all ${
                  filterAssigneeId === 'all' 
                    ? 'bg-zinc-800 text-white shadow-sm' 
                    : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Todos
              </button>
              <div className="w-[1px] h-3 bg-zinc-800 mx-0.5"></div>
              <div className="flex items-center pl-1 pr-1 gap-1">
                {USERS.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setFilterAssigneeId(u.id)}
                    title={u.name}
                    className={`relative w-5 h-5 rounded-full border-2 transition-all duration-300 overflow-hidden flex items-center justify-center text-[8px] font-bold shrink-0 ${
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

          {/* Priority Filter */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-semibold">Prioridade:</span>
            <div className="flex items-center gap-1.5 bg-zinc-900/40 p-1 rounded-full border border-zinc-800/50">
              <button
                onClick={() => setFilterPriority('all')}
                className={`text-[9px] px-2.5 py-1 rounded-full font-medium transition-all ${
                  filterPriority === 'all' 
                    ? 'bg-zinc-800 text-white shadow-sm' 
                    : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Todas
              </button>
              <div className="w-[1px] h-3 bg-zinc-800 mx-0.5"></div>
              <div className="flex items-center pl-1 pr-1 gap-1">
                {[
                  { id: 'urgent', label: 'U', icon: <AlertTriangle size={10} />, color: 'text-red-400 border-red-500 bg-red-500/10', title: 'Urgente' },
                  { id: 'high', label: 'A', icon: <ArrowUp size={10} />, color: 'text-orange-400 border-orange-500 bg-orange-500/10', title: 'Alta' },
                  { id: 'medium', label: 'M', icon: null, color: 'text-blue-400 border-blue-500 bg-blue-500/10', title: 'Média' },
                  { id: 'low', label: 'B', icon: <ArrowDown size={10} />, color: 'text-emerald-400 border-emerald-500 bg-emerald-500/10', title: 'Baixa' },
                  { id: 'no_priority', label: '-', icon: null, color: 'text-zinc-500 border-zinc-500 bg-zinc-900/10', title: 'Sem prioridade' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setFilterPriority(p.id as TaskPriority)}
                    title={p.title}
                    className={`relative w-5 h-5 rounded-full border-2 transition-all duration-300 flex items-center justify-center text-[8px] font-bold shrink-0 ${
                      filterPriority === p.id 
                        ? `${p.color} scale-110 shadow-lg shadow-black/20` 
                        : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sort Filter */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-semibold">Ordenar:</span>
            
            <div className="flex items-center gap-1.5 bg-zinc-900/40 p-1 rounded-full border border-zinc-800/50">
              <button
                onClick={() => {
                  if (sortPriority === 'asc') setSortPriority('desc');
                  else if (sortPriority === 'desc') setSortPriority('none');
                  else setSortPriority('asc');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium transition-all ${
                  sortPriority !== 'none' ? 'bg-zinc-800 text-zinc-200 shadow-sm' : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Prioridade
                <div className="flex flex-col gap-[1px]">
                  <ArrowUp size={8} className={sortPriority === 'asc' ? 'text-blue-400' : 'opacity-40'} />
                  <ArrowDown size={8} className={sortPriority === 'desc' ? 'text-blue-400' : 'opacity-40'} />
                </div>
              </button>

              <button
                onClick={() => {
                  if (sortDue === 'asc') setSortDue('desc');
                  else if (sortDue === 'desc') setSortDue('none');
                  else setSortDue('asc');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium transition-all ${
                  sortDue !== 'none' ? 'bg-zinc-800 text-zinc-200 shadow-sm' : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Prazo
                <div className="flex flex-col gap-[1px]">
                  <ArrowUp size={8} className={sortDue === 'asc' ? 'text-blue-400' : 'opacity-40'} />
                  <ArrowDown size={8} className={sortDue === 'desc' ? 'text-blue-400' : 'opacity-40'} />
                </div>
              </button>
            </div>
          </div>

          {/* Grouping switcher */}
          <div className="flex items-center gap-2 shrink-0">
          <SlidersHorizontal size={11} className="text-zinc-500" />
          <span className="text-[10px] font-mono uppercase text-zinc-500 font-semibold">Agrupar por:</span>
          <div className="flex bg-[#08080a] p-0.5 rounded-md border border-zinc-900">
            {(['none', 'status', 'priority'] as GroupByOption[]).map(option => (
              <button
                key={option}
                onClick={() => setGroupBy(option)}
                className={`px-2.5 py-0.5 text-[10px] rounded font-medium transition-all capitalize ${
                  groupBy === option 
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/50 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                }`}
              >
                {option === 'none' ? 'Sem Grupo' : option === 'status' ? 'Status' : 'Prioridade'}
              </button>
            ))}
          </div>
        </div>

        {/* Column Toggler */}
        <div className="flex items-center gap-2 shrink-0 ml-auto relative">
          <button
            onClick={() => setShowColToggle(!showColToggle)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-[10px] font-medium ${
              showColToggle 
                ? 'bg-zinc-800 text-zinc-200 border-zinc-700' 
                : 'bg-zinc-900/40 text-zinc-500 border-zinc-800/50 hover:text-zinc-300'
            }`}
          >
            <Columns size={12} />
            Colunas
          </button>
          
          {showColToggle && (
            <div className="absolute top-full right-0 mt-2 bg-[#121214] border border-zinc-800 rounded-lg shadow-xl p-2 z-50 flex flex-col gap-1 w-[160px]">
              <div className="text-[10px] font-mono text-zinc-500 uppercase font-bold px-2 py-1 mb-1">
                Visibilidade
              </div>
              {columns.map(col => (
                <label key={col.id} className="flex items-center gap-2 px-2 py-1 hover:bg-zinc-800/50 rounded cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={col.visible !== false}
                    onChange={(e) => {
                      const newCols = columns.map(c => c.id === col.id ? { ...c, visible: e.target.checked } : c);
                      setColumns(newCols);
                      
                      // Save to user preferences if available
                      if (currentUser) {
                         const prefs = currentUser.preferences || {};
                         updateProfile({ preferences: { ...prefs, listViewColumns: newCols } });
                      } else {
                         localStorage.setItem('listViewColumns', JSON.stringify(newCols));
                      }
                    }}
                    className="w-3 h-3 rounded-sm border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-[11px] text-zinc-300 group-hover:text-zinc-100 transition-colors">
                    {col.label}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

      </div>
      </div>

      {/* Main Container list rendering */}
      {filteredTasks.length === 0 ? (
        <div className="flex-1 border border-dashed border-zinc-900 rounded-xl p-12 text-center text-zinc-600 bg-transparent flex flex-col items-center justify-center">
          <Inbox size={22} className="text-zinc-600 mb-2" />
          <p className="text-xs font-semibold">Nenhuma tarefa correspondente</p>
          <p className="text-[11px] text-zinc-650">Altere o filtro de pesquisa ou de empreendimentos</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto pb-20 scrollbar-minimal min-h-0">
          <div className="min-w-fit">
            {renderGroupedContent()}
          </div>
        </div>
      )}
    </div>
  );
}
