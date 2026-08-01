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
  completedAt?: string; // ISO timestamp do último check (concluído ou cancelado)
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
  copyEditors?: CopyEditorItem[];
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
  resolved?: boolean;
  resolvedBy?: string;
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

export interface TaskHistoryEntry {
  id: string;
  taskId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string | null;
  changedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string; // e.g., 'text-purple-500' or hex
  status: 'active' | 'completed' | 'on_hold';
  coverImage?: string | null;
  code?: string | null;
  buildProgress?: number | null; // 0-100, evolução da obra
}

export type ViewType = 'home' | 'inbox' | 'tasks_board' | 'tasks_list' | 'projects' | 'calendar' | 'settings' | 'sienge' | 'dashboard';

export type SiengeStatus = 'a_lancar' | 'aprovacao_1' | 'aprovacao_2' | 'aprovacao_3' | 'aguardando_pagamento' | 'recusados' | 'pago';

export interface SiengeAlcadaConfig {
  alcada1UserId?: string;
  alcada2UserId?: string;
  alcada3UserId?: string;
}

/**
 * Integração WhatsApp (WAHA). A API key não vive aqui — fica como secret da
 * Edge Function `send-whatsapp`, fora do alcance do frontend.
 */
export interface WhatsAppConfig {
  enabled: boolean;
  baseUrl?: string;
  session: string;
}

