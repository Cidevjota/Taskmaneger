import { supabase } from './supabase';
import { Task, Project, Label, AppNotification, SiengeTitle, SiengeLote } from '../types';

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*');
  if (error) throw error;
  return data as Project[];
}

export async function fetchLabels(): Promise<Label[]> {
  const { data, error } = await supabase.from('labels').select('*');
  if (error) throw error;
  return data as Label[];
}

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase.from('tasks').select(`
    *,
    subtasks(*),
    task_labels(
      labels(*)
    )
  `);

  if (error) throw error;

  return data.map((t: any): Task => {
    // Safely extract labels, handling cases where the join might be empty
    const extractedLabels = (t.task_labels || [])
      .map((tl: any) => tl.labels)
      .filter(Boolean);

    return {
      id: t.id,
      taskCode: t.task_code,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      projectId: t.project_id,
      createdAt: t.created_at,
      dueDate: t.due_date,
      reminderDate: t.reminder_date,
      reminderType: t.reminder_type,
      plannedDate: t.planned_date,
      assigneeId: t.assignee_id,
      parentTaskId: t.parent_task_id,
      updatedBy: t.updated_by,
      chatMessages: t.chat_messages || [],
      designBriefing: t.design_briefing,
      copyBriefing: t.copy_briefing,
      planningBriefing: t.planning_briefing,
      attachments: t.attachments || [],
      proposals: t.proposals || [],
      socialMediaApproval: t.social_media_approval,
      timeTracking: t.time_tracking,
      subtasks: (t.subtasks || []).map((st: any) => ({
        id: st.id,
        title: st.title,
        completed: st.completed,
        canceled: st.canceled,
        reminderDate: st.reminder_date,
        level: st.level
      })),
      labels: extractedLabels
    };
  });
}

const taskSaveLocks: Record<string, Promise<void>> = {};

// Write Operations
export async function saveTask(task: Task) {
  // Wait for any pending save for this task
  while (taskSaveLocks[task.id]) {
    try {
      await taskSaveLocks[task.id];
    } catch (e) {
      // ignore error from previous lock
    }
  }

  let resolveLock: () => void;
  taskSaveLocks[task.id] = new Promise(resolve => {
    resolveLock = resolve;
  });

  try {
    // 1. Upsert main task
    const { error: taskError } = await supabase.from('tasks').upsert({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
    priority: task.priority,
    project_id: task.projectId || null,
    created_at: task.createdAt,
    due_date: task.dueDate || null,
    reminder_date: task.reminderDate || null,
    reminder_type: task.reminderType || null,
    planned_date: task.plannedDate || null,
    assignee_id: task.assigneeId || null,
    parent_task_id: task.parentTaskId || null,
    updated_by: task.updatedBy || null,
    chat_messages: task.chatMessages || [],
    design_briefing: task.designBriefing,
    copy_briefing: task.copyBriefing,
    planning_briefing: task.planningBriefing,
    attachments: task.attachments || [],
    proposals: task.proposals || [],
    social_media_approval: task.socialMediaApproval,
    time_tracking: task.timeTracking
  });
  if (taskError) {
    console.error("Error saving task:", taskError);
    throw taskError;
  }

  // 2. Sync Labels (delete existing, insert new)
  // First clear old ones
  const { error: deleteLabelsError } = await supabase.from('task_labels').delete().eq('task_id', task.id);
  if (deleteLabelsError) console.error("Error deleting task labels:", deleteLabelsError);
  
  // Insert new
  if (task.labels && task.labels.length > 0) {
    const labelInserts = task.labels.map(l => ({
      task_id: task.id,
      label_id: l.id
    }));
    const { error: insertLabelsError } = await supabase.from('task_labels').insert(labelInserts);
    if (insertLabelsError) console.error("Error inserting task labels:", insertLabelsError);
  }

  // 3. Sync Subtasks
  // Supabase doesn't easily do full nested replace without deleting first.
  // We'll delete old subtasks and insert the new array
  const { error: deleteSubtasksError } = await supabase.from('subtasks').delete().eq('task_id', task.id);
  if (deleteSubtasksError) console.error("Error deleting subtasks:", deleteSubtasksError);
  
  if (task.subtasks && task.subtasks.length > 0) {
    const subtaskInserts = task.subtasks.map(st => ({
      id: st.id,
      task_id: task.id,
      title: st.title,
      completed: st.completed,
      canceled: st.canceled,
      reminder_date: st.reminderDate,
      level: st.level
    }));
    const { error: insertSubtasksError } = await supabase.from('subtasks').insert(subtaskInserts);
    if (insertSubtasksError) console.error("Error inserting subtasks:", insertSubtasksError);
  }
  } finally {
    delete taskSaveLocks[task.id];
    resolveLock!();
  }
}

