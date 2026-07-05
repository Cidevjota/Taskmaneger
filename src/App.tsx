import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { fetchTasks, fetchTaskBriefings, fetchProjects, fetchLabels, saveTask, patchTask, deleteTask, saveProject, fetchSiengeTitles, saveSiengeTitle, deleteSiengeTitle, fetchSiengeLotes, saveSiengeLote, deleteSiengeLote } from './lib/api';
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

// Stable color per user — used for presence avatars / ring
function colorFor(userId: string) {
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
  let h = 0;
  for (const c of userId) h = (h << 5) - h + c.charCodeAt(0);
  return COLORS[Math.abs(h) % COLORS.length];
}

export type EditorPresence = { name: string; avatarUrl?: string; color: string };

export default function App() {
  const { currentUser, loading, updateProfile } = useAuth();
  const { addNotification } = useNotifications();
  const previousTasksRef = useRef<Task[]>([]);
  const isFirstRender = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Always-current ref so reminder interval reads latest user without being a dep
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Toast state
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, id: Date.now() });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

  // Navigation Routing states
  const [activeView, setActiveView] = useState<ViewType>('home');
  const [activeTaskViewType, setActiveTaskViewType] = useState<'board' | 'list'>('board');
  const [collapsed, setCollapsed] = useState(false);

  // Database core states using React Query
  const queryClient = useQueryClient();
  const syncManager = useSyncManager();
  // Ref so Realtime handler always reads the latest syncManager without re-subscribing
  const syncManagerRef = useRef(syncManager);
  syncManagerRef.current = syncManager;

  // Presence: who is editing which task
  const presenceTrackRef = useRef<((taskId: string | null) => void) | null>(null);
  const presenceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingMap, setEditingMap] = useState<Record<string, EditorPresence>>({});
  const [cooldownMap, setCooldownMap] = useState<Record<string, { name: string, expiresAt: number }>>({});
  const previousPresencesRef = useRef<Record<string, any[]>>({});
  const cooldownTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // In-memory set of already-fired reminder IDs to prevent duplicate notifications
  // across rapid re-renders before updateProfile() persists to Supabase.
  const triggeredRemindersRef = useRef<Set<string>>(new Set());

  // Track recently saved task IDs to suppress self-triggered Realtime events
  const recentlySavedRef = useRef<Map<string, number>>(new Map());
  const markRecentlySaved = (taskId: string) => {
    recentlySavedRef.current.set(taskId, Date.now());
    setTimeout(() => recentlySavedRef.current.delete(taskId), 3000);
  };

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

  const authReady = !loading && !!currentUser;

  const { data: tasks = [], isLoading: isTasksLoading } = useQuery({ queryKey: ['tasks'], queryFn: queryFnTasks, enabled: authReady });
  const { data: projects = [], isLoading: isProjectsLoading } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects, enabled: authReady });
  const { data: labels = [], isLoading: isLabelsLoading } = useQuery({ queryKey: ['labels'], queryFn: fetchLabels, enabled: authReady });
  const { data: siengeTitles = [], isLoading: isSiengeLoading } = useQuery({ queryKey: ['siengeTitles'], queryFn: fetchSiengeTitles, enabled: authReady });
  const { data: siengeLotes = [], isLoading: isLotesLoading } = useQuery({ queryKey: ['siengeLotes'], queryFn: fetchSiengeLotes, enabled: authReady });

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

  // Presence channel — tracks who is editing which task in real time
  useEffect(() => {
    if (!currentUser) return;
    const ch = supabase.channel('task-presence', {
      config: { presence: { key: currentUser.id } },
    });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<any>();
      const taskPresences: Record<string, any[]> = {};
      
      for (const presences of Object.values(state) as any[][]) {
        for (const p of presences) {
          if (p.editingTaskId) {
            if (!taskPresences[p.editingTaskId]) taskPresences[p.editingTaskId] = [];
            taskPresences[p.editingTaskId].push(p);
          }
        }
      }

      let newlyEmptyTasks: Array<{ taskId: string, name: string }> = [];
      for (const [oldTaskId, oldUsers] of Object.entries(previousPresencesRef.current)) {
        const currentUsers = taskPresences[oldTaskId];
        if (!currentUsers || currentUsers.length === 0) {
          const lastUser = oldUsers[0]; 
          if (lastUser) {
            newlyEmptyTasks.push({ taskId: oldTaskId, name: lastUser.name });
            if (cooldownTimersRef.current[oldTaskId]) {
              clearTimeout(cooldownTimersRef.current[oldTaskId]);
            }
            cooldownTimersRef.current[oldTaskId] = setTimeout(() => {
              setCooldownMap(prev => {
                const next = { ...prev };
                delete next[oldTaskId];
                return next;
              });
            }, 2000);
          }
        }
      }
      
      previousPresencesRef.current = taskPresences;

      if (newlyEmptyTasks.length > 0) {
        setCooldownMap(prev => {
          const next = { ...prev };
          const now = Date.now();
          for (const t of newlyEmptyTasks) {
            next[t.taskId] = { name: t.name, expiresAt: now + 2000 };
          }
          return next;
        });
      }

      const map: Record<string, EditorPresence> = {};
      for (const [taskId, users] of Object.entries(taskPresences)) {
        // Sort by joinedAt to find the first one (oldest)
        users.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
        const winner = users[0];
        
        if (winner.userId !== currentUser.id) {
          map[taskId] = { name: winner.name, avatarUrl: winner.avatarUrl, color: winner.color };
        }
      }
      setEditingMap(map);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const track = (taskId: string | null) => {
          ch.track({
            userId: currentUser.id,
            name: currentUser.name,
            avatarUrl: currentUser.avatarUrl,
            editingTaskId: taskId,
            color: colorFor(currentUser.id),
            joinedAt: Date.now(),
          });
        };
        presenceTrackRef.current = track;
        track(null);
      }
    });
    return () => { presenceTrackRef.current = null; supabase.removeChannel(ch); };
  }, [currentUser?.id]);

  // Tell presence channel when this user starts/stops editing a task.
  // Debounced to avoid rate-limit errors when navigating quickly between tasks.
  useEffect(() => {
    const taskId = isTaskSheetOpen && selectedTask ? selectedTask.id : null;
    if (presenceDebounceRef.current) clearTimeout(presenceDebounceRef.current);
    presenceDebounceRef.current = setTimeout(() => {
      presenceTrackRef.current?.(taskId);
    }, 300);
    return () => {
      if (presenceDebounceRef.current) clearTimeout(presenceDebounceRef.current);
    };
  }, [isTaskSheetOpen, selectedTask?.id]);

  // Setup realtime — per-table filters avoid the schema-wide wildcard that was
  // driving realtime.list_changes() to ~1M calls/day.
  useEffect(() => {
    // For subtasks/labels, still need a full refetch (joined data not in payload)
    const invalidateTasks = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }, 400);
    };

    const channel = supabase
      .channel('app-db-changes')
      // Task UPDATE: update only the changed task in cache directly — no full refetch
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload) => {
        const raw = payload.new as any;
        const sm = syncManagerRef.current;
        queryClient.setQueryData<Task[]>(['tasks'], (old) => {
          if (!old) return old;
          return old.map(t => {
            if (t.id !== raw.id) return t;
            return {
              ...t,
              ...(sm.isFieldDirty(t.id, 'status')      ? {} : { status:      raw.status }),
              ...(sm.isFieldDirty(t.id, 'priority')    ? {} : { priority:    raw.priority }),
              ...(sm.isFieldDirty(t.id, 'title')       ? {} : { title:       raw.title }),
              ...(sm.isFieldDirty(t.id, 'assigneeId')  ? {} : { assigneeId:  raw.assignee_id }),
              ...(sm.isFieldDirty(t.id, 'dueDate')     ? {} : { dueDate:     raw.due_date }),
              ...(sm.isFieldDirty(t.id, 'plannedDate') ? {} : { plannedDate: raw.planned_date }),
              ...(sm.isFieldDirty(t.id, 'reminderDate')? {} : { reminderDate:raw.reminder_date }),
              ...(sm.isFieldDirty(t.id, 'reminderType')? {} : { reminderType:raw.reminder_type }),
              ...(sm.isFieldDirty(t.id, 'projectId')   ? {} : { projectId:   raw.project_id }),
              ...(sm.isFieldDirty(t.id, 'description') ? {} : { description: raw.description }),
              updatedBy: raw.updated_by,
            };
          });
        });
      })
      // Task INSERT/DELETE: need full refetch to keep list consistent
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, invalidateTasks)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, (payload) => {
        const deletedId = (payload.old as any)?.id;
        if (deletedId) {
          queryClient.setQueryData<Task[]>(['tasks'], (old) => old?.filter(t => t.id !== deletedId) ?? []);
        }
      })
      // Subtasks/labels changes require refetch of the parent task (joined data).
      // Skip events triggered by our own saves (recentlySavedRef) to avoid redundant refetches.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, (payload) => {
        const taskId = (payload.new as any)?.task_id || (payload.old as any)?.task_id;
        if (taskId && recentlySavedRef.current.has(taskId)) return;
        invalidateTasks();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_labels' }, (payload) => {
        const taskId = (payload.new as any)?.task_id || (payload.old as any)?.task_id;
        if (taskId && recentlySavedRef.current.has(taskId)) return;
        invalidateTasks();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'labels' }, () => {
        queryClient.invalidateQueries({ queryKey: ['labels'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sienge_titles' }, () => {
        queryClient.invalidateQueries({ queryKey: ['siengeTitles'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sienge_lotes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['siengeLotes'] });
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
    
    // Skip notification logic on the very first real data load (when prevTasks is empty but tasks is populated)
    if (prevTasks.length === 0 && tasks.length > 0) {
      previousTasksRef.current = tasks;
      return;
    }

    // Check for deleted tasks where I was the assignee
    tasks.forEach(task => {
      const prevTask = prevTasks.find(pt => pt.id === task.id);
      
      if (prevTask) {
        // Here we removed the frontend logic for assigning, status and deadlines
        // since this is now handled perfectly by Postgres triggers in the backend!
      }
    });

    previousTasksRef.current = tasks;
  }, [tasks, currentUser]);

  // Deadline and reminder checks — currentUser is read via ref so that
  // updateProfile() (which creates a new object) does not reset the interval.
  useEffect(() => {
    if (!currentUserRef.current) return;
    const checkReminders = () => {
      const currentUser = currentUserRef.current;
      if (!currentUser) return;
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Merge persisted list with in-memory ref — prevents duplicates when
      // updateProfile() hasn't flushed to Supabase yet on rapid re-renders.
      const persisted: string[] = currentUser.preferences?.triggeredReminders || [];
      let triggeredReminders: string[] = [
        ...persisted,
        ...Array.from(triggeredRemindersRef.current).filter(id => !persisted.includes(id)),
      ];

      let hasNewTriggers = false;
      
      tasks.filter(t => t.status !== 'done').forEach(task => {
        const isMyTask = task.assigneeId === currentUser.id;

        // Check due date relative to today
        if (isMyTask && task.dueDate) {
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

        // Check task reminder — recipient is always the task's assignee
        if (isMyTask && task.reminderDate && task.reminderType !== 'seen') {
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
             triggeredRemindersRef.current.add(reminderId);
             triggeredReminders = [...triggeredReminders, reminderId];
             hasNewTriggers = true;
             // Mark as seen in DB so the bell turns green
             patchTask(task.id, { reminderType: 'seen' as any, updatedBy: currentUser.id }).catch(console.error);
           }
        }

        // Check subtask reminders — recipient is the subtask's own assignee if set,
        // otherwise it falls back to the parent task's assignee.
        task.subtasks.forEach(st => {
           const recipientId = st.assigneeId || task.assigneeId;
           if (recipientId !== currentUser.id) return;

           if (st.reminderDate && !st.completed && st.reminderType !== 'seen') {
             const reminderTime = new Date(st.reminderDate).getTime();
             const reminderId = `sub_${st.id}_${st.reminderDate}`;

             if (now.getTime() >= reminderTime && !triggeredReminders.includes(reminderId)) {
               addNotification({
                 userId: recipientId,
                 actorId: 'system',
                 taskId: task.id,
                 targetId: st.id,
                 type: 'reminder',
                 message: 'Lembrete Acionado',
                 details: `"${st.title}"`
               });
               triggeredRemindersRef.current.add(reminderId);
               triggeredReminders = [...triggeredReminders, reminderId];
               hasNewTriggers = true;
               // Mark as seen in DB so the bell turns green
               supabase.from('subtasks').update({ reminder_type: 'seen' }).eq('id', st.id).then(({ error }) => {
                 if (error) console.error(error);
               });
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
  // currentUser is intentionally excluded — read via currentUserRef.current
  // to avoid resetting the interval on every updateProfile() call.
  }, [tasks, siengeTitles]);

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

  // Update selectedTask details live when the database copies alter.
  // Briefings are NOT in the list fetch — preserve them from the previous state.
  useEffect(() => {
    if (selectedTask) {
      const refreshedTask = tasks.find(t => t.id === selectedTask.id);
      if (refreshedTask) {
        setSelectedTask(prev => prev ? {
          ...refreshedTask,
          designBriefing: prev.designBriefing,
          copyBriefing: prev.copyBriefing,
          planningBriefing: prev.planningBriefing,
        } : refreshedTask);
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
    
    // Always set updatedBy so backend triggers know who made the change
    if (currentUser?.id) {
      updates.updatedBy = currentUser.id;
    }

    const nowISO = new Date().toISOString();
    
    // Regra: tarefas sem prazo não podem estar em outro status além de 'no_forecast' e 'done'
    const resultingDueDate = 'dueDate' in updates ? updates.dueDate : targetTask.dueDate;
    const newStatus = updates.status;
    const statusIsChanging = newStatus !== undefined && newStatus !== targetTask.status;
    const statusMovingActive = statusIsChanging && newStatus !== 'no_forecast' && newStatus !== 'done';

    if (statusMovingActive && !resultingDueDate) {
      showToast('Adicione um prazo antes de mover esta tarefa para outro status.');
      return;
    }

    // Automação: prazo removido de task ativa → volta silenciosamente para 'Sem Previsão'
    const dueDateBeingCleared = 'dueDate' in updates && !updates.dueDate && Boolean(targetTask.dueDate);
    if (dueDateBeingCleared && targetTask.status !== 'done') {
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

    // Suppress self-triggered Realtime events for this task for the next 3s
    markRecentlySaved(updates.id);

    // Queue update via SyncManager
    syncManager.updateTask(updates.id, updates, { debounce: needsDebounce });

    // Update selectedTask details live immediately
    if (selectedTask?.id === updates.id) {
       setSelectedTask(prev => prev ? { ...prev, ...updates } as Task : null);
    }
  };

  const handleAddTask = (newTask: Task) => {
    markRecentlySaved(newTask.id);
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

  const handleSelectTask = useCallback(async (task: Task) => {
    setSelectedTask(task);
    setIsTaskSheetOpen(true);
    // Load briefing columns on-demand (excluded from fetchTasks to save bandwidth)
    try {
      const briefings = await fetchTaskBriefings(task.id);
      if (briefings) {
        setSelectedTask(prev => prev?.id === task.id ? { ...prev, ...briefings } : prev);
      }
    } catch {
      // Non-blocking — briefing sections will just appear empty
    }
  }, []);

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
        onSelectTask={handleSelectTask}
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
              onSelectTask={handleSelectTask}
            />
          )}

          {activeView === 'inbox' && (
            <InboxView
              projects={projects}
              onSelectTask={handleSelectTask}
              tasks={tasks}
            />
          )}

          {activeView === 'tasks_board' && activeTaskViewType === 'board' && (
            <KanbanView
              tasks={visibleTasks}
              projects={projects}
              labels={labels}
              onSelectTask={handleSelectTask}
              onUpdateTask={handleUpdateTask}
              onAddTask={handleAddTask}
              currentProjectFilter={currentProjectFilter}
              socialMediaFilter={socialMediaFilter}
              setSocialMediaFilter={setSocialMediaFilter}
              editingMap={editingMap}
            />
          )}

          {activeView === 'tasks_board' && activeTaskViewType === 'list' && (
            <ListView
              tasks={visibleTasks}
              projects={projects}
              labels={labels}
              onSelectTask={handleSelectTask}
              onUpdateTask={handleUpdateTask}
              onAddTask={handleAddTask}
              currentProjectFilter={currentProjectFilter}
              editingMap={editingMap}
            />
          )}

          {activeView === 'calendar' && (
            <CalendarView
              tasks={visibleTasks}
              projects={projects}
              labels={labels}
              onSelectTask={handleSelectTask}
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
        onSelectTask={handleSelectTask}
        editingBy={selectedTask ? editingMap[selectedTask.id] : undefined}
        cooldown={selectedTask ? cooldownMap[selectedTask.id] : undefined}
        editingMap={editingMap}
      />

      {/* Cmd+K global Command Palette overlay popover */}
      <CommandBar
        isOpen={isCommandBarOpen}
        onClose={() => setIsCommandBarOpen(false)}
        tasks={tasks}
        projects={projects}
        onSelectTask={handleSelectTask}
        onSelectView={setActiveView}
        onSelectTaskViewType={setActiveTaskViewType}
        onNewTask={handleAddNewTaskPrompt}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />
      {/* Toast de erro */}
      {toast && (
        <div
          key={toast.id}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 bg-zinc-900 border border-red-500/30 text-red-400 text-sm font-medium px-4 py-3 rounded-xl shadow-2xl shadow-black/60 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <span className="text-red-500 text-base leading-none">⚠</span>
          {toast.message}
        </div>
      )}

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