export interface WhatsAppOutboxItem {
  id: string;
  notificationId?: string;
  userId?: string;
  phone: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: string;
  sentAt?: string;
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

// Cartão de Crédito invoice — parallel to SiengeLote, groups titles launched
// against the credit card instead of a bank-slip payment batch.
export interface SiengeFatura {
  id: string;
  codigo: string; // e.g. "FATJUL001" — FAT + 3-letter month + continuous 3-digit sequence
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

// Livre (não mais só 'comercial'|'marketing') — o painel de configuração permite
// adicionar novos centros de custo além dos dois fixos.
export type SiengeCentroCusto = string;

export interface SiengeCentroCustoDef {
  id: string;
  nome: string;
  createdAt: string;
}

export interface SiengeCategoriaDef {
  id: string;
  centroCusto: string;
  categoria: string;
  createdAt: string;
}

export interface SiengeSubcategoriaDef {
  id: string;
  categoriaId: string;
  subcategoria: string;
  createdAt: string;
}

export interface SiengeTitle {
  id: string;
  titulo: string;
  descricao?: string;
  valor: number;
  empreendimento?: string;
  centroCusto?: SiengeCentroCusto;
  categoria?: string;
  subcategoria?: string;
  vencimento?: string; // ISO date — current/active due date shown on the card
  vencimentoOriginal?: string; // ISO date — first due date recorded when the title entered 'aguardando_pagamento'; used to compute true days overdue across rejection/resolution cycles
  vencimentoHistory?: SiengeVencimentoHistoryEntry[]; // Past due dates, preserved for reporting
  lote?: string;       // legacy text field
  loteId?: string;     // FK to sienge_lotes — mutually exclusive with faturaId
  faturaId?: string;   // FK to sienge_faturas — set when launched against the credit card instead of a lote
  motivoDetalhado?: string; // Required extra detail for titles launched against the credit card
  assigneeId?: string; // User responsible
  reminderDate?: string;
  reminderType?: '3h' | '1d' | 'custom' | 'seen';
  attachments?: { id: string, name: string, url?: string, data?: string }[];
  chatMessages?: ChatMessage[];
  status: SiengeStatus;
  motivoRecusa?: string; // Reason recorded when status is set to 'recusados'
  motivoRecusaRegistradoEm?: string; // ISO timestamp of when the rejection was recorded
  motivoRecusaResolvido?: boolean; // True once the rejection reason has been addressed
  motivoRecusaResolvidoEm?: string; // ISO timestamp of when the rejection was marked resolved
  motivoRecusaObservacao?: string; // Optional note recorded when marking the rejection as resolved
  paidAt?: string; // ISO timestamp gravado pelo trigger set_paid_at no instante em que status entra em 'pago'
  createdAt: string;
  updatedAt: string;
}

export interface SiengeTitleStatusHistoryEntry {
  id: string;
  titleId: string;
  status: SiengeStatus;
  changedAt: string;
}

export interface SiengeProjectMeta {
  id: string;
  projectId: string;
  ano: number;
  mes: number; // 1-12
  vgvMeta: number;
  unidadesMeta: number;
  createdAt: string;
  updatedAt: string;
}

export interface SiengeProjectTotal {
  id: string;
  projectId: string;
  vgvTotal: number;
  unidadesTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface SiengeProjectDisplay {
  projectId: string;
  hidden: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface SiengeCategoriaOrcamento {
  id: string;
  projectId: string;
  centroCusto: SiengeCentroCusto;
  categoria: string;
  percentual: number; // % do VGV mensal
  createdAt: string;
  updatedAt: string;
}

export type SiengeVendaSituacao = 'vendida' | 'disponivel' | 'permuta' | 'bloqueada';

// Unidade, valor de tabela e situação são fixos (sustentam o congelamento de
// venda e o reajuste de INCC no banco). Todas as demais colunas variam por
// empreendimento e ficam em camposExtra, descritas por SiengeTabelaVendaColuna.
export interface SiengeTabelaVendaUnidade {
  id: string;
  projectId: string;
  unidade: string;
  valorTabela: number;
  situacao: SiengeVendaSituacao;
  camposExtra: Record<string, number | string>;
  descricao: string | null;
  compradorAtual: string | null;
  frozenSince: string | null;
  // Carimbo da confirmação explícita de venda. Só quando este campo muda no
  // mesmo UPDATE que leva a situação para "vendida" é que o snapshot em
  // sienge_vendas é gerado — importação de CSV e correção de planilha não
  // criam venda. Também é a data usada como dataVenda do snapshot.
  vendaConfirmadaEm: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SiengeColunaTipo = 'numero' | 'moeda' | 'texto' | 'area';

export interface SiengeTabelaVendaColuna {
  id: string;
  projectId: string;
  key: string;
  label: string;
  tipo: SiengeColunaTipo;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Snapshot imutável de venda — todos os valores da unidade (valor de tabela +
// colunas dinâmicas) e o comprador, congelados no instante em que a unidade
// virou "vendida". A Tabela de Vendas continua viva e sofre reajuste de INCC;
// o Histórico de Vendas e o cálculo de orçamento real usam sempre os valores
// congelados aqui, nunca os valores atuais da unidade.
export interface SiengeVenda {
  id: string;
  unidadeId: string;
  projectId: string;
  unidade: string;
  valorCongelado: number;
  camposExtraCongelados: Record<string, number | string>;
  comprador: string | null;
  dataVenda: string;
  dataDistrato: string | null;
}

export interface SiengeOrcamentoConfig {
  controleInicio: string; // YYYY-MM-DD — data a partir da qual o gasto real passa a ser contado
}

export type SiengeCalculoOperacao = 'dividir' | 'multiplicar';

// Regra de cálculo: vira uma coluna calculada na Tabela de Vendas — título +
// (percentual da colunaBaseKey) dividido ou multiplicado pela quantidade. A
// coluna base pode ser 'valor_tabela' ou qualquer key de SiengeTabelaVendaColuna
// do mesmo empreendimento (ex.: Rivage usa 'custo_construcao'). Regras sem
// 'operacao' (dados antigos) são tratadas como divisão, comportamento anterior.
export interface SiengeCalculoRegra {
  id: string;
  projectId: string;
  titulo: string;
  quantidade: number; // número de parcelas (divisão) ou multiplicador (multiplicação) — usado quando quantidadeColunaKey é null
  quantidadeColunaKey?: string | null; // se preenchido, a quantidade é lida dessa coluna (ou 'valor_tabela') em vez do número digitado
  operacao?: SiengeCalculoOperacao;
  percentual: number; // % da coluna base
  colunaBaseKey: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type SiengeValidacaoTipo = 'parcelas' | 'valor_unidade';

// Termo de uma fórmula de validação (ver SiengeValidacao): pra tipo 'parcelas',
// (quantidade × coluna); pra tipo 'valor_unidade', (sinal coluna).
export interface SiengeValidacaoTermo {
  colunaKey: string;
  quantidade?: number;
  sinal?: '+' | '-';
}

// Validação livre e persistida por empreendimento, montada em "Validar Tabela":
// 'parcelas' soma (quantidade × coluna) de cada termo e compara com referenciaKey;
// 'valor_unidade' soma/subtrai os termos (pelo sinal) e compara com Valor da
// Unidade (fixo, não configurável). Ambas esperam diferença = 0,00.
export interface SiengeValidacao {
  id: string;
  projectId: string;
  tipo: SiengeValidacaoTipo;
  titulo: string;
  termos: SiengeValidacaoTermo[];
  referenciaKey: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SiengeTabelaVendaRevisao {
  id: string;
  projectId: string;
  numero: number;
  tipo: 'geral' | 'seletiva';
  percentual: number;
  unidadesAfetadas: number;
  unidades: string[] | null;
  descricao: string | null;
  createdAt: string;
}
