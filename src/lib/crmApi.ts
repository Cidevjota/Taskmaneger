import { supabase } from './supabase';
import {
  CrmCadencia,
  CrmCadenciaEtapa,
  CrmConfig,
  CrmEtapa,
  CrmEventType,
  CrmFaixaInvestimento,
  CrmLead,
  CrmLeadEvent,
  CrmNextAction,
  CrmOrigem,
  CRM_CONFIG_PADRAO,
} from './crmTypes';

// ── mapeadores ────────────────────────────────────────────────────────────────
// O banco fala snake_case e o app camelCase; a conversão fica concentrada aqui
// para que nenhuma tela precise conhecer o nome das colunas.

const toOrigem = (r: any): CrmOrigem => ({
  id: r.id, nome: r.nome, ordem: r.ordem, ativo: r.ativo,
});

const toFaixa = (r: any): CrmFaixaInvestimento => ({
  id: r.id,
  label: r.label,
  valorMin: r.valor_min === null ? null : Number(r.valor_min),
  valorMax: r.valor_max === null ? null : Number(r.valor_max),
  ordem: r.ordem,
  ativo: r.ativo,
});

const toEventType = (r: any): CrmEventType => ({
  id: r.id, slug: r.slug, label: r.label, icone: r.icone, cor: r.cor,
  ordem: r.ordem, ativo: r.ativo, sistema: r.sistema, requerDetalhe: r.requer_detalhe,
});

