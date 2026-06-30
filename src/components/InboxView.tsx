import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, Bell, CheckCircle, Clock, AlertCircle, Eye, Star, Trash2, AlertTriangle, Calendar, X, Check, Archive, Activity, Timer, ChevronRight, Filter, Undo2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Task, Project } from '../types';

const statusMap: Record<string, string> = { no_forecast: 'Sem Previsão', todo: 'A Fazer', in_progress: 'Em Andamento', paused: 'Pausado', approval: 'Aprovação', rework: 'Refação', implementation: 'Implementação', done: 'Concluído' };

const formatMsToTime = (ms: number) => {
  if (isNaN(ms) || ms === 0) return '--';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
};

interface InboxViewProps {
  tasks: Task[];
  projects: Project[];
  onSelectTask: (task: Task) => void;
}

export default function InboxView({ tasks, projects, onSelectTask }: InboxViewProps) {
  const { currentUser } = useAuth();
  const { notifications, markAsRead, markAsViewed, markAllAsViewed, unarchive, postpone, markAsImportant, clearAll, clearArchived } = useNotifications();

  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const getIconForType = (type: string) => {
    const props = { size: 14, className: "text-zinc-500 shrink-0" };
    switch (type) {
      case 'task_assigned': return <CheckCircle {...props} />;
      case 'task_deleted': return <Trash2 {...props} />;
      case 'status_changed': return <Bell {...props} />;
      case 'assignee_replaced': return <AlertCircle {...props} />;
      case 'properties_changed': return <Bell {...props} />;
      case 'feedback_received': return <AlertTriangle {...props} />;
      case 'rejected': return <X {...props} />;
      case 'review_requested': return <AlertTriangle {...props} />;
      case 'approval_pending': return <AlertTriangle {...props} />;
      case 'approved': return <Check {...props} />;
      case 'reminder': return <Bell {...props} className="text-zinc-500 shrink-0 fill-zinc-500" />;
      case 'deadline': return <Calendar {...props} />;
      case 'deadline_changed': return <Calendar {...props} />;
      default: return <Bell {...props} />;
    }
  };

  const [isProjectOpen, setIsProjectOpen] = useState(false);

  const notificationTypes = [
    { value: 'all', label: 'Todos os tipos', icon: Inbox },
    { value: 'deadline', label: 'Prazos', icon: Calendar },
    { value: 'reminder', label: 'Lembretes', icon: Bell },
    { value: 'status_changed', label: 'Status Alterado', icon: Bell },
    { value: 'review_requested', label: 'Revisão Solicitada', icon: AlertTriangle },
    { value: 'approved', label: 'Aprovados', icon: CheckCircle },
    { value: 'rejected', label: 'Reprovados', icon: X }
  ];

  const myNotifications = notifications.filter(n => {
    if (n.userId !== currentUser?.id) return false;
    
    // Type Filter
    if (filterType !== 'all') {
      if (filterType === 'deadline' && !['deadline', 'deadline_changed'].includes(n.type)) return false;
      else if (filterType !== 'deadline' && n.type !== filterType) return false;
    }

    // Project Filter
    if (filterProject !== 'all') {
      const task = tasks.find(t => t.id === n.taskId);
      if (!task || task.projectId !== filterProject) return false;
    }

    return true;
  });
  
  // Sort notifications: unread first, then by date descending
  const allActive = myNotifications
    .filter(n => n.status !== 'viewed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
  const isPostponedNotif = (n: any) => n.status === 'postponed' && (!n.postponedUntil || new Date() < new Date(n.postponedUntil));
  const regularActive = allActive.filter(n => !isPostponedNotif(n));
  const postponedActive = allActive.filter(n => isPostponedNotif(n));
    
  const archivedNotifications = myNotifications
    .filter(n => n.status === 'viewed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const renderNotificationCard = (n: any, isArchived: boolean = false) => {
    const task = tasks.find(t => t.id === n.taskId);
    const isUnread = n.status === 'unread';
    const isRead = n.status === 'read';
    const isImportant = n.status === 'important';
    const isPostponed = n.status === 'postponed';

    let titlePart = n.message;
    let descPart = n.details || '';
    if (n.message.includes(':')) {
      const parts = n.message.split(':');
      titlePart = parts[0].trim();
      const rest = parts.slice(1).join(':').trim();
      descPart = rest + (descPart ? ' - ' + descPart : '');
    }

    let viewTimeStr = '';
    if (isArchived && n.viewedAt && n.createdAt) {
      const created = new Date(n.createdAt).getTime();
      const viewed = new Date(n.viewedAt).getTime();
      const diffMs = viewed - created;
      if (diffMs >= 0) {
        viewTimeStr = formatMsToTime(diffMs);
      }
    }

    return (
      <motion.div 
        layout
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        key={n.id}
        className={`group relative flex flex-col px-3 py-2.5 border-b border-zinc-800/40 hover:bg-[#121214] transition-colors cursor-pointer ${
          isArchived ? 'opacity-50 hover:opacity-100' : isRead ? 'opacity-70 hover:opacity-100' : ''
        } ${isImportant ? 'bg-amber-500/5 hover:bg-amber-500/10' : ''}`}
        onClick={() => {
          if (!isArchived && isUnread) markAsRead(n.id);
          if (task && onSelectTask) {
            onSelectTask(task);
            if (n.type === 'rejected' || n.type === 'review_requested' || n.type === 'approval_pending' || n.type === 'approved') {
              setTimeout(() => {
                let sectionName = 'attachments';
                if (n.targetId?.startsWith('copy-')) sectionName = 'copyProps';
                else if (n.targetId?.startsWith('budget-')) sectionName = 'budgetProps';
                else if (n.targetId?.startsWith('design-')) sectionName = 'designProps';

                const event = new CustomEvent('openTaskSection', { detail: { section: sectionName, targetId: n.targetId } });
                window.dispatchEvent(event);
              }, 100);
            } else if (n.type === 'task_assigned') {
              setTimeout(() => {
                const event = new CustomEvent('openTaskSection', { detail: { section: 'checklist', targetId: n.targetId } });
                window.dispatchEvent(event);
              }, 100);
            } else if (n.type === 'reminder') {
              setTimeout(() => {
                const isSubtaskReminder = (n.targetId && n.targetId !== 'reminder' && n.targetId !== n.taskId) || n.message === 'Lembrete Acionado';
                const sectionName = isSubtaskReminder ? 'checklist' : 'reminder';
                const event = new CustomEvent('openTaskSection', { detail: { section: sectionName, targetId: n.targetId } });
                window.dispatchEvent(event);
              }, 100);
            } else if (n.type === 'deadline' || n.type === 'deadline_changed') {
              setTimeout(() => {
                const event = new CustomEvent('openTaskSection', { detail: { section: 'deadline', targetId: 'deadline' } });
                window.dispatchEvent(event);
              }, 100);
            }
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 flex-1 overflow-hidden">
            <div className={`mt-[2px] ${isUnread && !isArchived ? 'text-blue-400' : isImportant ? 'text-amber-400' : isPostponed ? 'text-blue-500' : ''}`}>
              {getIconForType(n.type)}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[13px] font-medium leading-tight truncate ${isUnread || isImportant ? 'text-zinc-200' : 'text-zinc-400'}`}>
                  {titlePart}
                </span>
                {isUnread && !isArchived && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
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

          <div className="flex flex-col items-end shrink-0 gap-1.5 pt-0.5">
            {!isPostponedNotif(n) && (
              <span className="text-[10px] text-zinc-500 font-medium">
                {new Date(n.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
            )}
            {viewTimeStr && (
              <span className="text-[9px] text-zinc-500 bg-zinc-900/50 px-1.5 py-0.5 rounded border border-zinc-800/60 flex items-center gap-1 shrink-0" title="Tempo até o visto">
                <Timer size={8} /> {viewTimeStr}
              </span>
            )}
          </div>
        </div>

        {/* Minimal Actions overlay for Active only */}
        {!isArchived && (
          <div className={`absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-0.5 transition-opacity bg-[#121214] pl-2 py-1 rounded-l-md shadow-[-10px_0_15px_#121214] ${isPostponed ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => markAsViewed(n.id)} className="p-1.5 text-zinc-500 hover:text-emerald-400 rounded transition-colors" title="Marcar como Arquivado (Visto)">
              <CheckCircle size={14} />
            </button>
            <button onClick={() => postpone(n.id)} className={`p-1.5 rounded transition-colors ${isPostponed ? 'text-blue-400' : 'text-zinc-500 hover:text-blue-400'}`} title="Adiar">
              <Clock size={14} className={isPostponed ? "fill-blue-400/20" : ""} />
            </button>
            <button onClick={() => markAsImportant(n.id)} className={`p-1.5 rounded transition-colors ${isImportant ? 'text-amber-400' : 'text-zinc-500 hover:text-amber-400'}`} title="Importante">
              <Star size={14} className={isImportant ? "fill-amber-400" : ""} />
            </button>
          </div>
        )}

        {/* Minimal Actions overlay for Archived only */}
        {isArchived && (
          <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[#121214] pl-2 py-1 rounded-l-md shadow-[-10px_0_15px_#121214]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => unarchive(n.id)} className="p-1.5 text-zinc-500 hover:text-amber-400 rounded transition-colors" title="Retornar para Ativas">
              <Undo2 size={14} />
            </button>
          </div>
        )}
      </motion.div>
    );
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    
    let totalViewTime = 0;
    let countAll = 0;
    let totalViewTime7d = 0;
    let count7d = 0;
    let totalViewTime30d = 0;
    let count30d = 0;

    // Chart Data Preparation (Last 7 days)
    const chartDataMap = new Map();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * dayMs);
      const key = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      chartDataMap.set(key, { date: key, label: dayName, value: 0 });
    }

    archivedNotifications.forEach(n => {
      // Metrics
      if (n.viewedAt && n.createdAt) {
        const created = new Date(n.createdAt).getTime();
        const viewed = new Date(n.viewedAt).getTime();
        const diffMs = viewed - created;
        if (diffMs >= 0) {
          totalViewTime += diffMs;
          countAll++;
          const daysAgo = (now.getTime() - viewed) / dayMs;
          if (daysAgo <= 7) {
            totalViewTime7d += diffMs;
            count7d++;
          }
          if (daysAgo <= 30) {
            totalViewTime30d += diffMs;
            count30d++;
          }
        }
      }

      // Chart values
      if (n.viewedAt) {
        const key = n.viewedAt.split('T')[0];
        if (chartDataMap.has(key)) {
          const item = chartDataMap.get(key);
          item.value += 1;
        }
      }
    });

    const chartData = Array.from(chartDataMap.values());
    const maxChartValue = Math.max(...chartData.map(d => d.value), 5); // at least 5 for scale

    return {
      avgAll: formatMsToTime(countAll > 0 ? totalViewTime / countAll : 0),
      avg7d: formatMsToTime(count7d > 0 ? totalViewTime7d / count7d : 0),
      avg30d: formatMsToTime(count30d > 0 ? totalViewTime30d / count30d : 0),
      totalArchived: archivedNotifications.length,
      totalActive: allActive.length,
      chartData,
      maxChartValue
    };
  }, [archivedNotifications, allActive]);



  return (
    <div className="flex-1 flex flex-col h-full bg-[#08080a] text-zinc-100 font-sans">
      <header className="px-6 py-4 border-b border-zinc-800/40 shrink-0 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Inbox size={18} className="text-zinc-400" />
                Caixa de Entrada
              </h1>
              <p className="text-[13px] text-zinc-500 mt-0.5">
                Gestão de alertas e métricas de resposta.
              </p>
            </div>
            
            <div className="w-px h-8 bg-zinc-800 hidden md:block"></div>

            {/* Custom Project Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsProjectOpen(!isProjectOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-zinc-800/50 transition-colors text-[13px] text-zinc-300 font-medium border border-transparent hover:border-zinc-800/60"
              >
                <Filter size={14} className="text-zinc-500" />
                {filterProject === 'all' ? 'Empreendimentos' : projects.find(p => p.id === filterProject)?.name || 'Empreendimentos'}
              </button>

              {isProjectOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProjectOpen(false)} />
                  <div className="absolute top-full mt-1 left-0 w-64 bg-[#121214] border border-zinc-800/60 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                    <button 
                      onClick={() => { setFilterProject('all'); setIsProjectOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-[13px] hover:bg-zinc-800/50 transition-colors ${filterProject === 'all' ? 'text-zinc-100 bg-zinc-800/30' : 'text-zinc-400'}`}
                    >
                      Todos os Empreendimentos
                    </button>
                    {projects.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => { setFilterProject(p.id); setIsProjectOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-[13px] hover:bg-zinc-800/50 transition-colors ${filterProject === p.id ? 'text-zinc-100 bg-zinc-800/30' : 'text-zinc-400'}`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {myNotifications.length > 0 && (
            <button 
              onClick={clearAll}
              className="text-[11px] px-3 py-1.5 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded hover:bg-zinc-800/50 transition-colors"
            >
              Limpar tudo
            </button>
          )}
        </div>

        {/* Type Filters (Segmented Pills) */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
          {notificationTypes.map(t => {
            const Icon = t.icon;
            const active = filterType === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setFilterType(t.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all shrink-0 ${
                  active ? 'bg-zinc-200 text-zinc-900 shadow-sm' : 'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-zinc-800/60'
                }`}
              >
                {Icon && <Icon size={12} className={active ? 'text-zinc-700' : 'text-zinc-500'} />}
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 p-6 overflow-hidden">
        {/* Full width container, 12 columns grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full w-full">
          
          {/* Coluna 1: Ativas (3 colunas de 12) */}
          <div className="lg:col-span-3 flex flex-col h-full bg-transparent border border-zinc-800/40 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/40 bg-[#0c0c0e] flex items-center justify-between shrink-0">
              <h3 className="text-[13px] font-semibold text-zinc-300 flex items-center gap-2">
                Ativas
              </h3>
              <div className="flex items-center gap-2">
                {allActive.length > 0 && (
                  <button
                    onClick={markAllAsViewed}
                    className="p-1 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 rounded transition-colors"
                    title="Marcar todas como visto"
                  >
                    <Check size={12} />
                  </button>
                )}
                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded">{allActive.length}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a0a0c]">
              {allActive.length === 0 ? (
                <p className="text-center text-zinc-600 text-xs mt-10">Tudo limpo por aqui.</p>
              ) : (
                <div className="flex flex-col">
                  <AnimatePresence mode="popLayout">
                    {regularActive.map(n => renderNotificationCard(n, false))}
                  </AnimatePresence>
                  
                  {postponedActive.length > 0 && (
                    <motion.div layout>
                      <div className="px-4 py-2 mt-2 mb-1 flex items-center gap-3">
                        <div className="h-px bg-zinc-800/60 flex-1"></div>
                        <span className="text-[10px] font-bold tracking-widest text-blue-500 uppercase">Adiadas</span>
                        <div className="h-px bg-zinc-800/60 flex-1"></div>
                      </div>
                      <AnimatePresence mode="popLayout">
                        {postponedActive.map(n => renderNotificationCard(n, false))}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Coluna 2: Arquivadas (4 colunas de 12) */}
          <div className="lg:col-span-4 flex flex-col h-full bg-transparent border border-zinc-800/40 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/40 bg-[#0c0c0e] flex items-center justify-between shrink-0">
              <h3 className="text-[13px] font-semibold text-zinc-400 flex items-center gap-2">
                Arquivadas
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded">{archivedNotifications.length}</span>
                {archivedNotifications.length > 0 && (
                  <button 
                    onClick={clearArchived}
                    className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                    title="Excluir todas as arquivadas"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a0a0c]">
              {archivedNotifications.length === 0 ? (
                <p className="text-center text-zinc-600 text-xs mt-10">Nenhum histórico recente.</p>
              ) : (
                <div className="flex flex-col">
                  <AnimatePresence mode="popLayout">
                    {archivedNotifications.map(n => renderNotificationCard(n, true))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Coluna 3: Dashboard (5 colunas de 12) */}
          <div className="lg:col-span-5 flex flex-col h-full bg-transparent rounded-lg overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 pr-2">
              
              {/* KPIs Header */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0c0c0e] p-4 rounded-lg border border-zinc-800/40 flex flex-col gap-1">
                  <span className="text-xs text-zinc-500 font-medium tracking-wide">Aguardando Ação</span>
                  <span className="text-2xl font-semibold text-zinc-100">{metrics.totalActive}</span>
                </div>
                <div className="bg-[#0c0c0e] p-4 rounded-lg border border-zinc-800/40 flex flex-col gap-1">
                  <span className="text-xs text-zinc-500 font-medium tracking-wide">Resolvidas</span>
                  <span className="text-2xl font-semibold text-zinc-100">{metrics.totalArchived}</span>
                </div>
              </div>

              {/* Chart Section */}
              <div className="bg-[#0c0c0e] p-5 rounded-lg border border-zinc-800/40">
                <h4 className="text-[13px] font-semibold text-zinc-300 mb-6 flex items-center justify-between">
                  Volume de Resoluções (7 dias)
                  <Activity size={14} className="text-zinc-500" />
                </h4>
                
                {/* SVG/CSS Minimal Bar Chart */}
                <div className="flex items-end justify-between h-40 mt-4 gap-2">
                  {metrics.chartData.map((d, i) => {
                    const heightPercent = Math.max((d.value / metrics.maxChartValue) * 100, 2);
                    return (
                      <div key={i} className="flex flex-col items-center flex-1 gap-2 group">
                        <div className="relative w-full flex justify-center h-full items-end">
                          <div 
                            className="w-full max-w-[28px] bg-zinc-800 group-hover:bg-zinc-600 rounded-sm transition-all duration-300 relative"
                            style={{ height: `${heightPercent}%` }}
                          >
                            {/* Tooltip on hover */}
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-zinc-800 text-zinc-200 text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none transition-opacity z-10">
                              {d.value}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Averages Section */}
              <div className="bg-[#0c0c0e] p-5 rounded-lg border border-zinc-800/40">
                <h4 className="text-[13px] font-semibold text-zinc-300 mb-4 flex items-center justify-between">
                  Tempo Médio de Visualização
                  <Timer size={14} className="text-zinc-500" />
                </h4>
                
                <div className="flex flex-col">
                  <div className="flex items-center justify-between py-3 border-b border-zinc-800/40">
                    <span className="text-[12px] text-zinc-400">Últimos 7 dias</span>
                    <span className="text-[13px] font-mono text-zinc-200">{metrics.avg7d}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-zinc-800/40">
                    <span className="text-[12px] text-zinc-400">Últimos 30 dias</span>
                    <span className="text-[13px] font-mono text-zinc-200">{metrics.avg30d}</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-[12px] text-zinc-400">Geral (Desde o início)</span>
                    <span className="text-[13px] font-mono text-zinc-200">{metrics.avgAll}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
