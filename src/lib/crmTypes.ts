// Tipos do CRM SDR. Ficam fora de src/types.ts porque o domínio é fechado em si
// mesmo — só o ViewType 'crm' precisa ser conhecido pelo resto do app.

export type CrmEtapa =
  | 'novo'
  | 'primeiro_contato'
  | 'sem_resposta'
  | 'em_conversa'
  | 'retomada'
  | 'parou_de_responder'
  | 'enviado_cv';

export type CrmTemperatura = 'frio' | 'morno' | 'quente';
export type CrmObjetivo = 'morar' | 'investir';
export type CrmPrioridade = 'baixa' | 'media' | 'alta' | 'urgente';
export type CrmAcaoStatus = 'pendente' | 'concluida' | 'cancelada';
export type CrmRole = 'administrador' | 'sdr' | 'gestao';

/** Ordem das colunas do kanban — é também a ordem do funil. */
export const CRM_ETAPAS: {
  id: CrmEtapa;
  label: string;
  descricao: string;
  dot: string;
  accentBg: string;
  accentBorder: string;
}[] = [
  {
    id: 'novo',
    label: 'Novo',
    descricao: 'Lead acabou de entrar no CRM SDR.',
    dot: 'bg-blue-500',
    accentBg: 'bg-blue-500/[0.04]',
    accentBorder: 'border-blue-500/30',
  },
  {
    id: 'primeiro_contato',
    label: 'Primeiro contato',
    descricao: 'A SDR iniciou o trabalho com o lead.',
    dot: 'bg-sky-500',
    accentBg: 'bg-sky-500/[0.04]',
    accentBorder: 'border-sky-500/30',
  },
  {
    id: 'sem_resposta',
    label: 'Sem resposta',
    descricao: 'Não retornou nenhuma mensagem.',
    dot: 'bg-zinc-500',
    accentBg: 'bg-zinc-500/[0.06]',
    accentBorder: 'border-zinc-500/30',
  },
  {
    id: 'em_conversa',
    label: 'Em conversa',
    descricao: 'Respondeu a qualquer interação.',
    dot: 'bg-emerald-500',
    accentBg: 'bg-emerald-500/[0.04]',
    accentBorder: 'border-emerald-500/30',
  },
  {
    id: 'retomada',
    label: 'Retomada',
    descricao: 'Voltou a responder.',
    dot: 'bg-teal-500',
    accentBg: 'bg-teal-500/[0.04]',
    accentBorder: 'border-teal-500/30',
  },
  {
    id: 'parou_de_responder',
    label: 'Parou de responder',
    descricao: 'Parou de responder por mais de 1 dia.',
    dot: 'bg-amber-500',
    accentBg: 'bg-amber-500/[0.04]',
    accentBorder: 'border-amber-500/30',
  },
  {
    id: 'enviado_cv',
    label: 'Enviado ao CV CRM',
    descricao: 'Encaminhado para continuidade do atendimento comercial.',
    dot: 'bg-violet-500',
    accentBg: 'bg-violet-500/[0.04]',
    accentBorder: 'border-violet-500/30',
  },
];

export const CRM_ETAPA_LABEL: Record<CrmEtapa, string> = CRM_ETAPAS.reduce(
  (acc, e) => ({ ...acc, [e.id]: e.label }),
  {} as Record<CrmEtapa, string>
);

