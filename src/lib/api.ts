import { supabase } from './supabase';
import { Task, Project, Label, AppNotification, SiengeTitle, SiengeLote, SiengeAlcadaConfig, DesignBriefing, CopyBriefing, PlanningBriefing } from '../types';

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

// design_briefing / copy_briefing / planning_briefing are excluded here (~13 MB total).
// They are fetched on-demand via fetchTaskBriefings() when a task is opened.
const TASKS_LIST_COLS = [
  'id', 'task_code', 'title', 'description', 'status', 'priority',
  'project_id', 'created_at', 'due_date', 'reminder_date', 'reminder_type',
  'planned_date', 'assignee_id', 'parent_task_id', 'updated_by',
  'chat_messages', 'attachments', 'proposals', 'social_media_approval', 'time_tracking'
].join(', ');

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase.from('tasks').select(`
    ${TASKS_LIST_COLS},
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
      attachments: t.attachments || [],
      proposals: t.proposals || [],
      socialMediaApproval: t.social_media_approval,
      timeTracking: t.time_tracking,
      subtasks: (t.subtasks || [])
        .map((st: any) => ({
          id: st.id,
          title: st.title,
          completed: st.completed,
          canceled: st.canceled,
          completedAt: st.completed_at,
          reminderDate: st.reminder_date,
          reminderType: st.reminder_type,
          assigneeId: st.assignee_id,
          level: st.level,
          sortOrder: st.sort_order
        }))
        .sort((a: any, b: any) => {
          const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
          return orderA - orderB;
        }),
      labels: extractedLabels
    };
  });
}

export async function fetchTaskBriefings(id: string): Promise<{
  designBriefing?: DesignBriefing;
  copyBriefing?: CopyBriefing;
  planningBriefing?: PlanningBriefing;
} | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('design_briefing, copy_briefing, planning_briefing')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return {
    designBriefing: data.design_briefing ?? undefined,
    copyBriefing: data.copy_briefing ?? undefined,
    planningBriefing: data.planning_briefing ?? undefined,
  };
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

  // 2. Sync Labels — upsert new rows, delete only removed ones (avoids N WAL events per save)
  if (task.labels && task.labels.length > 0) {
    const keepLabelIds = task.labels.map(l => l.id);
    const { error: deleteLabelsError } = await supabase.from('task_labels').delete().eq('task_id', task.id).not('label_id', 'in', `(${keepLabelIds.join(',')})`);
    if (deleteLabelsError) console.error("Error deleting task labels:", deleteLabelsError);
    const labelInserts = task.labels.map(l => ({ task_id: task.id, label_id: l.id }));
    const { error: upsertLabelsError } = await supabase.from('task_labels').upsert(labelInserts);
    if (upsertLabelsError) console.error("Error upserting task labels:", upsertLabelsError);
  } else {
    const { error: deleteLabelsError } = await supabase.from('task_labels').delete().eq('task_id', task.id);
    if (deleteLabelsError) console.error("Error deleting task labels:", deleteLabelsError);
  }

  // 3. Sync Subtasks — upsert changed/new rows, delete removed ones only (avoids N WAL events per save)
  if (task.subtasks && task.subtasks.length > 0) {
    const keepIds = task.subtasks.map(st => st.id);
    const { error: deleteSubtasksError } = await supabase.from('subtasks').delete().eq('task_id', task.id).not('id', 'in', `(${keepIds.join(',')})`);
    if (deleteSubtasksError) console.error("Error deleting subtasks:", deleteSubtasksError);
    const subtaskInserts = task.subtasks.map((st, index) => ({
      id: st.id,
      task_id: task.id,
      title: st.title,
      completed: st.completed,
      canceled: st.canceled,
      completed_at: st.completedAt || null,
      reminder_date: st.reminderDate || null,
      reminder_type: st.reminderType || null,
      assignee_id: st.assigneeId || null,
      level: st.level,
      sort_order: index
    }));
    const { error: upsertSubtasksError } = await supabase.from('subtasks').upsert(subtaskInserts);
    if (upsertSubtasksError) console.error("Error upserting subtasks:", upsertSubtasksError);
  } else {
    const { error: deleteSubtasksError } = await supabase.from('subtasks').delete().eq('task_id', task.id);
    if (deleteSubtasksError) console.error("Error deleting subtasks:", deleteSubtasksError);
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
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate || null;
    if ('reminderDate' in updates) dbUpdates.reminder_date = updates.reminderDate ?? null;
    if ('reminderType' in updates) dbUpdates.reminder_type = updates.reminderType ?? null;
    if (updates.plannedDate !== undefined) dbUpdates.planned_date = updates.plannedDate || null;
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
      if (updates.labels && updates.labels.length > 0) {
        const keepLabelIds = updates.labels.map(l => l.id);
        const { error: deleteError } = await supabase.from('task_labels').delete().eq('task_id', taskId).not('label_id', 'in', `(${keepLabelIds.join(',')})`);
        if (deleteError) console.error("Error deleting task labels:", deleteError);
        const labelInserts = updates.labels.map(l => ({ task_id: taskId, label_id: l.id }));
        const { error: upsertError } = await supabase.from('task_labels').upsert(labelInserts);
        if (upsertError) console.error("Error upserting task labels:", upsertError);
      } else {
        const { error: deleteError } = await supabase.from('task_labels').delete().eq('task_id', taskId);
        if (deleteError) console.error("Error deleting task labels:", deleteError);
      }
    }

    if (updates.subtasks !== undefined) {
      if (updates.subtasks && updates.subtasks.length > 0) {
        const keepIds = updates.subtasks.map(st => st.id);
        const { error: deleteError } = await supabase.from('subtasks').delete().eq('task_id', taskId).not('id', 'in', `(${keepIds.join(',')})`);
        if (deleteError) console.error("Error deleting subtasks:", deleteError);
        const subtaskInserts = updates.subtasks.map((st, index) => ({
          id: st.id,
          task_id: taskId,
          title: st.title,
          completed: st.completed,
          canceled: st.canceled,
          completed_at: st.completedAt || null,
          reminder_date: st.reminderDate || null,
          reminder_type: st.reminderType || null,
          assignee_id: st.assigneeId || null,
          level: st.level,
          sort_order: index
        }));
        const { error: upsertError } = await supabase.from('subtasks').upsert(subtaskInserts);
        if (upsertError) console.error("Error upserting subtasks:", upsertError);
      } else {
        const { error: deleteError } = await supabase.from('subtasks').delete().eq('task_id', taskId);
        if (deleteError) console.error("Error deleting subtasks:", deleteError);
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
    siengeTitleId: n.sienge_title_id,
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
    task_id: notif.taskId || null,
    sienge_title_id: notif.siengeTitleId || null,
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

const SIENGE_TITLE_LIST_COLS = 'id, titulo, descricao, valor, empreendimento, vencimento, vencimento_original, lote, lote_id, assignee_id, reminder_date, reminder_type, status, created_at, updated_at, motivo_recusa, motivo_recusa_registrado_em, motivo_recusa_resolvido, motivo_recusa_resolvido_em, motivo_recusa_observacao';

function mapSiengeTitle(r: any, attachments?: any): SiengeTitle {
  return {
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao,
    valor: Number(r.valor),
    empreendimento: r.empreendimento,
    vencimento: r.vencimento,
    vencimentoOriginal: r.vencimento_original,
    // Left undefined (not defaulted to []) when not selected by the list query,
    // so saveSiengeTitle can tell "not loaded" apart from "explicitly empty"
    // and avoid clobbering real history data — same guard used for attachments below.
    vencimentoHistory: r.vencimento_history,
    lote: r.lote,
    loteId: r.lote_id,
    assigneeId: r.assignee_id,
    reminderDate: r.reminder_date,
    reminderType: r.reminder_type,
    attachments: attachments ?? r.attachments ?? [],
    status: r.status,
    motivoRecusa: r.motivo_recusa,
    motivoRecusaRegistradoEm: r.motivo_recusa_registrado_em,
    motivoRecusaResolvido: r.motivo_recusa_resolvido,
    motivoRecusaResolvidoEm: r.motivo_recusa_resolvido_em,
    motivoRecusaObservacao: r.motivo_recusa_observacao,
    chatMessages: r.chat_messages,
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
    vencimento_original: title.vencimentoOriginal || null,
    lote: title.lote || null,
    lote_id: title.loteId || null,
    assignee_id: title.assigneeId || null,
    reminder_date: title.reminderDate || null,
    reminder_type: title.reminderType || null,
    status: title.status,
    motivo_recusa: title.motivoRecusa || null,
    motivo_recusa_registrado_em: title.motivoRecusaRegistradoEm || null,
    motivo_recusa_resolvido: title.motivoRecusaResolvido || false,
    motivo_recusa_resolvido_em: title.motivoRecusaResolvidoEm || null,
    motivo_recusa_observacao: title.motivoRecusaObservacao || null,
  };
  if (title.chatMessages !== undefined) {
    payload.chat_messages = title.chatMessages;
  }
  // Only write vencimento_history when explicitly provided, to avoid clobbering
  // records loaded via the list view (which doesn't fetch this column).
  if (title.vencimentoHistory !== undefined) {
    payload.vencimento_history = title.vencimentoHistory;
  }
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

// ─── Sienge Alçada Config ──────────────────────────────────────

export async function fetchSiengeAlcadaConfig(): Promise<SiengeAlcadaConfig> {
  const { data, error } = await supabase
    .from('sienge_alcada_config')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();
  if (error) throw error;
  return {
    alcada1UserId: data?.alcada_1_user_id || undefined,
    alcada2UserId: data?.alcada_2_user_id || undefined,
    alcada3UserId: data?.alcada_3_user_id || undefined,
  };
}

export async function saveSiengeAlcadaConfig(config: SiengeAlcadaConfig) {
  const { error } = await supabase.from('sienge_alcada_config').upsert({
    id: 'default',
    alcada_1_user_id: config.alcada1UserId || null,
    alcada_2_user_id: config.alcada2UserId || null,
    alcada_3_user_id: config.alcada3UserId || null,
    updated_at: new Date().toISOString(),
  });
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
