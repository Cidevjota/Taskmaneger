import { supabase } from './supabase';
import { Task, Project, Label, Subtask, DesignBriefing, CopyBriefing, AppNotification } from '../types';

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
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      projectId: t.project_id,
      createdAt: t.created_at,
      dueDate: t.due_date,
      reminderDate: t.reminder_date,
      assigneeId: t.assignee_id,
      parentTaskId: t.parent_task_id,
      updatedBy: t.updated_by,
      chatMessages: t.chat_messages || [],
      designBriefing: t.design_briefing,
      copyBriefing: t.copy_briefing,
      planningBriefing: t.planning_briefing,
      attachments: t.planning_briefing?.attachments || [],
      proposals: t.planning_briefing?.proposals || [],
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

// Write Operations
export async function saveTask(task: Task) {
  // 1. Upsert main task
  const { error: taskError } = await supabase.from('tasks').upsert({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    project_id: task.projectId,
    created_at: task.createdAt,
    due_date: task.dueDate || null,
    reminder_date: task.reminderDate || null,
    assignee_id: task.assigneeId || null,
    parent_task_id: task.parentTaskId || null,
    updated_by: task.updatedBy || null,
    chat_messages: task.chatMessages || [],
    design_briefing: task.designBriefing,
    copy_briefing: task.copyBriefing,
    planning_briefing: {
      ...(task.planningBriefing || {}),
      attachments: task.attachments || [],
      proposals: task.proposals || []
    }
  });
  if (taskError) throw taskError;

  // 2. Sync Labels (delete existing, insert new)
  // First clear old ones
  await supabase.from('task_labels').delete().eq('task_id', task.id);
  // Insert new
  if (task.labels && task.labels.length > 0) {
    const labelInserts = task.labels.map(l => ({
      task_id: task.id,
      label_id: l.id
    }));
    await supabase.from('task_labels').insert(labelInserts);
  }

  // 3. Sync Subtasks
  // Supabase doesn't easily do full nested replace without deleting first.
  // We'll delete old subtasks and insert the new array
  await supabase.from('subtasks').delete().eq('task_id', task.id);
  
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
    await supabase.from('subtasks').insert(subtaskInserts);
  }
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}

export async function saveProject(project: Project) {
  const { error } = await supabase.from('projects').upsert(project);
  if (error) throw error;
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId);
    
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
