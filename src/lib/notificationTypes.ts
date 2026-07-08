import { AppNotification } from '../types';

export type NotificationType = AppNotification['type'];

export interface NotificationTypeGroup {
  label: string;
  types: { type: NotificationType; label: string }[];
}

// The 6 milestones fired for type: 'deadline' (see App.tsx checkReminders).
// Stored as notif.targetId so each milestone can be toggled independently.
export const DEADLINE_MILESTONES: { key: string; label: string }[] = [
  { key: '3d', label: 'Prazo em 3 dias' },
  { key: '1d', label: 'Prazo amanhã' },
  { key: '0d', label: 'Prazo vencendo hoje' },
  { key: '-3d', label: 'Atrasado (3 dias)' },
  { key: '-7d', label: 'Atrasado (7 dias)' },
  { key: '-15d', label: 'Atrasado (15 dias)' },
];

export const NOTIFICATION_GROUPS: NotificationTypeGroup[] = [
  {
    label: 'Tarefas',
    types: [
      { type: 'task_assigned', label: 'Tarefa atribuída a mim' },
      { type: 'task_deleted', label: 'Tarefa excluída' },
      { type: 'status_changed', label: 'Mudança de status' },
      { type: 'assignee_replaced', label: 'Troca de responsável' },
      { type: 'properties_changed', label: 'Alteração de propriedades' },
      { type: 'deadline_changed', label: 'Alteração de prazo' },
    ],
  },
  {
    label: 'Aprovações e Revisões',
    types: [
      { type: 'review_requested', label: 'Solicitação de revisão' },
      { type: 'approval_pending', label: 'Aprovação pendente' },
      { type: 'approved', label: 'Aprovado' },
      { type: 'rejected', label: 'Reprovado' },
      { type: 'feedback_received', label: 'Feedback recebido' },
    ],
  },
  {
    label: 'Lembretes',
    types: [
      { type: 'reminder', label: 'Lembretes' },
    ],
  },
  {
    label: 'Chat',
    types: [
      { type: 'chat_mention', label: 'Menções no chat' },
    ],
  },
  {
    label: 'Alçadas Sienge',
    types: [
      { type: 'alcada_pending', label: 'Título aguardando minha aprovação' },
    ],
  },
];

// A notification type is enabled unless the user has explicitly turned it off.
// For type 'deadline', pass the notification's targetId as `milestone` to check
// the specific milestone toggle (see DEADLINE_MILESTONES); an object is stored
// at preferences.notifications.deadline mapping milestone key -> boolean.
export function isNotificationTypeEnabled(preferences: any, type: NotificationType, milestone?: string): boolean {
  const prefs = preferences?.notifications;
  if (!prefs) return true;

  if (type === 'deadline') {
    const deadlinePrefs = prefs.deadline;
    if (deadlinePrefs === undefined) return true;
    if (typeof deadlinePrefs === 'boolean') return deadlinePrefs; // legacy flat toggle
    if (!milestone || deadlinePrefs[milestone] === undefined) return true;
    return !!deadlinePrefs[milestone];
  }

  if (prefs[type] === undefined) return true;
  return !!prefs[type];
}
