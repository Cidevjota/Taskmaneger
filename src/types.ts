export type TaskStatus = 'no_forecast' | 'todo' | 'in_progress' | 'paused' | 'approval' | 'rework' | 'implementation' | 'done';

export type TaskPriority = 'no_priority' | 'low' | 'medium' | 'high' | 'urgent';

export interface StatusHistoryEntry {
  status: TaskStatus;
  enteredAt: string; // ISO date
  leftAt?: string; // ISO date
}

export interface Label {
  id: string;
  name: string;
  color: string; // Tailwind color class or hex (e.g., 'bg-blue-500/10 text-blue-500')
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  canceled?: boolean;
  reminderDate?: string;
  reminderType?: '3h' | '1d' | 'custom' | 'seen';
  assigneeId?: string;
  level?: number;
  completedAt?: string; // ISO timestamp when marked completed
}

export interface FormatoPersonalizado {
  width: string;
  height: string;
  unit: string;
}

export interface DeliveryThreadMessage {
  id: string;
  role: 'designer' | 'manager';
  type: 'submission' | 'feedback' | 'reply' | 'chat';
  action?: 'approved' | 'rejected' | 'request_review' | 'will_rework';
  content: string;
  imageUrl?: string;
  imageUrls?: string[]; // Suporte para múltiplas imagens
  annotatedImageUrl?: string;
  annotatedImageUrls?: string[];
  copyText?: string;
  editorName?: string;
  authorId?: string;
  authorName?: string;
  majorVersion?: number; // X in X.Y
  minorVersion?: number; // Y in X.Y
  revisionNumber?: number; // Legacy
  createdAt: string;
  resolved?: boolean;
}

export interface Delivery {
  id: string;
  imageUrl?: string; // URL do print original ou mais recente
  imageUrls?: string[]; // Múltiplos prints do criativo
  thumbnailUrl?: string; // URL comprimida (para histórico apos 30 dias)
  figmaLink?: string;
  creativeDefense?: string; // Legacy
  status: 'pending' | 'approved' | 'rejected' | 'reworking' | 'review_requested';
  rejectedFeedback?: string; // Legacy
  annotatedImageUrl?: string; // Legacy
  annotatedImageUrls?: string[]; // Multiple annotated images
  thread: DeliveryThreadMessage[];
  createdAt: string; // Usado para a política de retenção
  approverId?: string; // Aprovador do criativo
}

export interface DesignBriefing {
  isFilled: boolean;
  objetivos: string[];
  tipoPeca: string[];
  formatosEspecificos?: Record<string, string[]>;
  formatosPersonalizados?: Record<string, FormatoPersonalizado>;
  mensagemPrincipal: string;
  direcaoCriativa: string[];
  direcaoFoco?: string[];
  inspiracoes?: string[];
  copyContent?: string;
  deliveries?: Delivery[];
}

export interface CopyEditorItem {
  id: string;
  name: string;
  content: string;
}

export interface CopyBriefing {
  isFilled: boolean;
  perfilPrimario: string[];
  momentoCompra: string[];
  faixaRenda: string[];
  desejoSonho: string[];
  objecoes: string[];
  objetivoMarketing: string[];
  etapaFunil: string[];
  acaoUnica: string[];
  tomPeca: string[];
  comoMarcaPercebida: string[];
  canalVeiculacao: string[];
  formatoPeca: string[];
  extensaoTexto: string[];
  textoCopy?: string;
  copyEditors?: CopyEditorItem[];
  deliveries?: Delivery[];
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  isLink?: boolean;
  approvalStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  approverId?: string;
}

export interface ProposalComment {
  id: string;
  userId?: string;
  userName?: string;
  content: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  actorId: string;
  taskId?: string;
  siengeTitleId?: string;
  type: 'task_assigned' | 'task_deleted' | 'status_changed' | 'assignee_replaced' | 'properties_changed' | 'feedback_received' | 'rejected' | 'review_requested' | 'approved' | 'reminder' | 'deadline' | 'deadline_changed' | 'approval_pending' | 'chat_mention' | 'alcada_pending';
  status: 'unread' | 'read' | 'viewed' | 'postponed' | 'important';
  createdAt: string;
  viewedAt?: string;
  postponedUntil?: string;
  message: string;
  details?: string;
  targetId?: string;
}

export interface Proposal {
  id: string;
  empresa: string;
  valor: string;
  negociado: string;
  documento: string;
  observacao: string;
  valorUnitario?: string;
  valorM2?: string;
  valorMensal?: string;
  approvalStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  approverId?: string;
  comments?: ProposalComment[];
}

export interface PlanningBriefing {
  text: string;
  attachments: Attachment[];
  objetivosPrincipais?: string[];
  objetivoAberto?: string;
  motivacoes?: string[];
  motivacaoAberta?: string;
  campanhaConectada?: string;
  publicoAlvo?: string[];
  nivelConhecimento?: string[];
  isFilled?: boolean;
}