const toLead = (r: any): CrmLead => ({
  id: r.id,
  nome: r.nome,
  telefone: r.telefone,
  email: r.email,
  projectId: r.project_id,
  origemId: r.origem_id,
  etapa: r.etapa,
  temperatura: r.temperatura,
  responsavelId: r.responsavel_id,
  objetivo: r.objetivo,
  faixaId: r.faixa_id,
  entradaEm: r.entrada_em,
  ultimaInteracaoEm: r.ultima_interacao_em,
  enviadoCvEm: r.enviado_cv_em,
  observacoes: r.observacoes,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toEvent = (r: any): CrmLeadEvent => ({
  id: r.id, leadId: r.lead_id, eventTypeId: r.event_type_id, slug: r.slug,
  label: r.label, detalhe: r.detalhe, ocorridoEm: r.ocorrido_em, createdBy: r.created_by,
});

const toAction = (r: any): CrmNextAction => ({
  id: r.id, leadId: r.lead_id, tipo: r.tipo, agendadoPara: r.agendado_para,
  prioridade: r.prioridade, status: r.status, observacao: r.observacao,
  responsavelId: r.responsavel_id, concluidaEm: r.concluida_em, createdAt: r.created_at,
});

const toCadencia = (r: any): CrmCadencia => ({
  id: r.id, nome: r.nome, descricao: r.descricao, gatilho: r.gatilho, ativo: r.ativo,
  maxTentativas: r.max_tentativas,
  horaInicio: String(r.hora_inicio).slice(0, 5),
  horaFim: String(r.hora_fim).slice(0, 5),
  diasSemana: r.dias_semana || [],
  prioridade: r.prioridade, slaHoras: r.sla_horas, ordem: r.ordem,
});

const toCadenciaEtapa = (r: any): CrmCadenciaEtapa => ({
  id: r.id, cadenciaId: r.cadencia_id, ordem: r.ordem, tipo: r.tipo,
  intervaloHoras: r.intervalo_horas, mensagem: r.mensagem, ativo: r.ativo,
});

function unwrap<T>(data: T | null, error: any, contexto: string): T {
  if (error) throw new Error(`[CRM] ${contexto}: ${error.message}`);
  return data as T;
}

// ── catálogos ─────────────────────────────────────────────────────────────────
export async function fetchCrmOrigens(): Promise<CrmOrigem[]> {
  const { data, error } = await supabase.from('crm_origens').select('*').order('ordem');
  return unwrap(data, error, 'origens').map(toOrigem);
}

export async function saveCrmOrigem(o: Partial<CrmOrigem> & { nome: string }) {
  const payload: any = { nome: o.nome, ordem: o.ordem ?? 0, ativo: o.ativo ?? true };
  if (o.id) payload.id = o.id;
  const { error } = await supabase.from('crm_origens').upsert(payload);
  if (error) throw new Error(`[CRM] salvar origem: ${error.message}`);
}

export async function deleteCrmOrigem(id: string) {
  const { error } = await supabase.from('crm_origens').delete().eq('id', id);
  if (error) throw new Error(`[CRM] excluir origem: ${error.message}`);
}

export async function fetchCrmFaixas(): Promise<CrmFaixaInvestimento[]> {
  const { data, error } = await supabase.from('crm_faixas_investimento').select('*').order('ordem');
  return unwrap(data, error, 'faixas').map(toFaixa);
}

export async function saveCrmFaixa(f: Partial<CrmFaixaInvestimento> & { label: string }) {
  const payload: any = {
    label: f.label,
    valor_min: f.valorMin ?? null,
    valor_max: f.valorMax ?? null,
    ordem: f.ordem ?? 0,
    ativo: f.ativo ?? true,
  };
  if (f.id) payload.id = f.id;
  const { error } = await supabase.from('crm_faixas_investimento').upsert(payload);
  if (error) throw new Error(`[CRM] salvar faixa: ${error.message}`);
}

export async function deleteCrmFaixa(id: string) {
  const { error } = await supabase.from('crm_faixas_investimento').delete().eq('id', id);
  if (error) throw new Error(`[CRM] excluir faixa: ${error.message}`);
}

export async function fetchCrmEventTypes(): Promise<CrmEventType[]> {
  const { data, error } = await supabase.from('crm_event_types').select('*').order('ordem');
  return unwrap(data, error, 'tipos de evento').map(toEventType);
}

export async function saveCrmEventType(t: Partial<CrmEventType> & { slug: string; label: string }) {
  const payload: any = {
    slug: t.slug, label: t.label, icone: t.icone ?? 'Circle', cor: t.cor ?? 'zinc',
    ordem: t.ordem ?? 0, ativo: t.ativo ?? true, requer_detalhe: t.requerDetalhe ?? false,
  };
  if (t.id) payload.id = t.id;
  const { error } = await supabase.from('crm_event_types').upsert(payload, { onConflict: 'slug' });
  if (error) throw new Error(`[CRM] salvar tipo de evento: ${error.message}`);
}

export async function deleteCrmEventType(id: string) {
  const { error } = await supabase.from('crm_event_types').delete().eq('id', id);
  if (error) throw new Error(`[CRM] excluir tipo de evento: ${error.message}`);
}

// ── leads ─────────────────────────────────────────────────────────────────────
export async function fetchCrmLeads(): Promise<CrmLead[]> {
  const { data, error } = await supabase
    .from('crm_leads')
    .select('*')
    .order('entrada_em', { ascending: false });
  return unwrap(data, error, 'leads').map(toLead);
}

export async function saveCrmLead(lead: Partial<CrmLead> & { nome: string }): Promise<CrmLead> {
  const { data: session } = await supabase.auth.getUser();
  const payload: any = {
    nome: lead.nome,
    telefone: lead.telefone || null,
    email: lead.email || null,
    project_id: lead.projectId || null,
    origem_id: lead.origemId || null,
    etapa: lead.etapa ?? 'novo',
    temperatura: lead.temperatura ?? 'morno',
    responsavel_id: lead.responsavelId || null,
    objetivo: lead.objetivo || null,
    faixa_id: lead.faixaId || null,
    observacoes: lead.observacoes ?? null,
    enviado_cv_em: lead.enviadoCvEm ?? null,
  };
  if (lead.id) {
    payload.id = lead.id;
  } else {
    payload.created_by = session?.user?.id ?? null;
    if (lead.entradaEm) payload.entrada_em = lead.entradaEm;
  }
  const { data, error } = await supabase.from('crm_leads').upsert(payload).select().single();
  return toLead(unwrap(data, error, 'salvar lead'));
}

/** Move o lead de etapa. `enviado_cv` carimba a data de envio (e só a primeira vez). */
export async function moveCrmLead(leadId: string, etapa: CrmEtapa): Promise<CrmLead> {
  const payload: any = { etapa };
  if (etapa === 'enviado_cv') payload.enviado_cv_em = new Date().toISOString();
  const { data, error } = await supabase
    .from('crm_leads').update(payload).eq('id', leadId).select().single();
  return toLead(unwrap(data, error, 'mover lead'));
}

export async function deleteCrmLead(id: string) {
  const { error } = await supabase.from('crm_leads').delete().eq('id', id);
  if (error) throw new Error(`[CRM] excluir lead: ${error.message}`);
}

// ── timeline ──────────────────────────────────────────────────────────────────
/** Todos os eventos, de todos os leads — a timeline de um lead é uma fatia disto. */
export async function fetchCrmEvents(): Promise<CrmLeadEvent[]> {
  const { data, error } = await supabase
    .from('crm_lead_events')
    .select('*')
    .order('ocorrido_em', { ascending: false })
    .limit(5000);
  return unwrap(data, error, 'eventos').map(toEvent);
}

export async function fetchCrmLeadEvents(leadId: string): Promise<CrmLeadEvent[]> {
  const { data, error } = await supabase
    .from('crm_lead_events')
    .select('*')
    .eq('lead_id', leadId)
    .order('ocorrido_em', { ascending: false });
  return unwrap(data, error, 'timeline do lead').map(toEvent);
}

export async function registrarCrmEvento(params: {
  leadId: string;
  tipo: CrmEventType;
  detalhe?: string | null;
}): Promise<CrmLeadEvent> {
  const { data: session } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('crm_lead_events')
    .insert({
      lead_id: params.leadId,
      event_type_id: params.tipo.id,
      slug: params.tipo.slug,
      label: params.tipo.label,
      detalhe: params.detalhe || null,
      created_by: session?.user?.id ?? null,
    })
    .select()
    .single();
  return toEvent(unwrap(data, error, 'registrar evento'));
}

export async function deleteCrmEvento(id: string) {
  const { error } = await supabase.from('crm_lead_events').delete().eq('id', id);
  if (error) throw new Error(`[CRM] excluir evento: ${error.message}`);
}

// ── próximas ações ────────────────────────────────────────────────────────────
export async function fetchCrmActions(): Promise<CrmNextAction[]> {
  const { data, error } = await supabase
    .from('crm_next_actions')
    .select('*')
    .order('agendado_para');
  return unwrap(data, error, 'próximas ações').map(toAction);
}

/**
 * Grava a próxima ação do lead. Como o banco só admite uma pendência por lead
 * (índice parcial), a anterior é cancelada antes — assim "reagendar" é uma
 * operação só, e duas abas abertas não brigam pelo índice.
 */
export async function salvarProximaAcao(a: {
  id?: string;
  leadId: string;
  tipo: string;
  agendadoPara: string;
  prioridade: CrmNextAction['prioridade'];
  observacao?: string | null;
  responsavelId?: string | null;
}): Promise<CrmNextAction> {
  const { data: session } = await supabase.auth.getUser();
  if (!a.id) {
    const { error: cancelErr } = await supabase
      .from('crm_next_actions')
      .update({ status: 'cancelada' })
      .eq('lead_id', a.leadId)
      .eq('status', 'pendente');
    if (cancelErr) throw new Error(`[CRM] cancelar ação anterior: ${cancelErr.message}`);
  }
  const payload: any = {
    lead_id: a.leadId,
    tipo: a.tipo,
    agendado_para: a.agendadoPara,
    prioridade: a.prioridade,
    status: 'pendente',
    observacao: a.observacao || null,
    responsavel_id: a.responsavelId || null,
  };
  if (a.id) payload.id = a.id;
  else payload.created_by = session?.user?.id ?? null;

  const { data, error } = await supabase.from('crm_next_actions').upsert(payload).select().single();
  return toAction(unwrap(data, error, 'salvar próxima ação'));
}

export async function concluirProximaAcao(id: string): Promise<CrmNextAction> {
  const { data, error } = await supabase
    .from('crm_next_actions')
    .update({ status: 'concluida', concluida_em: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return toAction(unwrap(data, error, 'concluir ação'));
}

export async function cancelarProximaAcao(id: string): Promise<CrmNextAction> {
  const { data, error } = await supabase
    .from('crm_next_actions')
    .update({ status: 'cancelada' })
    .eq('id', id)
    .select()
    .single();
  return toAction(unwrap(data, error, 'cancelar ação'));
}

// ── cadências ─────────────────────────────────────────────────────────────────
export async function fetchCrmCadencias(): Promise<CrmCadencia[]> {
  const { data, error } = await supabase.from('crm_cadencias').select('*').order('ordem');
  return unwrap(data, error, 'cadências').map(toCadencia);
}

export async function saveCrmCadencia(c: Partial<CrmCadencia> & { nome: string }): Promise<CrmCadencia> {
  const payload: any = {
    nome: c.nome,
    descricao: c.descricao ?? null,
    gatilho: c.gatilho ?? 'manual',
    ativo: c.ativo ?? true,
    max_tentativas: c.maxTentativas ?? 5,
    hora_inicio: c.horaInicio ?? '09:00',
    hora_fim: c.horaFim ?? '18:00',
    dias_semana: c.diasSemana ?? [1, 2, 3, 4, 5],
    prioridade: c.prioridade ?? 'media',
    sla_horas: c.slaHoras ?? 24,
    ordem: c.ordem ?? 0,
  };
  if (c.id) payload.id = c.id;
  const { data, error } = await supabase.from('crm_cadencias').upsert(payload).select().single();
  return toCadencia(unwrap(data, error, 'salvar cadência'));
}

export async function deleteCrmCadencia(id: string) {
  const { error } = await supabase.from('crm_cadencias').delete().eq('id', id);
  if (error) throw new Error(`[CRM] excluir cadência: ${error.message}`);
}

export async function fetchCrmCadenciaEtapas(): Promise<CrmCadenciaEtapa[]> {
  const { data, error } = await supabase
    .from('crm_cadencia_etapas').select('*').order('ordem');
  return unwrap(data, error, 'etapas de cadência').map(toCadenciaEtapa);
}

export async function saveCrmCadenciaEtapa(e: Partial<CrmCadenciaEtapa> & { cadenciaId: string; tipo: string }) {
  const payload: any = {
    cadencia_id: e.cadenciaId,
    ordem: e.ordem ?? 0,
    tipo: e.tipo,
    intervalo_horas: e.intervaloHoras ?? 24,
    mensagem: e.mensagem ?? null,
    ativo: e.ativo ?? true,
  };
  if (e.id) payload.id = e.id;
  const { error } = await supabase.from('crm_cadencia_etapas').upsert(payload);
  if (error) throw new Error(`[CRM] salvar etapa de cadência: ${error.message}`);
}

export async function deleteCrmCadenciaEtapa(id: string) {
  const { error } = await supabase.from('crm_cadencia_etapas').delete().eq('id', id);
  if (error) throw new Error(`[CRM] excluir etapa de cadência: ${error.message}`);
}

// ── configurações ─────────────────────────────────────────────────────────────
export async function fetchCrmConfig(): Promise<CrmConfig> {
  const { data, error } = await supabase.from('crm_config').select('dados').eq('id', 1).maybeSingle();
  if (error) throw new Error(`[CRM] configurações: ${error.message}`);
  return { ...CRM_CONFIG_PADRAO, ...(data?.dados || {}) };
}

export async function saveCrmConfig(config: CrmConfig) {
  const { error } = await supabase.from('crm_config').upsert({ id: 1, dados: config });
  if (error) throw new Error(`[CRM] salvar configurações: ${error.message}`);
}

// ── papel do usuário ──────────────────────────────────────────────────────────
/** Grava o papel CRM dentro de users_profile.preferences, sem apagar o resto. */
export async function salvarCrmRole(userId: string, role: string, preferencesAtuais: any) {
  const { error } = await supabase
    .from('users_profile')
    .update({ preferences: { ...(preferencesAtuais || {}), crmRole: role } })
    .eq('id', userId);
  if (error) throw new Error(`[CRM] salvar papel: ${error.message}`);
}