export async function patchTask(taskId: string, updates: Partial<Task>) {
  // Wait for any pending save for this task
  while (taskSaveLocks[taskId]) {
    try {
      await taskSaveLocks[taskId];
    } catch (e) {
      // ignore
    }
  }

  let resolveLock: () => void;
  taskSaveLocks[taskId] = new Promise(resolve => {
    resolveLock = resolve;
  });

  try {
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId || null;
    if (updates.createdAt !== undefined) dbUpdates.created_at = updates.createdAt;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if ('reminderDate' in updates) dbUpdates.reminder_date = updates.reminderDate ?? null;
    if ('reminderType' in updates) dbUpdates.reminder_type = updates.reminderType ?? null;
    if (updates.plannedDate !== undefined) dbUpdates.planned_date = updates.plannedDate;
    if (updates.assigneeId !== undefined) dbUpdates.assignee_id = updates.assigneeId;
    if (updates.parentTaskId !== undefined) dbUpdates.parent_task_id = updates.parentTaskId;
    if (updates.updatedBy !== undefined) dbUpdates.updated_by = updates.updatedBy;
    if (updates.chatMessages !== undefined) dbUpdates.chat_messages = updates.chatMessages;
    if (updates.designBriefing !== undefined) dbUpdates.design_briefing = updates.designBriefing;
    if (updates.copyBriefing !== undefined) dbUpdates.copy_briefing = updates.copyBriefing;
    if (updates.planningBriefing !== undefined) dbUpdates.planning_briefing = updates.planningBriefing;
    if (updates.attachments !== undefined) dbUpdates.attachments = updates.attachments;
    if (updates.proposals !== undefined) dbUpdates.proposals = updates.proposals;
    if (updates.socialMediaApproval !== undefined) dbUpdates.social_media_approval = updates.socialMediaApproval;
    if (updates.timeTracking !== undefined) dbUpdates.time_tracking = updates.timeTracking;

    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', taskId);
      if (error) {
        console.error("Error patching task:", error);
        throw error;
      }
    }

    if (updates.labels !== undefined) {
      const { error: deleteError } = await supabase.from('task_labels').delete().eq('task_id', taskId);
      if (deleteError) console.error("Error deleting task labels:", deleteError);
      if (updates.labels && updates.labels.length > 0) {
        const labelInserts = updates.labels.map(l => ({ task_id: taskId, label_id: l.id }));
        const { error: insertError } = await supabase.from('task_labels').insert(labelInserts);
        if (insertError) console.error("Error inserting task labels:", insertError);
      }
    }

    if (updates.subtasks !== undefined) {
      const { error: deleteError } = await supabase.from('subtasks').delete().eq('task_id', taskId);
      if (deleteError) console.error("Error deleting subtasks:", deleteError);
      if (updates.subtasks && updates.subtasks.length > 0) {
        const subtaskInserts = updates.subtasks.map(st => ({
          id: st.id,
          task_id: taskId,
          title: st.title,
          completed: st.completed,
          canceled: st.canceled,
          reminder_date: st.reminderDate,
          level: st.level
        }));
        const { error: insertError } = await supabase.from('subtasks').insert(subtaskInserts);
        if (insertError) console.error("Error inserting subtasks:", insertError);
      }
    }
  } finally {
    delete taskSaveLocks[taskId];
    resolveLock!();
  }
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) {
    console.error("Error deleting task from DB:", error);
    throw error;
  }
}