export const CRM_TEMPERATURAS: { id: CrmTemperatura; label: string; text: string; bg: string }[] = [
  { id: 'frio',   label: 'Frio',   text: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/25' },
  { id: 'morno',  label: 'Morno',  text: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/25' },
  { id: 'quente', label: 'Quente', text: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/25' },
];

export const CRM_PRIORIDADES: { id: CrmPrioridade; label: string; text: string }[] = [
  { id: 'baixa',   label: 'Baixa',   text: 'text-zinc-400' },
  { id: 'media',   label: 'Média',   text: 'text-sky-400' },
  { id: 'alta',    label: 'Alta',    text: 'text-amber-400' },
  { id: 'urgente', label: 'Urgente', text: 'text-rose-400' },
];

/** Tipos de próxima ação. Os cinco primeiros são os exemplos do briefing. */
export const CRM_TIPOS_ACAO = [
  'WhatsApp',
  'Ligação',
  'Follow-up',
  'Aguardar retorno',
  'Transferir para CV CRM',
] as const;

export interface CrmOrigem {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export interface CrmFaixaInvestimento {
  id: string;
  label: string;
  valorMin: number | null;
  valorMax: number | null;
  ordem: number;
  ativo: boolean;
}

export interface CrmEventType {
  id: string;
  slug: string;
  label: string;
  /** Nome do ícone lucide-react. */
  icone: string;
  /** Família de cor Tailwind (emerald, sky, amber…). */
  cor: string;
  ordem: number;
  ativo: boolean;
  /** Eventos de sistema não podem ser removidos nem viram botão. */
  sistema: boolean;
  requerDetalhe: boolean;
}

export interface CrmLead {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  projectId?: string | null;
  origemId?: string | null;
  etapa: CrmEtapa;
  temperatura: CrmTemperatura;
  responsavelId?: string | null;
  objetivo?: CrmObjetivo | null;
  faixaId?: string | null;
  entradaEm: string;
  ultimaInteracaoEm?: string | null;
  enviadoCvEm?: string | null;
  observacoes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmLeadEvent {
  id: string;
  leadId: string;
  eventTypeId?: string | null;
  slug: string;
  label: string;
  detalhe?: string | null;
  ocorridoEm: string;
  createdBy?: string | null;
}

export interface CrmNextAction {
  id: string;
  leadId: string;
  tipo: string;
  agendadoPara: string;
  prioridade: CrmPrioridade;
  status: CrmAcaoStatus;
  observacao?: string | null;
  responsavelId?: string | null;
  concluidaEm?: string | null;
  createdAt: string;
}

/** Unidade do intervalo de uma etapa da cadência — minutos para ações rápidas, horas para o resto. */
export type CrmIntervaloUnidade = 'minutos' | 'horas';

export interface CrmCadenciaEtapa {
  id: string;
  cadenciaId: string;
  ordem: number;
  tipo: string;
  intervaloValor: number;
  intervaloUnidade: CrmIntervaloUnidade;
  mensagem?: string | null;
  ativo: boolean;
}

export interface CrmCadencia {
  id: string;
  nome: string;
  descricao?: string | null;
  /** Etapa do funil (prefixo "etapa:") ou situação específica que dispara a cadência. */
  gatilho: string;
  ativo: boolean;
  horaInicio: string;
  horaFim: string;
  diasSemana: number[];
  ordem: number;
}

/** Linha única de configurações gerais da operação. */
export interface CrmConfig {
  /** Horas sem interação até um lead "em conversa" virar "parou de responder". */
  horasParaParouDeResponder: number;
  /** SLA em minutos para o primeiro contato de um lead novo. */
  slaPrimeiroContatoMin: number;
  /** Janela, em minutos, do que a tela considera "para agora". */
  janelaAgoraMin: number;
  horarioInicio: string;
  horarioFim: string;
  diasSemana: number[];
}

export const CRM_CONFIG_PADRAO: CrmConfig = {
  horasParaParouDeResponder: 24,
  slaPrimeiroContatoMin: 15,
  janelaAgoraMin: 60,
  horarioInicio: '09:00',
  horarioFim: '18:00',
  diasSemana: [1, 2, 3, 4, 5],
};

export const CRM_DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Filtros do kanban de leads. */
export interface CrmLeadFilters {
  etapas: CrmEtapa[];
  projectIds: string[];
  origemIds: string[];
  responsavelIds: string[];
  /** ISO date (yyyy-mm-dd) — leads que entraram a partir / até. */
  entradaDe?: string;
  entradaAte?: string;
  /** Recorte da próxima ação. */
  proximaAcao: 'todas' | 'hoje' | 'agora' | 'atrasadas' | 'sem_acao';
  /** Só leads com ação pendente vencida. */
  somenteAtrasados: boolean;
  /** 'incluir' (padrão), 'ocultar' ou 'somente' os já enviados ao CV CRM. */
  enviadosCv: 'incluir' | 'ocultar' | 'somente';
  busca: string;
}

export const CRM_FILTROS_VAZIOS: CrmLeadFilters = {
  etapas: [],
  projectIds: [],
  origemIds: [],
  responsavelIds: [],
  proximaAcao: 'todas',
  somenteAtrasados: false,
  enviadosCv: 'incluir',
  busca: '',
};

export function crmFiltrosAtivos(f: CrmLeadFilters): number {
  return (
    f.etapas.length +
    f.projectIds.length +
    f.origemIds.length +
    f.responsavelIds.length +
    (f.entradaDe ? 1 : 0) +
    (f.entradaAte ? 1 : 0) +
    (f.proximaAcao !== 'todas' ? 1 : 0) +
    (f.somenteAtrasados ? 1 : 0) +
    (f.enviadosCv !== 'incluir' ? 1 : 0) +
    (f.busca.trim() ? 1 : 0)
  );
}
