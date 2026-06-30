import React, { useState, useEffect, useRef } from 'react';
import { 
  Columns3, 
  List, 
  FolderKanban, 
  Calendar as CalendarIcon, 
  Settings as SettingsIcon,
  Moon,
  Sun,
  X,
  Sidebar as SidebarTriggerIcon,
  ChevronsRight,
  Filter,
  Sparkles,
  Loader2,
  Layers
} from 'lucide-react';

import { useAuth } from './context/AuthContext';
import { useNotifications } from './context/NotificationContext';
import Login from './components/Login';

import { Task, Project, Label, ViewType, SiengeTitle, SiengeLote } from './types';
import { fetchTasks, fetchProjects, fetchLabels, saveTask, deleteTask, saveProject, fetchSiengeTitles, saveSiengeTitle, deleteSiengeTitle, fetchSiengeLotes, saveSiengeLote, deleteSiengeLote } from './lib/api';
import { supabase } from './lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncManager } from './lib/SyncManager';

import Sidebar from './components/Sidebar';
import CommandBar from './components/CommandBar';
import TaskSheet from './components/TaskSheet';
import KanbanView from './components/KanbanView';
import ListView from './components/ListView';
import CalendarView from './components/CalendarView';
import ProjectsView from './components/ProjectsView';
import SettingsView from './components/SettingsView';
import InboxView from './components/InboxView';
import ConfirmModal from './components/ConfirmModal';
import SiengeView from './components/SiengeView';
import DashboardView from './components/DashboardView';
import HomeView from './components/HomeView';