export async function saveProject(project: Project) {
  const { error } = await supabase.from('projects').upsert(project);
  if (error) throw error;
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  return data.map((n: any): AppNotification => ({
    id: n.id,
    userId: n.user_id,
    actorId: n.actor_id,
    taskId: n.task_id,
    type: n.type,
    status: n.status,
    createdAt: n.created_at,
    viewedAt: n.viewed_at,
    postponedUntil: n.postponed_until,
    message: n.message,
    details: n.details,
    targetId: n.target_id
  }));
}

export async function saveNotification(notif: AppNotification) {
  const { error } = await supabase.from('notifications').upsert({
    id: notif.id,
    user_id: notif.userId,
    actor_id: notif.actorId,
    task_id: notif.taskId,
    type: notif.type,
    status: notif.status,
    created_at: notif.createdAt,
    viewed_at: notif.viewedAt,
    postponed_until: notif.postponedUntil,
    message: notif.message,
    details: notif.details,
    target_id: notif.targetId
  });
  if (error) throw error;
}

export async function deleteArchivedNotifications(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .eq('status', 'viewed');
  if (error) throw error;
}

// ─── Sienge Titles ───────────────────────────────────────────────

const SIENGE_TITLE_LIST_COLS = 'id, titulo, descricao, valor, empreendimento, vencimento, lote, lote_id, assignee_id, reminder_date, reminder_type, status, created_at, updated_at';

function mapSiengeTitle(r: any, attachments?: any): SiengeTitle {
  return {
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao,
    valor: Number(r.valor),
    empreendimento: r.empreendimento,
    vencimento: r.vencimento,
    lote: r.lote,
    loteId: r.lote_id,
    assigneeId: r.assignee_id,
    reminderDate: r.reminder_date,
    reminderType: r.reminder_type,
    attachments: attachments ?? r.attachments ?? [],
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchSiengeTitles(): Promise<SiengeTitle[]> {
  // attachments column excluded — it stores base64 PDFs that cause statement
  // timeouts when fetched for the full list. Load them on demand via fetchSiengeTitleById.
  const { data, error } = await supabase
    .from('sienge_titles')
    .select(SIENGE_TITLE_LIST_COLS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => mapSiengeTitle(r, []));
}

export async function fetchSiengeTitleById(id: string): Promise<SiengeTitle | null> {
  const { data, error } = await supabase
    .from('sienge_titles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapSiengeTitle(data);
}

export async function saveSiengeTitle(title: SiengeTitle) {
  const payload: any = {
    id: title.id,
    titulo: title.titulo,
    descricao: title.descricao || null,
    valor: title.valor,
    empreendimento: title.empreendimento || null,
    vencimento: title.vencimento || null,
    lote: title.lote || null,
    lote_id: title.loteId || null,
    assignee_id: title.assigneeId || null,
    reminder_date: title.reminderDate || null,
    reminder_type: title.reminderType || null,
    status: title.status,
  };
  // Only write attachments when they were explicitly loaded (fetchSiengeTitleById),
  // otherwise we'd overwrite real DB data with the empty list default.
  if (title.attachments !== undefined) {
    payload.attachments = title.attachments;
  }
  const { error } = await supabase.from('sienge_titles').upsert(payload);
  if (error) throw error;
}

export async function deleteSiengeTitle(id: string) {
  const { error } = await supabase.from('sienge_titles').delete().eq('id', id);
  if (error) throw error;
}

// ─── Sienge Lotes ──────────────────────────────────────────────

export async function fetchSiengeLotes(): Promise<SiengeLote[]> {
  const { data, error } = await supabase
    .from('sienge_lotes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any): SiengeLote => ({
    id: r.id,
    nome: r.nome,
    status: r.status,
    createdAt: r.created_at,
    closedAt: r.closed_at,
    vencimento: r.vencimento,
    prazoPagamento: r.prazo_pagamento,
  }));
}

export async function saveSiengeLote(lote: SiengeLote) {
  const { error } = await supabase.from('sienge_lotes').upsert({
    id: lote.id,
    nome: lote.nome,
    status: lote.status,
    vencimento: lote.vencimento || null,
    prazo_pagamento: lote.prazoPagamento || null,
    closed_at: lote.closedAt || null,
  });
  if (error) throw error;
}

export async function deleteSiengeLote(id: string) {
  const { error } = await supabase.from('sienge_lotes').delete().eq('id', id);
  if (error) throw error;
}
