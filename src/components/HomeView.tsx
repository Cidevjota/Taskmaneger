import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, Flag, Calendar, Search, Plus, ChevronLeft, ChevronRight, 
  CheckCircle2, AlertTriangle, AlertCircle, Edit, Clock, Target, ArrowUpRight, Bookmark,
  PenTool, Type, CheckSquare, DollarSign, Share2, TagIcon, Star,
  ChevronsUp, ChevronUp, Minus, ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Task, Project, Label } from '../types';
import WeeklyPlanner from './WeeklyPlanner';
import KanbanView from './KanbanView';
import DatePicker from './DatePicker';

interface HomeViewProps {
  tasks?: Task[];
  projects?: Project[];
  labels?: Label[];
  onUpdateTask?: (updates: Partial<Task> & { id: string }) => void;
  onSelectTask?: (task: Task) => void;
  onAddTask?: (task: Task) => void;
  currentProjectFilter?: string | null;
  socialMediaFilter?: boolean;
  setSocialMediaFilter?: (val: boolean) => void;
}

export default function HomeView({ 
  tasks = [], 
  projects = [],
  labels = [],
  onUpdateTask = () => {}, 
  onSelectTask = () => {},
  onAddTask = () => {},
  currentProjectFilter = null,
  socialMediaFilter = false,
  setSocialMediaFilter = () => {}
}: HomeViewProps) {
  const { currentUser } = useAuth();
  const { notifications, markAsViewed, postpone, markAsImportant } = useNotifications();
  const userName = currentUser?.name?.split(' ')[0] || 'Ana';
  const [activeTab, setActiveTab] = React.useState<'planejador' | 'alertas'>('alertas');

  // ---------------------------------------------------------
  // Helpers de Data e Agregações Reais
  // ---------------------------------------------------------
  const today = new Date();
  
  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const getEndOfWeek = (startOfWeek: Date) => {
    const end = new Date(startOfWeek);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  };

  const isDateInCurrentWeek = (dateString?: string) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const startOfWeek = getStartOfWeek(today);
    const endOfWeek = getEndOfWeek(startOfWeek);
    return date >= startOfWeek && date <= endOfWeek;
  };

  // Filtrar apenas tasks do usuário logado
  const myTasks = tasks.filter(t => t.assigneeId === currentUser?.id);

  // 1. Concluídas da semana (active tasks transferred to "implementação" or "concluído" that belong to user)
  // Assumindo updatedAt ou createdAt para aproximação de semana se history não estiver perfeitamente completo, 
  // mas como regra simples usamos o campo updatedAt / reachedImplementationAt caso exista, ou apenas o status + data de planejamento na semana
  const concluidasDaSemana = myTasks.filter(t => {
    if (t.status === 'done' || t.status === 'implementation') {
      // Simplification: check if it was planned for this week OR updated this week
      return isDateInCurrentWeek(t.updatedAt || t.plannedDate || t.createdAt);
    }
    return false;
  });

  // 2. Atrasadas (Total tasks delayed associated with user)
  const atrasadas = myTasks.filter(t => {
    if (t.status === 'done' || t.status === 'implementation') return false;
    if (!t.dueDate) return false;
    const [y, m, d] = t.dueDate.split('-');
    const due = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999);
    return due < today;
  });

  // 3. Em andamento (todo, in_progress, approval, rework, implementation, paused)
  const emAndamento = myTasks.filter(t => 
    ['todo', 'in_progress', 'approval', 'rework', 'implementation', 'paused'].includes(t.status)
  );

  // 4. Planejado vs. concluído
  const planejadasNaSemana = myTasks.filter(t => isDateInCurrentWeek(t.plannedDate));
  const planejadasEConcluidas = planejadasNaSemana.filter(t => t.status === 'done' || t.status === 'implementation');
  const planejadoVsConcluidoRatio = planejadasNaSemana.length > 0 
    ? Math.round((planejadasEConcluidas.length / planejadasNaSemana.length) * 100) 
    : 0;

  // 5. Foco da semana (Urgente mais recente ou em andamento mais recente)
  const focoSemana = emAndamento.sort((a, b) => {
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
    return 0;
  })[0];
  const focoSemanaProj = projects?.find(p => p.id === focoSemana?.projectId)?.name || '';

  // 6. Notificações reais
  const myNotifications = notifications.filter(n => (n.status !== 'read' && n.status !== 'viewed') && (n.userId === currentUser?.id || n.userId === 'all'));

  // 7. Prioridades (Máximo de 4 cartões urgentes não concluídos)
  const prioridades = myTasks.filter(t => t.priority === 'urgent' && t.status !== 'done' && t.status !== 'implementation').slice(0, 4);

  // 8. Próximos Prazos (Atrasadas ou vencendo nos próximos 7 dias, order by date)
  const proximosPrazos = myTasks.filter(t => {
    if (t.status === 'done' || t.status === 'implementation') return false;
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    due.setHours(23, 59, 59, 999);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return due <= nextWeek;
  }).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  return (
    <div className="flex-1 overflow-auto bg-[#08080a] p-6 lg:p-10 text-zinc-200 custom-scrollbar">
      <div className="max-w-[1900px] w-full mx-auto flex flex-col gap-4">
        
        {/* HEADER AREA - SINGLE LINE */}
        <div className="flex items-center justify-between mb-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Bookmark className="text-zinc-400" size={18} />
              <h1 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">HOME</h1>
            </div>
            
            <div className="flex bg-[#121214] border border-zinc-900 p-1 rounded-full shadow-inner">
              <button 
                onClick={() => setActiveTab('planejador')}
                className={`px-5 py-1.5 text-[10px] font-bold tracking-[0.15em] uppercase rounded-full transition-colors ${activeTab === 'planejador' ? 'bg-[#27272a] text-zinc-100 shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                Planejador
              </button>
              <button 
                onClick={() => setActiveTab('alertas')}
                className={`px-5 py-1.5 text-[10px] font-bold tracking-[0.15em] uppercase rounded-full transition-colors ${activeTab === 'alertas' ? 'bg-[#27272a] text-zinc-100 shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                Alertas
              </button>
            </div>

            {/* USER PROFILE */}
            <div className="hidden lg:flex items-center gap-3 ml-2 border-l border-zinc-800/80 pl-6">
              {currentUser?.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-10 h-10 rounded-full border border-zinc-700/50 object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full border border-zinc-700/50 bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-300 shrink-0">
                  {currentUser?.initials || 'U'}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-tight leading-tight">{currentUser?.name || userName}</span>
                <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mt-0.5">{currentUser?.role || 'Usuário'}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 shrink-0">
            <button className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 px-4 py-1.5 rounded-md text-[10px] font-bold tracking-[0.15em] uppercase transition-colors">
              <Plus size={14} /> NOVA TAREFA
            </button>
          </div>
        </div>

        {/* TOP STATS / KPIS */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-[#0c0c0e] to-[#08080a] border border-zinc-900 rounded-xl p-4 flex items-center gap-4 shadow-sm group">
            <div className="w-10 h-10 rounded-full border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/10 transition-colors">
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-zinc-400 font-medium whitespace-nowrap">Concluídas da semana</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold text-zinc-100 leading-none">{concluidasDaSemana.length.toString().padStart(2, '0')}</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#0c0c0e] to-[#08080a] border border-zinc-900 rounded-xl p-4 flex items-center gap-4 shadow-sm group">
            <div className="w-10 h-10 rounded-full border border-red-500/20 bg-red-500/5 flex items-center justify-center shrink-0 group-hover:bg-red-500/10 transition-colors">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-zinc-400 font-medium">Atrasadas</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold text-zinc-100 leading-none">{atrasadas.length.toString().padStart(2, '0')}</span>
                {atrasadas.length > 0 && <span className="text-[10px] font-bold text-red-500 flex items-center gap-0.5"><AlertCircle size={10} /> Atenção</span>}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#0c0c0e] to-[#08080a] border border-zinc-900 rounded-xl p-4 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-full border-2 border-blue-500/20 border-t-blue-500 flex items-center justify-center shrink-0">
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-zinc-400 font-medium">Em andamento</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold text-zinc-100 leading-none">{emAndamento.length.toString().padStart(2, '0')}</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#0c0c0e] to-[#08080a] border border-zinc-900 rounded-xl p-4 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
              <Target size={16} className="text-purple-400" />
            </div>
            <div className="flex flex-col flex-1">
              <span className="text-[11px] text-zinc-400 font-medium">Planejado vs. concluído</span>
              <span className="text-xl font-bold text-zinc-100 leading-none mt-0.5">{planejadoVsConcluidoRatio}%</span>
              <div className="h-1 w-full bg-[#08080a] border border-zinc-900 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${planejadoVsConcluidoRatio}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#0c0c0e] to-[#08080a] border border-zinc-900 rounded-xl p-4 flex items-center gap-4 shadow-sm group">
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 transition-colors">
              <Target size={16} className="text-indigo-400" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-zinc-400 font-medium">Foco da semana</span>
              <span className="text-[11px] font-bold text-zinc-100 truncate mt-1">{focoSemana?.title || 'Nenhuma tarefa'}</span>
              <span className="text-[10px] text-zinc-500 truncate mt-0.5">{focoSemanaProj || '---'}</span>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'planejador' ? (
            <motion.div
              key="planejador"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 min-h-0 flex flex-col gap-6 -mx-6 lg:-mx-10 px-6 lg:px-10 overflow-hidden"
            >
            {/* Top Kanban */}
            <div className="h-[360px] flex-shrink-0 border-b border-zinc-900/60 pb-6 pt-0 flex flex-col">
              <div className="h-full flex flex-col min-h-0 overflow-hidden relative">
                <KanbanView 
                  tasks={myTasks}
                  projects={projects}
                  labels={labels}
                  onSelectTask={onSelectTask}
                  onUpdateTask={onUpdateTask}
                  onAddTask={onAddTask}
                  currentProjectFilter={currentProjectFilter}
                  socialMediaFilter={socialMediaFilter}
                  setSocialMediaFilter={setSocialMediaFilter}
                  hideFilters={true}
                  maxCardsPerColumn={5}
                  defaultCompact={true}
                  hideNewTaskButton={true}
                />
              </div>
            </div>

            {/* Bottom Weekly Planner */}
            <div className="flex-1 min-h-0">
              <WeeklyPlanner tasks={myTasks} onUpdateTask={onUpdateTask} onSelectTask={onSelectTask} />
            </div>
            </motion.div>
          ) : (
            <motion.div
              key="alertas"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 min-h-0 flex flex-col"
            >
            {/* THREE COLUMNS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-4">
          
          {/* Notificações */}
          <div className="flex flex-col bg-[#121214] border border-zinc-900 rounded-xl overflow-hidden shadow-sm shadow-black/20">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-900 bg-[#08080a]">
              <div className="flex items-center gap-2 text-zinc-400 font-bold text-[10px] uppercase tracking-[0.15em]">
                <Bell size={12} className="text-zinc-500" /> Notificações {myNotifications.length > 0 && <span className="bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full text-[9px]">{myNotifications.length}</span>}
              </div>
              <button className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider font-semibold">Ver todas</button>
            </div>
            <div className="flex flex-col p-2 gap-1 min-h-[250px] max-h-[350px] overflow-y-auto custom-scrollbar">
              {myNotifications.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-10 opacity-70">
                  <CheckCircle2 size={32} className="mb-2 text-zinc-600" />
                  <span className="text-xs">Tudo limpo!</span>
                </div>
              ) : myNotifications.map((n) => {
                const isImportant = n.status === 'important';
                const isUnread = n.status === 'unread';
                const task = tasks?.find(t => t.id === n.taskId);

                let titlePart = n.message;
                let descPart = n.details || '';
                if (n.message.includes(':')) {
                  const parts = n.message.split(':');
                  titlePart = parts[0].trim();
                  const rest = parts.slice(1).join(':').trim();
                  descPart = rest + (descPart ? ' - ' + descPart : '');
                }

                const IconComponent = n.type === 'task_assigned' ? CheckCircle2 : n.type === 'feedback_received' || n.type === 'review_requested' ? AlertTriangle : n.type === 'assignee_replaced' ? AlertCircle : Bell;

                return (
                  <div key={n.id} onClick={() => {
                    if (task && onSelectTask) onSelectTask(task);
                  }} className="group relative flex flex-col cursor-pointer rounded-lg px-2 py-1.5 hover:bg-[#161619] border border-transparent hover:border-zinc-800 transition-all duration-150">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1 overflow-hidden">
                        <div className={`mt-[2px] shrink-0 ${isUnread ? 'text-blue-400' : isImportant ? 'text-amber-400' : 'text-zinc-500'}`}>
                          <IconComponent size={14} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[13px] font-medium leading-tight truncate ${isUnread || isImportant ? 'text-zinc-200' : 'text-zinc-400'}`}>
                              {titlePart}
                            </span>
                            {isUnread && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                          </div>
                          
                          {descPart && (
                            <span className="text-[12px] text-zinc-500 line-clamp-1 mt-0.5 leading-tight pr-4">
                              {descPart.replace(/\n/g, ' ')}
                            </span>
                          )}
                          
                          {task && (
                            <span className="text-[11px] text-zinc-600 mt-1.5 flex items-center gap-1 truncate max-w-full">
                              <ChevronRight size={10} className="shrink-0" /> {task.title}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 pt-0.5">
                        <span className="text-[10px] text-zinc-500 font-medium mb-1">
                          {new Date(n.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            className="text-emerald-500 hover:text-emerald-400 transition-colors" 
                            title="Marcar como Arquivada"
                            onClick={(e) => { e.stopPropagation(); markAsViewed(n.id); }}
                          >
                            <CheckCircle2 size={13} />
                          </button>
                          <button 
                            className="text-zinc-500 hover:text-zinc-300 transition-colors" 
                            title="Adiar"
                            onClick={(e) => { e.stopPropagation(); postpone(n.id); }}
                          >
                            <Clock size={13} />
                          </button>
                          <button 
                            className="text-zinc-500 hover:text-amber-400 transition-colors" 
                            title="Destacar"
                            onClick={(e) => { e.stopPropagation(); markAsImportant(n.id); }}
                          >
                            <Star size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Prioridades */}
          <div className="flex flex-col bg-[#121214] border border-zinc-900 rounded-xl overflow-hidden shadow-sm shadow-black/20">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-900 bg-[#08080a]">
              <div className="flex items-center gap-2 text-zinc-400 font-bold text-[10px] uppercase tracking-[0.15em]">
                <Flag size={12} className="text-zinc-500" /> Prioridades
              </div>
              <button className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider font-semibold">Ver todas</button>
            </div>
            <div className="flex flex-col p-2 gap-1 min-h-[250px]">
              {prioridades.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-10 opacity-70">
                  <span className="text-xs">Nenhuma tarefa urgente</span>
                </div>
              ) : prioridades.map((t) => {
                const primaryLabelId = t.labels?.length > 0 ? t.labels[0].id : null;
                const primaryLabelData = primaryLabelId ? labels?.find(l => l.id === primaryLabelId) : null;
                const themeTextColor = primaryLabelData ? (primaryLabelData.color.match(/text-[a-z]+-\d+/) || ['text-zinc-500'])[0] : 'text-zinc-500';
                
                let ThemeIcon: any = TagIcon;
                if (primaryLabelData?.name === 'Design') ThemeIcon = PenTool;
                else if (primaryLabelData?.name === 'Copy') ThemeIcon = Type;
                else if (primaryLabelData?.name === 'Tarefa') ThemeIcon = CheckSquare;
                else if (primaryLabelData?.name === 'Orçamento') ThemeIcon = DollarSign;
                else if (primaryLabelData?.name === 'Social Media') ThemeIcon = Share2;
                
                return (
                  <div key={t.id} onClick={() => onSelectTask?.(t)} className="group flex items-center gap-2 bg-[#121214] hover:bg-[#161619] border border-zinc-900/60 hover:border-zinc-800 rounded-md px-2.5 py-1.5 transition-all duration-150 cursor-pointer">
                    <div className={`shrink-0 ${themeTextColor}`}><ThemeIcon size={12} /></div>
                    <span className="flex-1 text-[11px] font-medium text-zinc-200 truncate min-w-0" title={t.title}>
                      {t.title.length > 35 ? t.title.slice(0, 35) + '…' : t.title}
                    </span>
                    <div className="shrink-0 flex items-center justify-center text-red-500" title="Urgente"><ChevronsUp size={14} /></div>
                    {t.dueDate && (() => {
                      const [, m, d] = t.dueDate.split('-');
                      const isOverdue = t.status !== 'done' && t.dueDate < today.toISOString().split('T')[0];
                      return <span className={`text-[9px] font-mono shrink-0 ${isOverdue ? 'text-red-400' : 'text-zinc-300'}`}>{d}/{m}</span>;
                    })()}
                    <div onClick={(e) => e.stopPropagation()}>
                      <DatePicker
                        value={t.reminderDate || ''}
                        align="right"
                        disableAutoScroll
                        onChange={(date) => { onUpdateTask?.({ ...t, reminderDate: date || undefined }); }}
                        enableTime={true}
                        onQuickAdd={() => { const d = new Date(); d.setDate(d.getDate() + 1); onUpdateTask?.({ ...t, reminderDate: `${d.toISOString().split('T')[0]}T09:00` }); }}
                        trigger={
                          <button type="button" className={`shrink-0 transition-colors ${t.reminderDate ? 'text-amber-400' : 'text-zinc-700 hover:text-zinc-500'}`} title={t.reminderDate ? 'Desativar lembrete' : 'Ativar lembrete'}>
                            <Bell size={12} className={t.reminderDate ? 'fill-amber-400' : ''} />
                          </button>
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Próximos prazos */}
          <div className="flex flex-col bg-[#121214] border border-zinc-900 rounded-xl overflow-hidden shadow-sm shadow-black/20">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-900 bg-[#08080a]">
              <div className="flex items-center gap-2 text-zinc-400 font-bold text-[10px] uppercase tracking-[0.15em]">
                <Calendar size={12} className="text-zinc-500" /> Próximos prazos
              </div>
              <button className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider font-semibold">Ver todas</button>
            </div>
            <div className="flex flex-col p-2 gap-1 min-h-[250px] max-h-[350px] overflow-y-auto custom-scrollbar">
              {proximosPrazos.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-10 opacity-70">
                  <span className="text-xs">Tudo em dia!</span>
                </div>
              ) : proximosPrazos.map((t) => {
                const primaryLabelId = t.labels?.length > 0 ? t.labels[0].id : null;
                const primaryLabelData = primaryLabelId ? labels?.find(l => l.id === primaryLabelId) : null;
                const themeTextColor = primaryLabelData ? (primaryLabelData.color.match(/text-[a-z]+-\d+/) || ['text-zinc-500'])[0] : 'text-zinc-500';
                
                let ThemeIcon: any = TagIcon;
                if (primaryLabelData?.name === 'Design') ThemeIcon = PenTool;
                else if (primaryLabelData?.name === 'Copy') ThemeIcon = Type;
                else if (primaryLabelData?.name === 'Tarefa') ThemeIcon = CheckSquare;
                else if (primaryLabelData?.name === 'Orçamento') ThemeIcon = DollarSign;
                else if (primaryLabelData?.name === 'Social Media') ThemeIcon = Share2;
                
                const isDelayed = new Date(t.dueDate!) < today;

                return (
                  <div key={t.id} onClick={() => onSelectTask?.(t)} className={`group flex items-center gap-2 hover:bg-[#161619] border rounded-md px-2.5 py-1.5 transition-all duration-150 cursor-pointer ${isDelayed ? 'bg-red-500/5 border-red-500/20' : 'bg-[#121214] border-zinc-900/60 hover:border-zinc-800'}`}>
                    <div className={`shrink-0 ${themeTextColor}`}><ThemeIcon size={12} /></div>
                    <span className="flex-1 text-[11px] font-medium text-zinc-200 truncate min-w-0" title={t.title}>
                      {t.title.length > 35 ? t.title.slice(0, 35) + '…' : t.title}
                    </span>
                    {t.priority === 'urgent' && <div className="shrink-0 flex items-center justify-center text-red-500" title="Urgente"><ChevronsUp size={14} /></div>}
                    {t.priority === 'high' && <div className="shrink-0 flex items-center justify-center text-orange-400" title="Alta"><ChevronUp size={14} /></div>}
                    {t.priority === 'medium' && <div className="shrink-0 flex items-center justify-center text-blue-500" title="Média"><Minus size={14} /></div>}
                    {t.priority === 'low' && <div className="shrink-0 flex items-center justify-center text-emerald-500" title="Baixa"><ChevronDown size={14} /></div>}
                    {t.dueDate && (() => {
                      const [, m, d] = t.dueDate.split('-');
                      return <span className={`text-[9px] font-mono shrink-0 ${isDelayed ? 'text-red-400 font-bold' : 'text-zinc-300'}`}>{d}/{m}</span>;
                    })()}
                    <div onClick={(e) => e.stopPropagation()}>
                      <DatePicker
                        value={t.reminderDate || ''}
                        align="right"
                        disableAutoScroll
                        onChange={(date) => { onUpdateTask?.({ ...t, reminderDate: date || undefined }); }}
                        enableTime={true}
                        onQuickAdd={() => { const d = new Date(); d.setDate(d.getDate() + 1); onUpdateTask?.({ ...t, reminderDate: `${d.toISOString().split('T')[0]}T09:00` }); }}
                        trigger={
                          <button type="button" className={`shrink-0 transition-colors ${t.reminderDate ? 'text-amber-400' : 'text-zinc-700 hover:text-zinc-500'}`} title={t.reminderDate ? 'Desativar lembrete' : 'Ativar lembrete'}>
                            <Bell size={12} className={t.reminderDate ? 'fill-amber-400' : ''} />
                          </button>
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          </div>

          {/* AGENDAMENTO SEMANAL NO MODO ALERTAS */}
          <div className="mt-4">
            <WeeklyPlanner tasks={myTasks} onUpdateTask={onUpdateTask} onSelectTask={onSelectTask} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
    </div>
  );
}
