import { supabase } from './supabase';
import { Task, Project, Label, AppNotification, SiengeTitle, SiengeLote, SiengeFatura, SiengeAlcadaConfig, DesignBriefing, CopyBriefing, PlanningBriefing, TaskHistoryEntry, SiengeProjectMeta, SiengeCategoriaOrcamento, SiengeTitleStatusHistoryEntry, SiengeProjectTotal, SiengeProjectDisplay, SiengeTabelaVendaUnidade, SiengeTabelaVendaRevisao, SiengeVenda, SiengeOrcamentoConfig, SiengeCentroCustoDef, SiengeCategoriaDef, SiengeSubcategoriaDef } from '../types';

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*');
  if (error) throw error;
  return (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    color: p.color,
    status: p.status,
    coverImage: p.cover_image,
    code: p.code,
    buildProgress: p.build_progress,
  })) as Project[];
}

export async function fetchLabels(): Promise<Label[]> {
  const { data, error } = await supabase.from('labels').select('*');
  if (error) throw error;
  return data as Label[];
}

export async function logTaskFieldHistory(
  taskId: string,
  field: 'description' | 'copy_briefing',
  oldValue: string | null,
  newValue: string | null,
  changedBy: string | null
): Promise<void> {
  const { error } = await supabase.rpc('log_task_field_history', {
    p_task_id: taskId,
    p_field: field,
    p_old_value: oldValue,
    p_new_value: newValue,
    p_changed_by: changedBy,
  });
  if (error) throw error;
}

export async function fetchTaskHistory(taskId: string): Promise<TaskHistoryEntry[]> {
  const { data, error } = await supabase
    .from('task_history')
    .select('*')
    .eq('task_id', taskId)
    .order('changed_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((h: any): TaskHistoryEntry => ({
    id: h.id,
    taskId: h.task_id,
    field: h.field,
    oldValue: h.old_value,
    newValue: h.new_value,
    changedBy: h.changed_by,
    changedAt: h.changed_at,
  }));
}