export default function App() {
  const { currentUser, loading, updateProfile } = useAuth();
  const { addNotification } = useNotifications();
  const previousTasksRef = useRef<Task[]>([]);
  const isFirstRender = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Navigation Routing states
  const [activeView, setActiveView] = useState<ViewType>('home');
  const [activeTaskViewType, setActiveTaskViewType] = useState<'board' | 'list'>('board');
  const [collapsed, setCollapsed] = useState(false);

  // Database core states using React Query
  const queryClient = useQueryClient();
  const syncManager = useSyncManager();

  const queryFnTasks = async () => {
    const freshTasks = await fetchTasks();
    const oldTasks = queryClient.getQueryData<Task[]>(['tasks']);
    if (!oldTasks) return freshTasks;

    const merged = freshTasks.map(freshTask => {
      const oldTask = oldTasks.find(t => t.id === freshTask.id);
      if (!oldTask) return freshTask;
      
      const preserved = { ...freshTask };
      (Object.keys(freshTask) as (keyof Task)[]).forEach(key => {
        if (syncManager.isFieldDirty(freshTask.id, key)) {
            // @ts-ignore
            preserved[key] = oldTask[key];
        }
      });
      return preserved;
    });

    // Preserve locally created tasks that haven't appeared in the DB yet
    oldTasks.forEach(oldTask => {
      if ((oldTask as any)._isLocal && !freshTasks.some(ft => ft.id === oldTask.id)) {
        merged.push(oldTask);
      }
    });

    return merged;
  };

  const { data: tasks = [], isLoading: isTasksLoading } = useQuery({ queryKey: ['tasks'], queryFn: queryFnTasks });
  const { data: projects = [], isLoading: isProjectsLoading } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects });
  const { data: labels = [], isLoading: isLabelsLoading } = useQuery({ queryKey: ['labels'], queryFn: fetchLabels });
  const { data: siengeTitles = [], isLoading: isSiengeLoading } = useQuery({ queryKey: ['siengeTitles'], queryFn: fetchSiengeTitles });
  const { data: siengeLotes = [], isLoading: isLotesLoading } = useQuery({ queryKey: ['siengeLotes'], queryFn: fetchSiengeLotes });

  const isDataLoading = isTasksLoading || isProjectsLoading || isLabelsLoading || isSiengeLoading || isLotesLoading;
  
  // Custom Confirm Modal state for task sheet closure
  const [confirmModalData, setConfirmModalData] = useState<{
    isOpen: boolean; 
    taskId: string | null;
    message?: string;
    missingFields?: string[];
  }>({isOpen: false, taskId: null});
  
  // Selecting & filtering active scopes
  const [currentProjectFilter, setCurrentProjectFilter] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Modal togglers
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [socialMediaFilter, setSocialMediaFilter] = useState(false);

  // Setup realtime
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        // Re-fetch on any data changes to keep all clients perfectly synced
        // Debounce to prevent flashing UI when saveTask triggers multiple quick inserts/deletes
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.invalidateQueries({ queryKey: ['labels'] });
          queryClient.invalidateQueries({ queryKey: ['siengeTitles'] });
          queryClient.invalidateQueries({ queryKey: ['siengeLotes'] });
        }, 1500);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Track task changes to generate notifications
  useEffect(() => {
    if (isFirstRender.current || !currentUser) {
      isFirstRender.current = false;
      previousTasksRef.current = tasks;
      return;
    }

    const prevTasks = previousTasksRef.current;
    
    // Check for deleted tasks where I was the assignee
    tasks.forEach(task => {
      const prevTask = prevTasks.find(pt => pt.id === task.id);
      
      // New task assigned to someone else
      if (!prevTask && task.assigneeId && task.assigneeId !== currentUser.id) {
        addNotification({
          userId: task.assigneeId,
          actorId: currentUser.id,
          taskId: task.id,
          targetId: 'assignee',
          type: 'task_assigned',
          message: 'Nova Atribuição',
          details: `Você foi designado para esta tarefa`
        });
        return;
      }

      if (prevTask) {
        // Was someone else, now assigned to me (wait, if currentUser assigned it to themselves? No, we check target)
        // If the task is assigned to a NEW user, and the CURRENT USER doing it is NOT that new user
        if (prevTask.assigneeId !== task.assigneeId && task.assigneeId && task.assigneeId !== currentUser.id) {
          addNotification({
            userId: task.assigneeId,
            actorId: currentUser.id,
            taskId: task.id,
            targetId: 'assignee',
            type: 'task_assigned',
            message: 'Nova Atribuição',
            details: `A tarefa foi atribuída a você`
          });
        }

        // Status changed to paused or done
        if (prevTask.status !== task.status && (task.status === 'paused' || task.status === 'done')) {
          // Only notify if the person making the change (currentUser) is NOT the assignee
          if (task.assigneeId && task.assigneeId !== currentUser.id) {
            const statusMap: Record<string, string> = { no_forecast: 'Sem Previsão', todo: 'A Fazer', in_progress: 'Em Andamento', paused: 'Pausado', approval: 'Aprovação', rework: 'Refação', implementation: 'Implementação', done: 'Concluído' };
            const oldS = statusMap[prevTask.status] || prevTask.status;
            const newS = statusMap[task.status] || task.status;
            
            addNotification({
              userId: task.assigneeId,
              actorId: currentUser.id,
              taskId: task.id,
              type: 'status_changed',
              message: 'Status Alterado',
              details: `${oldS} > ${newS}`
            });
          }
        }

        // Due date changed by someone else
        if (prevTask.dueDate !== task.dueDate) {
          if (task.assigneeId && task.assigneeId !== currentUser.id) {
            addNotification({
              userId: task.assigneeId,
              actorId: currentUser.id,
              taskId: task.id,
              targetId: 'deadline',
              type: 'deadline_changed',
              message: 'Prazo Alterado',
              details: task.dueDate ? `O prazo da sua tarefa foi alterado para ${task.dueDate.split('-').reverse().join('/')}` : 'A tarefa agora não possui previsão'
            });
          }
        }
      }
    });

    previousTasksRef.current = tasks;
  }, [tasks, currentUser]);

  // Deadline and reminder checks
  useEffect(() => {
    if (!currentUser) return;
    const checkReminders = () => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      // Read triggered reminders from user preferences (synced with Supabase)
      let triggeredReminders: string[] = currentUser.preferences?.triggeredReminders || [];
      
      let hasNewTriggers = false;
      
      tasks.filter(t => t.assigneeId === currentUser.id && t.status !== 'done').forEach(task => {
        // Check due date relative to today
        if (task.dueDate) {
          const due = new Date(task.dueDate + 'T00:00:00');
          due.setHours(0,0,0,0);
          const todayDate = new Date();
          todayDate.setHours(0,0,0,0);
          
          const diffTime = due.getTime() - todayDate.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

          let message = '';
          let details = '';
          let deadlineKey = '';

          const createdAtDate = new Date(task.createdAt.split('T')[0] + 'T00:00:00');
          createdAtDate.setHours(0,0,0,0);
          const totalDurationDays = Math.round((due.getTime() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays === 3 && totalDurationDays > 3) {
            message = 'Prazo em 3 dias';
            details = `O prazo da tarefa se encerra em 3 dias`;
            deadlineKey = `deadline_${task.id}_3d_${task.dueDate}`;
          } else if (diffDays === 1) {
            message = 'Prazo Amanhã';
            details = `O prazo da tarefa se encerra amanhã`;
            deadlineKey = `deadline_${task.id}_1d_${task.dueDate}`;
          } else if (diffDays === 0) {
            message = 'Prazo Vencendo Hoje';
            details = `O prazo desta tarefa vence hoje`;
            deadlineKey = `deadline_${task.id}_0d_${task.dueDate}`;
          } else if (diffDays === -3) {
            message = 'Prazo Atrasado (3 dias)';
            details = `A tarefa está 3 dias atrasada`;
            deadlineKey = `deadline_${task.id}_-3d_${task.dueDate}`;
          } else if (diffDays === -7) {
            message = 'Prazo Atrasado (7 dias)';
            details = `A tarefa está 7 dias atrasada`;
            deadlineKey = `deadline_${task.id}_-7d_${task.dueDate}`;
          } else if (diffDays === -15) {
            message = 'Prazo Atrasado (15 dias)';
            details = `A tarefa está 15 dias atrasada`;
            deadlineKey = `deadline_${task.id}_-15d_${task.dueDate}`;
          }

          // Only fire each deadline alert once per task+type+dueDate combination
          if (message && deadlineKey && !triggeredReminders.includes(deadlineKey)) {
            addNotification({
              userId: currentUser.id,
              actorId: 'system',
              taskId: task.id,
              targetId: 'deadline',
              type: 'deadline',
              message,
              details
            });
            triggeredReminders = [...triggeredReminders, deadlineKey];
            hasNewTriggers = true;
          }
        }

        // Check task reminder
        if (task.reminderDate) {
           const reminderTime = new Date(task.reminderDate).getTime();
           const reminderId = `task_${task.id}_${task.reminderDate}`;
           
           if (now.getTime() >= reminderTime && !triggeredReminders.includes(reminderId)) {
             addNotification({
               userId: currentUser.id,
               actorId: 'system',
               taskId: task.id,
               targetId: 'reminder',
               type: 'reminder',
               message: 'Lembrete de Tarefa',
               details: `O lembrete para a tarefa "${task.title}" foi acionado`
             });
             triggeredReminders = [...triggeredReminders, reminderId];
             hasNewTriggers = true;
           }
        }

        // Check subtask reminders
        task.subtasks.forEach(st => {
           if (st.reminderDate && !st.completed) {
             const reminderTime = new Date(st.reminderDate).getTime();
             const reminderId = `sub_${st.id}_${st.reminderDate}`;
             
             if (now.getTime() >= reminderTime && !triggeredReminders.includes(reminderId)) {
               addNotification({
                 userId: currentUser.id,
                 actorId: 'system',
                 taskId: task.id,
                 targetId: st.id,
                 type: 'reminder',
                 message: 'Lembrete Acionado',
                 details: `"${st.title}"`
               });
               triggeredReminders = [...triggeredReminders, reminderId];
               hasNewTriggers = true;
             }
           }
        });
      });

      // Check Sienge Titles reminders
      siengeTitles.filter(t => t.assigneeId === currentUser.id && t.status !== 'pago' && t.status !== 'recusados').forEach(title => {
        if (title.reminderDate) {
           const reminderTime = new Date(title.reminderDate).getTime();
           const reminderId = `sienge_${title.id}_${title.reminderDate}`;
           
           if (now.getTime() >= reminderTime && !triggeredReminders.includes(reminderId)) {
             addNotification({
               userId: currentUser.id,
               actorId: 'system',
               taskId: title.id,
               targetId: 'reminder',
               type: 'reminder',
               message: 'Lembrete de Título',
               details: `O lembrete para o título "${title.titulo}" foi acionado`
             });
             triggeredReminders = [...triggeredReminders, reminderId];
             hasNewTriggers = true;
           }
        }
      });

      // Check creative approvals for current user
      tasks.filter(t => t.status !== 'done').forEach(task => {
        task.designBriefing?.deliveries?.forEach((delivery, idx) => {
          if ((delivery.status === 'pending' || delivery.status === 'review_requested') && delivery.approverId === currentUser.id) {
            const markedTime = new Date(delivery.createdAt).getTime();
            const diffMs = now.getTime() - markedTime;
            const diffHours = diffMs / (1000 * 60 * 60);
            
            const milestones = [
              { id: '0h', hours: 0, label: 'Aprovação Pendente' },
              { id: '3h', hours: 3, label: 'Lembrete (3h): Aprovação Pendente' },
              { id: '1d', hours: 24, label: 'Atrasado (1 dia): Aprovação Pendente' },
              { id: '2d', hours: 48, label: 'Atrasado (2 dias): Aprovação Pendente' },
              { id: '3d', hours: 72, label: 'Atrasado (3 dias): Aprovação Pendente' },
              { id: '4d', hours: 96, label: 'Atrasado (4 dias): Aprovação Pendente' },
              { id: '5d', hours: 120, label: 'Atrasado (5 dias): Aprovação Pendente' },
              { id: '6d', hours: 144, label: 'Atrasado (6 dias): Aprovação Pendente' },
              { id: '7d', hours: 168, label: 'Atrasado (7 dias): Aprovação Pendente' },
            ];

            milestones.forEach(m => {
              const reminderId = `approval_${delivery.id}_${m.id}`;
              if (diffHours >= m.hours && !triggeredReminders.includes(reminderId)) {
                addNotification({
                  userId: currentUser.id,
                  actorId: 'system',
                  taskId: task.id,
                  type: 'approval_pending',
                  message: m.label,
                  details: `Criativo ${String(idx + 1).padStart(2, '0')} aguarda sua aprovação na tarefa "${task.title}"`
                });
                triggeredReminders = [...triggeredReminders, reminderId];
                hasNewTriggers = true;
              }
            });
          }
        });
      });
      
      if (hasNewTriggers) {
        // Persist to Supabase so it works across any device
        updateProfile({
          preferences: {
            ...currentUser.preferences,
            triggeredReminders
          }
        }).catch(console.error);
      }
    };
    
    const timeout = setTimeout(checkReminders, 5000); // Run 5 seconds after mount/update
    const interval = setInterval(checkReminders, 60000); // Check every minute

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [tasks, siengeTitles, currentUser]);

  // Bind Cmd+K and on-screen toggling listeners
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandBarOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsCommandBarOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  // Update selectedTask details live when the database copies alter
  useEffect(() => {
    if (selectedTask) {
      const refreshedTask = tasks.find(t => t.id === selectedTask.id);
      if (refreshedTask) {
        setSelectedTask(refreshedTask);
      }
    }
  }, [tasks, selectedTask?.id]);

  // Handle dark mode DOM properties class allocations
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      root.style.backgroundColor = '#08090a';
    } else {
      root.classList.remove('dark');
      root.style.backgroundColor = '#fafafa';
    }
  }, [isDarkMode]);

  // Queue for debouncing saveTask per task ID
  const saveTaskTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // TASK WORKFLOWS (CRUD)
  const handleUpdateTask = (updates: Partial<Task> & { id: string }) => {
    const targetTask = tasks.find(t => t.id === updates.id);
    if (!targetTask) return;
    
    const nowISO = new Date().toISOString();
    
    // Automation: Se o card ficar sem prazo, force para 'sem previsão'
    const finalDueDate = updates.hasOwnProperty('dueDate') ? updates.dueDate : targetTask.dueDate;
    if (!finalDueDate && targetTask.status !== 'done') {
      updates.status = 'no_forecast';
    }

    const ignoredFields = ['id', 'description', 'designBriefing', 'copyBriefing', 'planningBriefing'];
    const updateKeys = Object.keys(updates);
    const isSignificantUpdate = updateKeys.some(k => !ignoredFields.includes(k));

    if (isSignificantUpdate) {
      updates.updatedAt = nowISO;
    }

    // --- Status History & Time Tracking Logic ---
    if (updates.status && updates.status !== targetTask.status) {
      // Status History Update
      const history = [...(targetTask.statusHistory || [])];
      if (history.length > 0) {
        history[history.length - 1].leftAt = nowISO;
      } else if (targetTask.status) {
        history.push({
          status: targetTask.status,
          enteredAt: targetTask.createdAt || nowISO,
          leftAt: nowISO
        });
      }
      history.push({
        status: updates.status as any,
        enteredAt: nowISO
      });
      updates.statusHistory = history;

      const tt = targetTask.timeTracking ? { ...targetTask.timeTracking } : { accumulatedMs: 0, isTimerRunning: false };
      const nowMs = Date.now();

      const runStates = ['in_progress', 'rework'];
      const stopStates = ['implementation', 'done'];

      const isRunningNow = tt.isTimerRunning;
      const willRun = runStates.includes(updates.status);

      // Pause/Stop logic
      if (isRunningNow && !willRun) {
        const startedAtMs = tt.lastStartedAt ? new Date(tt.lastStartedAt).getTime() : nowMs;
        tt.accumulatedMs += Math.max(0, nowMs - startedAtMs);
        tt.isTimerRunning = false;
        tt.lastStartedAt = undefined;
      }

      // Start logic
      if (!isRunningNow && willRun) {
        tt.isTimerRunning = true;
        tt.lastStartedAt = nowISO;
      }

      if (stopStates.includes(updates.status)) {
        if (!tt.reachedImplementationAt) tt.reachedImplementationAt = nowISO;
      } else {
        tt.reachedImplementationAt = undefined;
      }

      updates.timeTracking = tt;
    }
    // ----------------------------
    
    // Determine if it's a text-heavy change requiring debounce
    const needsDebounce = Object.keys(updates).some(key => 
      ['description', 'title', 'chatMessages', 'designBriefing', 'copyBriefing', 'planningBriefing'].includes(key)
    );

    // Queue update via SyncManager
    syncManager.updateTask(updates.id, updates, { debounce: needsDebounce });

    // Update selectedTask details live immediately
    if (selectedTask?.id === updates.id) {
       setSelectedTask(prev => prev ? { ...prev, ...updates } as Task : null);
    }
  };

  const handleAddTask = (newTask: Task) => {
    queryClient.setQueryData<Task[]>(['tasks'], prev => [newTask, ...(prev || [])]);
    saveTask(newTask).catch(console.error);
  };

  const handleDeleteTask = (taskId: string) => {
    queryClient.setQueryData<Task[]>(['tasks'], prev => (prev || []).filter(t => t.id !== taskId));
    deleteTask(taskId).catch(console.error);
    if (selectedTask?.id === taskId) {
      setSelectedTask(null);
      setIsTaskSheetOpen(false);
      setConfirmModalData({ isOpen: false, taskId: null });
    }
  };

  const handleAddNewTaskPrompt = () => {
    const newTask: any = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      status: 'no_forecast',
      priority: 'medium',
      projectId: '',
      labels: [labels.find(l => l.name === 'Tarefa') || labels[0]].filter(Boolean) as Label[],
      subtasks: [],
      createdAt: new Date().toISOString().split('T')[0],
      assigneeId: currentUser?.id,
      _isLocal: true, // Flag to prevent queryFnTasks from dropping it before DB sync
    };

    handleAddTask(newTask as Task);
    setSelectedTask(newTask as Task);
    setIsTaskSheetOpen(true);
  };

  const handleCloseTaskSheet = (localTaskState?: any) => {
    if (isTaskSheetOpen && selectedTask) {
      const taskToCheck = localTaskState && !localTaskState.nativeEvent ? localTaskState : tasks.find(t => t.id === selectedTask.id);
      console.log('Validating task on close:', taskToCheck);
      if (taskToCheck) {
        const plainDesc = (taskToCheck.description || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
        const hasTitle = !!(taskToCheck.title && taskToCheck.title.trim());
        const hasDesc = !!plainDesc;
        const hasLabel = taskToCheck.labels && taskToCheck.labels.length > 0;
        const hasProject = !!taskToCheck.projectId;
        const hasAssignee = !!taskToCheck.assigneeId;
        console.log('Validation results:', { hasTitle, hasDesc, hasLabel, hasProject, hasAssignee, plainDesc });

        const missingFields: string[] = [];
        if (!hasTitle) missingFields.push('Nome da Tarefa');
        if (!hasDesc) missingFields.push('Descrição');
        if (!hasLabel) missingFields.push('Classe');
        if (!hasProject) missingFields.push('Empreendimento');
        if (!hasAssignee) missingFields.push('Responsável');

        if (missingFields.length > 0) {
           const formattedMessage = `Atenção: Os seguintes campos obrigatórios não foram preenchidos:\n\n${missingFields.map(f => `- ${f}`).join('\n')}\n\nSe você sair agora, a tarefa incompleta será EXCLUÍDA. Deseja realmente sair?`;
           setConfirmModalData({ 
             isOpen: true, 
             taskId: taskToCheck.id, 
             message: formattedMessage,
             missingFields
           });
           return;
        }
      }
    }
    setIsTaskSheetOpen(false);
    setSelectedTask(null);
    setConfirmModalData({ isOpen: false, taskId: null });
  };

  const handleAddProject = (newProject: Project) => {
    queryClient.setQueryData<Project[]>(['projects'], prev => [...(prev || []), newProject]);
    saveProject(newProject).catch(console.error);
  };

  const handleUpdateProject = (updatedProject: Project) => {
    queryClient.setQueryData<Project[]>(['projects'], prev => (prev || []).map(p => p.id === updatedProject.id ? updatedProject : p));
    saveProject(updatedProject).catch(console.error);
  };

  const handleResetDatabase = () => {
    // For Supabase, resetting the database requires a specific script, 
    // so we'll just alert for now or implement a truncate later.
    alert('Reset de banco de dados remoto não suportado nesta versão MVP.');
  };

  // Switch project trigger from other views safely
  const handleSelectProjectFilter = (projectId: string) => {
    setCurrentProjectFilter(projectId);
    setActiveView('tasks_board');
  };

  // Breadcrumbs text label parser
  const visibleTasks = tasks.filter(t => {
    let matches = true;
    if (currentProjectFilter) {
      matches = matches && t.projectId === currentProjectFilter;
    }
    if (socialMediaFilter) {
      matches = matches && t.labels.some(l => l.name === 'Social Media');
    }
    return matches;
  });

  const getBreadcrumbLabel = () => {
    switch (activeView) {
      case 'tasks_board':
        return activeTaskViewType === 'board' ? 'Quadro Kanban' : 'Lista Compacta';
      case 'projects':
        return 'Empreendimentos Globais';
      case 'calendar':
        return 'Calendário';
      case 'settings':
        return 'Ajustes';
      default:
        return 'Workspace';
    }
  };

  const activeProjectObject = projects.find(p => p.id === currentProjectFilter);

  // --- Main App Logic below ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080a] flex items-center justify-center">
        <Loader2 size={32} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  if (isDataLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#08080a] select-none">
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(99,102,241,0.15)] relative">
             <div className="absolute inset-0 rounded-2xl border-2 border-blue-500/30 border-t-blue-500 animate-spin"></div>
             <Layers className="text-blue-500" size={32} strokeWidth={1.5} />
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-200 tracking-tight">Preparando seu Workspace</h2>
            <p className="text-xs text-zinc-500 font-medium">Sincronizando tarefas, criativos e projetos...</p>
          </div>
          
          <div className="flex gap-1 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex overflow-hidden bg-[#08080a] ${isDarkMode ? 'dark text-zinc-100' : 'text-zinc-900 bg-zinc-50'}`}>
      
      {/* Collapsible Sidebar block */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        activeView={activeView}
        setActiveView={setActiveView}
        activeTaskViewType={activeTaskViewType}
        setActiveTaskViewType={setActiveTaskViewType}
        projects={projects}
        tasks={tasks}
        onOpenCommandBar={() => setIsCommandBarOpen(true)}
        onNewTask={handleAddNewTaskPrompt}
        currentProjectFilter={currentProjectFilter}
        setCurrentProjectFilter={setCurrentProjectFilter}
        onSelectTask={(task) => {
          setSelectedTask(task);
          setIsTaskSheetOpen(true);
        }}
      />

      {/* Main Container Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* Top Header navbar */}
        <header className="h-12 border-b border-zinc-900 px-6 flex items-center justify-between shrink-0 bg-[#08080a]/60 backdrop-blur-md z-10 select-none">
          <div className="flex items-center gap-3">
            <span className="text-zinc-500 text-[11px] font-semibold tracking-wider font-sans uppercase">Workspace</span>
            <span className="text-zinc-500 text-xs">/</span>
            
            {/* Breadcrumb indicator */}
            <span className="text-[11px] font-semibold text-zinc-200 tracking-tight flex items-center gap-1.5 font-sans">
              {getBreadcrumbLabel()}
            </span>

            {/* Active Project Filter box */}
            {currentProjectFilter && activeProjectObject && (
              <div className="hidden sm:flex items-center gap-1.5 ml-4 bg-zinc-900/60 text-zinc-300 border border-zinc-800/80 px-2 py-0.5 rounded-md text-[10px] font-sans font-medium">
                <span className={`w-1.5 h-1.5 rounded-full bg-current ${activeProjectObject.color}`} />
                <span>{activeProjectObject.name}</span>
                <button
                  onClick={() => setCurrentProjectFilter(null)}
                  className="hover:text-white transition-colors ml-1 text-zinc-400 font-bold"
                  title="Remover filtro"
                >
                  <X size={10} />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Mode switch helper triggers */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 rounded-md transition-colors border border-zinc-900 bg-zinc-950/40"
              title={isDarkMode ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
            >
              {isDarkMode ? <Sun size={13} className="text-amber-400" /> : <Moon size={13} />}
            </button>

            {/* Nova Tarefa right button */}
            <button
              onClick={handleAddNewTaskPrompt}
              className="hidden md:flex h-7 items-center gap-1.5 px-2.5 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-200 hover:text-white rounded-md transition-all active:scale-[0.98]"
            >
              <span>+ Novo Item</span>
            </button>
          </div>
        </header>

        {/* Dynamic Route views rendered here */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {activeView === 'home' && (
            <HomeView
              tasks={tasks}
              projects={projects}
              labels={labels}
              currentProjectFilter={currentProjectFilter}
              socialMediaFilter={socialMediaFilter}
              setSocialMediaFilter={setSocialMediaFilter}
              onUpdateTask={handleUpdateTask}
              onAddTask={handleAddTask}
              onSelectTask={(task) => {
                setSelectedTask(task);
                setIsTaskSheetOpen(true);
              }}
            />
          )}

          {activeView === 'inbox' && (
            <InboxView 
              projects={projects}
              onSelectTask={(task) => {
                setSelectedTask(task);
                setIsTaskSheetOpen(true);
              }}
              tasks={tasks}
            />
          )}

          {activeView === 'tasks_board' && activeTaskViewType === 'board' && (
            <KanbanView
              tasks={visibleTasks}
              projects={projects}
              labels={labels}
              onSelectTask={(task) => {
                setSelectedTask(task);
                setIsTaskSheetOpen(true);
              }}
              onUpdateTask={handleUpdateTask}
              onAddTask={handleAddTask}
              currentProjectFilter={currentProjectFilter}
              socialMediaFilter={socialMediaFilter}
              setSocialMediaFilter={setSocialMediaFilter}
            />
          )}

          {activeView === 'tasks_board' && activeTaskViewType === 'list' && (
            <ListView
              tasks={visibleTasks}
              projects={projects}
              labels={labels}
              onSelectTask={(task) => {
                setSelectedTask(task);
                setIsTaskSheetOpen(true);
              }}
              onUpdateTask={handleUpdateTask}
              onAddTask={handleAddTask}
              currentProjectFilter={currentProjectFilter}
            />
          )}

          {activeView === 'calendar' && (
            <CalendarView
              tasks={visibleTasks}
              projects={projects}
              labels={labels}
              onSelectTask={(task) => {
                setSelectedTask(task);
                setIsTaskSheetOpen(true);
              }}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              currentProjectFilter={currentProjectFilter}
              socialMediaFilter={socialMediaFilter}
              setSocialMediaFilter={setSocialMediaFilter}
            />
          )}

          {activeView === 'projects' && (
            <ProjectsView
              projects={projects}
              tasks={tasks}
              onSelectProjectFilter={handleSelectProjectFilter}
              onAddProject={handleAddProject}
              onUpdateProject={handleUpdateProject}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              isDarkMode={isDarkMode}
              onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
              onResetMockData={handleResetDatabase}
            />
          )}

          {activeView === 'sienge' && (
            <SiengeView
              titles={siengeTitles}
              lotes={siengeLotes}
              projects={projects}
              currentProjectFilter={currentProjectFilter}
              onSaveTitle={async (title) => {
                queryClient.setQueryData<SiengeTitle[]>(['siengeTitles'], prev => {
                  const exists = (prev || []).find(t => t.id === title.id);
                  return exists
                    ? (prev || []).map(t => t.id === title.id ? title : t)
                    : [title, ...(prev || [])];
                });
                saveSiengeTitle(title).catch(console.error);
              }}
              onDeleteTitle={async (id) => {
                queryClient.setQueryData<SiengeTitle[]>(['siengeTitles'], prev => (prev || []).filter(t => t.id !== id));
                deleteSiengeTitle(id).catch(console.error);
              }}
              onSaveLote={async (lote) => {
                queryClient.setQueryData<SiengeLote[]>(['siengeLotes'], prev => {
                  const exists = (prev || []).find(l => l.id === lote.id);
                  return exists
                    ? (prev || []).map(l => l.id === lote.id ? lote : l)
                    : [lote, ...(prev || [])];
                });
                saveSiengeLote(lote).catch(console.error);
              }}
              onDeleteLote={async (id) => {
                queryClient.setQueryData<SiengeLote[]>(['siengeLotes'], prev => (prev || []).filter(l => l.id !== id));
                deleteSiengeLote(id).catch(console.error);
              }}
            />
          )}

          {activeView === 'dashboard' && (
            <DashboardView
              tasks={tasks}
              projects={projects}
              labels={labels}
            />
          )}
        </div>
      </div>

      {/* Task detail slide-out drawer */}
      <TaskSheet
        task={selectedTask}
        isOpen={isTaskSheetOpen}
        onClose={handleCloseTaskSheet}
        projects={projects}
        allLabels={labels}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        allTasks={tasks}
        onAddTask={handleAddTask}
        onSelectTask={setSelectedTask}
      />

      {/* Cmd+K global Command Palette overlay popover */}
      <CommandBar
        isOpen={isCommandBarOpen}
        onClose={() => setIsCommandBarOpen(false)}
        tasks={tasks}
        projects={projects}
        onSelectTask={(task) => {
          setSelectedTask(task);
          setIsTaskSheetOpen(true);
        }}
        onSelectView={setActiveView}
        onSelectTaskViewType={setActiveTaskViewType}
        onNewTask={handleAddNewTaskPrompt}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />
      <ConfirmModal 
        isOpen={confirmModalData.isOpen}
        title="Campos Incompletos"
        message={confirmModalData.message || "Atenção: Campos obrigatórios não preenchidos. Se você sair agora, a tarefa incompleta será EXCLUÍDA. Deseja realmente sair?"}
        confirmText="Excluir e Sair"
        cancelText="Voltar à Tarefa"
        onConfirm={() => {
          if (confirmModalData.taskId) {
            handleDeleteTask(confirmModalData.taskId);
          }
          setIsTaskSheetOpen(false);
          setSelectedTask(null);
          setConfirmModalData({ isOpen: false, taskId: null });
        }}
        onCancel={() => {
          setConfirmModalData({ isOpen: false, taskId: null });
        }}
      />
    </div>
  );
}