export interface SocialMediaApprovalData {
  selectedDesignDeliveryId?: string;
  selectedDesignTaskId?: string;
  selectedCopyEditorId?: string;
  selectedCopyTaskId?: string;
  status?: 'pending' | 'review_requested' | 'approved' | 'rejected';
  approverId?: string;
  requesterId?: string;
}

export interface TaskTimeTracking {
  accumulatedMs: number;
  lastStartedAt?: string;
  isTimerRunning: boolean;
  reachedImplementationAt?: string;
}

export interface RoutineConfig {
  active: boolean;
  type: 'interval' | 'weekdays';
  intervalValue?: number; // X for days, weeks, or months
  intervalUnit?: 'days' | 'weeks' | 'months';
  weekdays?: number[]; // [1, 2, 3, 4, 5] (Monday to Friday, using 1-7 or 0-6 convention. We'll use 1=Monday...5=Friday)
  lastDuplicatedAt?: string; // ISO date of last duplication
  originalSnapshot?: any; // Snapshot of the task when routine was activated
}

export interface Task {
  id: string; // Internal UUID
  taskCode?: string; // Visual display code (e.g., TSK-123)
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  updatedBy?: string; // Tracks the user who last modified the task
  labels: Label[];
  subtasks: Subtask[];
  attachments?: Attachment[];
  designBriefing?: DesignBriefing;
  copyBriefing?: CopyBriefing;
  planningBriefing?: PlanningBriefing;
  socialMediaApproval?: SocialMediaApprovalData;
  proposals?: Proposal[];
  chatMessages?: ChatMessage[];
  dueDate?: string; // ISO date format like '2026-06-20'
  plannedDate?: string; // Weekly Planner allocation date (YYYY-MM-DD)
  createdAt: string;
  assigneeId?: string;
  parentTaskId?: string;
  reminderDate?: string;
  reminderType?: '3h' | '1d' | 'custom' | 'seen';
  timeTracking?: TaskTimeTracking;
  reworkCount?: number;
  statusHistory?: StatusHistoryEntry[];
  updatedAt?: string;
  routine?: RoutineConfig;
  routineOriginId?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string; // e.g., 'text-purple-500' or hex
  status: 'active' | 'completed' | 'on_hold';
}

export type ViewType = 'home' | 'inbox' | 'tasks_board' | 'tasks_list' | 'projects' | 'calendar' | 'settings' | 'sienge' | 'dashboard';

export type SiengeStatus = 'a_lancar' | 'aprovacao_1' | 'aprovacao_2' | 'aprovacao_3' | 'aguardando_pagamento' | 'recusados' | 'pago';

export interface SiengeAlcadaConfig {
  alcada1UserId?: string;
  alcada2UserId?: string;
  alcada3UserId?: string;
}

export type SiengeLoteStatus = 'aberto' | 'encerrado';

export interface SiengeLote {
  id: string;
  nome: string;
  status: SiengeLoteStatus;
  createdAt: string;
  closedAt?: string;
  vencimento?: string;      // ISO date
  prazoPagamento?: string;  // ISO date
}

export interface SiengeVencimentoHistoryEntry {
  vencimento: string;    // Previous due date, replaced by a resolution
  changedAt: string;     // ISO timestamp of the replacement
  observacao?: string;   // Optional note explaining the change
}

export interface SiengeTitle {
  id: string;
  titulo: string;
  descricao?: string;
  valor: number;
  empreendimento?: string;
  vencimento?: string; // ISO date — current/active due date shown on the card
  vencimentoOriginal?: string; // ISO date — first due date recorded when the title entered 'aguardando_pagamento'; used to compute true days overdue across rejection/resolution cycles
  vencimentoHistory?: SiengeVencimentoHistoryEntry[]; // Past due dates, preserved for reporting
  lote?: string;       // legacy text field
  loteId?: string;     // FK to sienge_lotes
  assigneeId?: string; // User responsible
  reminderDate?: string;
  reminderType?: '3h' | '1d' | 'custom' | 'seen';
  attachments?: { id: string, name: string, url?: string, data?: string }[];
  status: SiengeStatus;
  motivoRecusa?: string; // Reason recorded when status is set to 'recusados'
  motivoRecusaRegistradoEm?: string; // ISO timestamp of when the rejection was recorded
  motivoRecusaResolvido?: boolean; // True once the rejection reason has been addressed
  motivoRecusaResolvidoEm?: string; // ISO timestamp of when the rejection was marked resolved
  motivoRecusaObservacao?: string; // Optional note recorded when marking the rejection as resolved
  createdAt: string;
  updatedAt: string;
}