// design_briefing / copy_briefing / planning_briefing are excluded here (~13 MB total).
// They are fetched on-demand via fetchTaskBriefings() when a task is opened.
const TASKS_LIST_COLS = [
  'id', 'task_code', 'title', 'description', 'status', 'priority',
  'project_id', 'created_at', 'due_date', 'reminder_date', 'reminder_type',
  'planned_date', 'assignee_id', 'parent_task_id', 'updated_by',
  'chat_messages', 'attachments', 'proposals', 'social_media_approval', 'time_tracking',
  'updated_at', 'status_history', 'rework_count'
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
      updatedAt: t.updated_at,
      statusHistory: t.status_history || [],
      reworkCount: t.rework_count || 0,
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
    time_tracking: task.timeTracking,
    updated_at: task.updatedAt || null,
    status_history: task.statusHistory || [],
    rework_count: task.reworkCount || 0
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

// Lançado quando um write de descrição é rejeitado porque o texto no banco já não
// é o mesmo que o editor carregou — ou seja, outra pessoa salvou no meio do caminho.
// O chamador deve descartar o write (nunca re-enfileirar) e recarregar do servidor.
export class TaskConflictError extends Error {
  constructor(public taskId: string) {
    super(`Descrição da tarefa ${taskId} foi alterada por outro usuário`);
    this.name = 'TaskConflictError';
  }
}

interface PatchOptions {
  // Descrição que o editor tinha como base. Quando informada, a gravação vira um
  // compare-and-swap: o UPDATE só casa se a linha ainda contiver esse texto.
  // Atômico e sem request extra — o próprio UPDATE faz a verificação.
  descriptionBase?: string | null;
}

export async function patchTask(taskId: string, updates: Partial<Task>, opts: PatchOptions = {}) {
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
    if (updates.updatedAt !== undefined) dbUpdates.updated_at = updates.updatedAt;
    if (updates.statusHistory !== undefined) dbUpdates.status_history = updates.statusHistory;
    if (updates.reworkCount !== undefined) dbUpdates.rework_count = updates.reworkCount;

    const guardDescription = dbUpdates.description !== undefined && opts.descriptionBase !== undefined;

    if (guardDescription) {
      // Separa a descrição do resto: só ela precisa do compare-and-swap, e um
      // conflito nela não deve derrubar a gravação dos demais campos.
      const { description, ...rest } = dbUpdates;

      if (Object.keys(rest).length > 0) {
        const { error } = await supabase.from('tasks').update(rest).eq('id', taskId);
        if (error) {
          console.error("Error patching task:", error);
          throw error;
        }
      }

      const base = opts.descriptionBase;
      let query = supabase.from('tasks').update({ description }).eq('id', taskId);
      // Descrição vazia pode estar gravada como '' ou NULL — para o usuário é a
      // mesma coisa, então o guard aceita as duas formas.
      query = (base === null || base === '')
        ? query.or('description.is.null,description.eq.')
        : query.eq('description', base);

      const { data, error } = await query.select('id');
      if (error) {
        console.error("Error patching task description:", error);
        throw error;
      }
      if (!data || data.length === 0) throw new TaskConflictError(taskId);
    } else if (Object.keys(dbUpdates).length > 0) {
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
  const { error } = await supabase.from('projects').upsert({
    id: project.id,
    name: project.name,
    description: project.description,
    color: project.color,
    status: project.status,
    cover_image: project.coverImage ?? null,
    code: project.code ?? null,
    build_progress: project.buildProgress ?? null,
  });
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

const SIENGE_TITLE_LIST_COLS = 'id, titulo, descricao, valor, empreendimento, centro_custo, categoria, subcategoria, vencimento, vencimento_original, lote, lote_id, fatura_id, motivo_detalhado, assignee_id, reminder_date, reminder_type, status, created_at, updated_at, paid_at, motivo_recusa, motivo_recusa_registrado_em, motivo_recusa_resolvido, motivo_recusa_resolvido_em, motivo_recusa_observacao';

function mapSiengeTitle(r: any, attachments?: any): SiengeTitle {
  return {
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao,
    valor: Number(r.valor),
    empreendimento: r.empreendimento,
    centroCusto: r.centro_custo,
    categoria: r.categoria,
    subcategoria: r.subcategoria,
    vencimento: r.vencimento,
    vencimentoOriginal: r.vencimento_original,
    // Left undefined (not defaulted to []) when not selected by the list query,
    // so saveSiengeTitle can tell "not loaded" apart from "explicitly empty"
    // and avoid clobbering real history data — same guard used for attachments below.
    vencimentoHistory: r.vencimento_history,
    lote: r.lote,
    loteId: r.lote_id,
    faturaId: r.fatura_id,
    motivoDetalhado: r.motivo_detalhado,
    assigneeId: r.assignee_id,
    reminderDate: r.reminder_date,
    reminderType: r.reminder_type,
    // Only defined when explicitly passed by the caller (fetchSiengeTitleById).
    // Left undefined for the list query so saveSiengeTitle can tell "not loaded"
    // apart from "explicitly empty" and won't clobber real attachments — same
    // guard used for vencimento_history above.
    attachments,
    status: r.status,
    motivoRecusa: r.motivo_recusa,
    motivoRecusaRegistradoEm: r.motivo_recusa_registrado_em,
    motivoRecusaResolvido: r.motivo_recusa_resolvido,
    motivoRecusaResolvidoEm: r.motivo_recusa_resolvido_em,
    motivoRecusaObservacao: r.motivo_recusa_observacao,
    chatMessages: r.chat_messages,
    paidAt: r.paid_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchSiengeTitleStatusHistory(): Promise<SiengeTitleStatusHistoryEntry[]> {
  const { data, error } = await supabase
    .from('sienge_title_status_history')
    .select('id, title_id, status, changed_at');
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id,
    titleId: r.title_id,
    status: r.status,
    changedAt: r.changed_at,
  }));
}

export async function fetchSiengeTitles(): Promise<SiengeTitle[]> {
  // attachments column excluded — it stores base64 PDFs that cause statement
  // timeouts when fetched for the full list. Load them on demand via fetchSiengeTitleById.
  const { data, error } = await supabase
    .from('sienge_titles')
    .select(SIENGE_TITLE_LIST_COLS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => mapSiengeTitle(r));
}

export async function fetchSiengeTitleById(id: string): Promise<SiengeTitle | null> {
  const { data, error } = await supabase
    .from('sienge_titles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapSiengeTitle(data, data.attachments || []);
}

// Lançado quando o save de um título Sienge é rejeitado porque o updated_at no banco
// já não é o que a tela carregou — ou seja, outra pessoa salvou no meio do caminho.
// O chamador deve descartar a alteração local e recarregar do servidor.
export class SiengeTitleConflictError extends Error {
  constructor(public titleId: string) {
    super(`Título Sienge ${titleId} foi alterado por outro usuário`);
    this.name = 'SiengeTitleConflictError';
  }
}

export async function saveSiengeTitle(title: SiengeTitle) {
  // Base para o compare-and-swap: o updated_at que a tela tinha ao abrir o título.
  // Só é setado pelo caminho de "Salvar Alterações" (edição destrutiva de todos os
  // campos). Ações rápidas (status/chat) não passam base — seguem via upsert normal,
  // protegidas pela presença (bloqueio de edição simultânea).
  const baseUpdatedAt = (title as any).__baseUpdatedAt as string | undefined;

  const payload: any = {
    id: title.id,
    titulo: title.titulo,
    descricao: title.descricao || null,
    valor: title.valor,
    empreendimento: title.empreendimento || null,
    centro_custo: title.centroCusto || null,
    categoria: title.categoria || null,
    subcategoria: title.subcategoria || null,
    vencimento: title.vencimento || null,
    vencimento_original: title.vencimentoOriginal || null,
    lote: title.lote || null,
    lote_id: title.loteId || null,
    fatura_id: title.faturaId || null,
    motivo_detalhado: title.motivoDetalhado || null,
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

  if (baseUpdatedAt !== undefined) {
    // Compare-and-swap: só grava se o updated_at no banco ainda for o que a tela
    // carregou. Se outro usuário salvou no meio, o UPDATE não casa nenhuma linha
    // e sinalizamos conflito — nunca gravamos por cima. (O trigger BEFORE UPDATE
    // avança updated_at a cada gravação, então a base fica velha após o 1º save.)
    const { data, error } = await supabase
      .from('sienge_titles')
      .update(payload)
      .eq('id', title.id)
      .eq('updated_at', baseUpdatedAt)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) throw new SiengeTitleConflictError(title.id);
    return;
  }

  const { error } = await supabase.from('sienge_titles').upsert(payload);
  if (error) throw error;
}

export async function deleteSiengeTitle(id: string) {
  const { error } = await supabase.from('sienge_titles').delete().eq('id', id);
  if (error) throw error;
}

// ─── Sienge Metas & Orçamento (dashboard estratégico) ───────────

function mapSiengeProjectMeta(r: any): SiengeProjectMeta {
  return {
    id: r.id,
    projectId: r.project_id,
    ano: r.ano,
    mes: r.mes,
    vgvMeta: Number(r.vgv_meta),
    unidadesMeta: Number(r.unidades_meta),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchSiengeProjectMetas(): Promise<SiengeProjectMeta[]> {
  const { data, error } = await supabase.from('sienge_project_metas').select('*');
  if (error) throw error;
  return (data || []).map(mapSiengeProjectMeta);
}

export async function saveSiengeProjectMeta(meta: SiengeProjectMeta) {
  const { error } = await supabase.from('sienge_project_metas').upsert({
    id: meta.id,
    project_id: meta.projectId,
    ano: meta.ano,
    mes: meta.mes,
    vgv_meta: meta.vgvMeta,
    unidades_meta: meta.unidadesMeta,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'project_id,ano,mes' });
  if (error) throw error;
}

export async function deleteSiengeProjectMeta(id: string) {
  const { error } = await supabase.from('sienge_project_metas').delete().eq('id', id);
  if (error) throw error;
}

function mapSiengeProjectTotal(r: any): SiengeProjectTotal {
  return {
    id: r.id,
    projectId: r.project_id,
    vgvTotal: Number(r.vgv_total),
    unidadesTotal: Number(r.unidades_total),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchSiengeProjectTotais(): Promise<SiengeProjectTotal[]> {
  const { data, error } = await supabase.from('sienge_project_totais').select('*');
  if (error) throw error;
  return (data || []).map(mapSiengeProjectTotal);
}

export async function saveSiengeProjectTotal(total: SiengeProjectTotal) {
  const { error } = await supabase.from('sienge_project_totais').upsert({
    id: total.id,
    project_id: total.projectId,
    vgv_total: total.vgvTotal,
    unidades_total: total.unidadesTotal,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'project_id' });
  if (error) throw error;
}

function mapSiengeProjectDisplay(r: any): SiengeProjectDisplay {
  return {
    projectId: r.project_id,
    hidden: r.hidden,
    sortOrder: r.sort_order,
    updatedAt: r.updated_at,
  };
}

export async function fetchSiengeProjectDisplays(): Promise<SiengeProjectDisplay[]> {
  const { data, error } = await supabase.from('sienge_project_display').select('*');
  if (error) throw error;
  return (data || []).map(mapSiengeProjectDisplay);
}

export async function saveSiengeProjectDisplay(display: SiengeProjectDisplay) {
  const { error } = await supabase.from('sienge_project_display').upsert({
    project_id: display.projectId,
    hidden: display.hidden,
    sort_order: display.sortOrder,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'project_id' });
  if (error) throw error;
}

function mapSiengeCategoriaOrcamento(r: any): SiengeCategoriaOrcamento {
  return {
    id: r.id,
    projectId: r.project_id,
    centroCusto: r.centro_custo,
    categoria: r.categoria,
    percentual: Number(r.percentual),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchSiengeCategoriaOrcamentos(): Promise<SiengeCategoriaOrcamento[]> {
  const { data, error } = await supabase.from('sienge_categoria_orcamento').select('*');
  if (error) throw error;
  return (data || []).map(mapSiengeCategoriaOrcamento);
}

export async function saveSiengeCategoriaOrcamento(item: SiengeCategoriaOrcamento) {
  const { error } = await supabase.from('sienge_categoria_orcamento').upsert({
    id: item.id,
    project_id: item.projectId,
    centro_custo: item.centroCusto,
    categoria: item.categoria,
    percentual: item.percentual,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'project_id,centro_custo,categoria' });
  if (error) throw error;
}

export async function deleteSiengeCategoriaOrcamento(id: string) {
  const { error } = await supabase.from('sienge_categoria_orcamento').delete().eq('id', id);
  if (error) throw error;
}

// ─── Sienge Tabela de Vendas (unidades, valor de tabela e revisões) ──

function mapSiengeTabelaVendaUnidade(r: any): SiengeTabelaVendaUnidade {
  return {
    id: r.id,
    projectId: r.project_id,
    unidade: r.unidade,
    areaM2: Number(r.area_m2),
    valorTabela: Number(r.valor_tabela),
    situacao: r.situacao,
    descricao: r.descricao,
    frozenSince: r.frozen_since,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchSiengeTabelaVendas(): Promise<SiengeTabelaVendaUnidade[]> {
  const { data, error } = await supabase.from('sienge_tabela_vendas').select('*');
  if (error) throw error;
  return (data || []).map(mapSiengeTabelaVendaUnidade);
}

export async function saveSiengeTabelaVenda(item: SiengeTabelaVendaUnidade) {
  const { error } = await supabase.from('sienge_tabela_vendas').upsert({
    id: item.id,
    project_id: item.projectId,
    unidade: item.unidade,
    area_m2: item.areaM2,
    valor_tabela: item.valorTabela,
    situacao: item.situacao,
    descricao: item.descricao,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'project_id,unidade' });
  if (error) throw error;
}

export async function deleteSiengeTabelaVenda(id: string) {
  const { error } = await supabase.from('sienge_tabela_vendas').delete().eq('id', id);
  if (error) throw error;
}

function mapSiengeTabelaVendaRevisao(r: any): SiengeTabelaVendaRevisao {
  return {
    id: r.id,
    projectId: r.project_id,
    numero: r.numero,
    tipo: r.tipo,
    percentual: Number(r.percentual),
    unidadesAfetadas: r.unidades_afetadas,
    unidades: r.unidades,
    descricao: r.descricao,
    createdAt: r.created_at,
  };
}

export async function fetchSiengeTabelaVendaRevisoes(): Promise<SiengeTabelaVendaRevisao[]> {
  const { data, error } = await supabase.from('sienge_tabela_vendas_revisoes').select('*');
  if (error) throw error;
  return (data || []).map(mapSiengeTabelaVendaRevisao);
}

function mapSiengeVenda(r: any): SiengeVenda {
  return {
    id: r.id,
    unidadeId: r.unidade_id,
    projectId: r.project_id,
    unidade: r.unidade,
    valorCongelado: Number(r.valor_congelado),
    dataVenda: r.data_venda,
    dataDistrato: r.data_distrato,
  };
}

// Só leitura: sienge_vendas é escrita exclusivamente pelo trigger
// handle_sienge_tabela_venda_situacao_change no banco, nunca pelo client.
export async function fetchSiengeVendas(): Promise<SiengeVenda[]> {
  const { data, error } = await supabase.from('sienge_vendas').select('*');
  if (error) throw error;
  return (data || []).map(mapSiengeVenda);
}

export async function fetchSiengeOrcamentoConfig(): Promise<SiengeOrcamentoConfig> {
  const { data, error } = await supabase
    .from('sienge_orcamento_config')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();
  if (error) throw error;
  return { controleInicio: data?.controle_inicio || new Date().toISOString().slice(0, 10) };
}

export async function saveSiengeOrcamentoConfig(config: SiengeOrcamentoConfig) {
  const { error } = await supabase.from('sienge_orcamento_config').upsert({
    id: 'default',
    controle_inicio: config.controleInicio,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function applySiengeTabelaVendasReajuste(params: {
  projectId: string;
  unidadeIds: string[] | null;
  percentual: number;
  descricao?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('apply_sienge_tabela_vendas_reajuste', {
    p_project_id: params.projectId,
    p_unidade_ids: params.unidadeIds,
    p_percentual: params.percentual,
    p_descricao: params.descricao ?? null,
  });
  if (error) throw error;
  return data as string;
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

// ─── Sienge Faturas (Cartão de Crédito) ─────────────────────────

export async function fetchSiengeFaturas(): Promise<SiengeFatura[]> {
  const { data, error } = await supabase
    .from('sienge_faturas')
    .select('*')
    .order('seq', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any): SiengeFatura => ({
    id: r.id,
    codigo: r.codigo,
    status: r.status,
    createdAt: r.created_at,
    closedAt: r.closed_at,
    vencimento: r.vencimento,
    prazoPagamento: r.prazo_pagamento,
  }));
}

export async function saveSiengeFatura(fatura: SiengeFatura) {
  const { error } = await supabase.from('sienge_faturas').upsert({
    id: fatura.id,
    codigo: fatura.codigo,
    status: fatura.status,
    vencimento: fatura.vencimento || null,
    prazo_pagamento: fatura.prazoPagamento || null,
    closed_at: fatura.closedAt || null,
  });
  if (error) throw error;
}

export async function deleteSiengeFatura(id: string) {
  const { error } = await supabase.from('sienge_faturas').delete().eq('id', id);
  if (error) throw error;
}

// ─── Sienge Taxonomia (Centro de Custo / Categoria / Subcategoria) ──

export async function fetchSiengeCentrosCusto(): Promise<SiengeCentroCustoDef[]> {
  const { data, error } = await supabase.from('sienge_centros_custo').select('*').order('nome');
  if (error) throw error;
  return (data || []).map((r: any): SiengeCentroCustoDef => ({ id: r.id, nome: r.nome, createdAt: r.created_at }));
}

export async function addSiengeCentroCusto(nome: string): Promise<void> {
  const { error } = await supabase.from('sienge_centros_custo').insert({ nome });
  if (error) throw error;
}

export async function fetchSiengeCategorias(): Promise<SiengeCategoriaDef[]> {
  const { data, error } = await supabase.from('sienge_categorias').select('*').order('categoria');
  if (error) throw error;
  return (data || []).map((r: any): SiengeCategoriaDef => ({
    id: r.id, centroCusto: r.centro_custo, categoria: r.categoria, createdAt: r.created_at,
  }));
}

export async function addSiengeCategoria(centroCusto: string, categoria: string): Promise<void> {
  const { error } = await supabase.from('sienge_categorias').insert({ centro_custo: centroCusto, categoria });
  if (error) throw error;
}

export async function renameSiengeCategoria(id: string, categoria: string): Promise<void> {
  const { error } = await supabase.from('sienge_categorias').update({ categoria }).eq('id', id);
  if (error) throw error;
}

// Cascata: apagar a categoria remove suas subcategorias (FK on delete cascade).
export async function deleteSiengeCategoria(id: string): Promise<void> {
  const { error } = await supabase.from('sienge_categorias').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchSiengeSubcategorias(): Promise<SiengeSubcategoriaDef[]> {
  const { data, error } = await supabase.from('sienge_subcategorias').select('*').order('subcategoria');
  if (error) throw error;
  return (data || []).map((r: any): SiengeSubcategoriaDef => ({
    id: r.id, categoriaId: r.categoria_id, subcategoria: r.subcategoria, createdAt: r.created_at,
  }));
}

export async function addSiengeSubcategoria(categoriaId: string, subcategoria: string): Promise<void> {
  const { error } = await supabase.from('sienge_subcategorias').insert({ categoria_id: categoriaId, subcategoria });
  if (error) throw error;
}

export async function deleteSiengeSubcategoria(id: string): Promise<void> {
  const { error } = await supabase.from('sienge_subcategorias').delete().eq('id', id);
  if (error) throw error;
}
