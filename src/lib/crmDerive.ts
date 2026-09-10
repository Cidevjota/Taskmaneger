// Derivações que respondem às três perguntas da SDR. Ficam separadas da API
// porque tanto o Dashboard quanto o kanban e a tela do lead precisam do mesmo
// veredito sobre uma ação: está atrasada? é para agora? é para hoje?

import { CrmConfig, CrmLead, CrmLeadFilters, CrmNextAction } from './crmTypes';

export type UrgenciaAcao = 'atrasada' | 'agora' | 'hoje' | 'futura';

export function inicioDoDia(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function fimDoDia(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Classifica a ação pendente pela distância até agora. `janelaAgoraMin` é
 * configurável porque o que conta como "agora" muda com o ritmo da operação.
 */
export function urgenciaDaAcao(acao: CrmNextAction, janelaAgoraMin: number, agora = new Date()): UrgenciaAcao {
  const quando = new Date(acao.agendadoPara);
  if (quando.getTime() < agora.getTime()) return 'atrasada';
  const minutos = (quando.getTime() - agora.getTime()) / 60000;
  if (minutos <= janelaAgoraMin) return 'agora';
  if (quando.getTime() <= fimDoDia(agora).getTime()) return 'hoje';
  return 'futura';
}

/** Índice lead → ação pendente. Só existe uma por lead (índice parcial no banco). */
export function indexarAcoesPendentes(acoes: CrmNextAction[]): Map<string, CrmNextAction> {
  const mapa = new Map<string, CrmNextAction>();
  for (const a of acoes) {
    if (a.status !== 'pendente') continue;
    const atual = mapa.get(a.leadId);
    if (!atual || new Date(a.agendadoPara) < new Date(atual.agendadoPara)) mapa.set(a.leadId, a);
  }
  return mapa;
}

export interface CrmResumo {
  atrasadas: CrmLead[];
  agora: CrmLead[];
  hoje: CrmLead[];
  novos: CrmLead[];
  aguardandoRetorno: CrmLead[];
  qualificados: CrmLead[];
  enviadosCv: CrmLead[];
  semProximaAcao: CrmLead[];
}

/**
 * O resumo do Dashboard. A ordem importa: um lead atrasado aparece só em
 * "atrasadas", não também em "hoje" — a tela precisa dizer o que fazer primeiro,
 * e não inflar três números com o mesmo lead.
 */
export function resumirOperacao(
  leads: CrmLead[],
  acoes: CrmNextAction[],
  config: CrmConfig,
  agora = new Date()
): CrmResumo {
  const pendentes = indexarAcoesPendentes(acoes);
  const resumo: CrmResumo = {
    atrasadas: [], agora: [], hoje: [], novos: [],
    aguardandoRetorno: [], qualificados: [], enviadosCv: [], semProximaAcao: [],
  };

  for (const lead of leads) {
    if (lead.etapa === 'enviado_cv') {
      resumo.enviadosCv.push(lead);
      continue;
    }
    if (lead.etapa === 'novo') resumo.novos.push(lead);
    if (lead.etapa === 'sem_resposta' || lead.etapa === 'parou_de_responder') {
      resumo.aguardandoRetorno.push(lead);
    }
    // Qualificado = tem os três dados obrigatórios da qualificação.
    if (lead.projectId && lead.objetivo && lead.faixaId) resumo.qualificados.push(lead);

    const acao = pendentes.get(lead.id);
    if (!acao) {
      resumo.semProximaAcao.push(lead);
      continue;
    }
    const urgencia = urgenciaDaAcao(acao, config.janelaAgoraMin, agora);
    if (urgencia === 'atrasada') resumo.atrasadas.push(lead);
    else if (urgencia === 'agora') resumo.agora.push(lead);
    else if (urgencia === 'hoje') resumo.hoje.push(lead);
  }

  const porAcao = (a: CrmLead, b: CrmLead) => {
    const aa = pendentes.get(a.id), bb = pendentes.get(b.id);
    if (!aa || !bb) return 0;
    return new Date(aa.agendadoPara).getTime() - new Date(bb.agendadoPara).getTime();
  };
  resumo.atrasadas.sort(porAcao);
  resumo.agora.sort(porAcao);
  resumo.hoje.sort(porAcao);
  resumo.novos.sort((a, b) => new Date(a.entradaEm).getTime() - new Date(b.entradaEm).getTime());

  return resumo;
}

export function filtrarLeads(
  leads: CrmLead[],
  filtros: CrmLeadFilters,
  acoes: CrmNextAction[],
  config: CrmConfig,
  agora = new Date()
): CrmLead[] {
  const pendentes = indexarAcoesPendentes(acoes);
  const busca = filtros.busca.trim().toLowerCase();
  const soDigitos = busca.replace(/\D/g, '');

  return leads.filter(lead => {
    if (filtros.enviadosCv === 'ocultar' && lead.etapa === 'enviado_cv') return false;
    if (filtros.enviadosCv === 'somente' && lead.etapa !== 'enviado_cv') return false;
    if (filtros.etapas.length && !filtros.etapas.includes(lead.etapa)) return false;
    if (filtros.projectIds.length && !filtros.projectIds.includes(lead.projectId || '')) return false;
    if (filtros.origemIds.length && !filtros.origemIds.includes(lead.origemId || '')) return false;
    if (filtros.responsavelIds.length && !filtros.responsavelIds.includes(lead.responsavelId || '')) return false;

    if (filtros.entradaDe && new Date(lead.entradaEm) < inicioDoDia(new Date(`${filtros.entradaDe}T00:00:00`))) return false;
    if (filtros.entradaAte && new Date(lead.entradaEm) > fimDoDia(new Date(`${filtros.entradaAte}T00:00:00`))) return false;

    const acao = pendentes.get(lead.id);
    const urgencia = acao ? urgenciaDaAcao(acao, config.janelaAgoraMin, agora) : null;

    if (filtros.somenteAtrasados && urgencia !== 'atrasada') return false;
    if (filtros.proximaAcao === 'sem_acao' && acao) return false;
    if (filtros.proximaAcao === 'atrasadas' && urgencia !== 'atrasada') return false;
    if (filtros.proximaAcao === 'agora' && urgencia !== 'agora') return false;
    if (filtros.proximaAcao === 'hoje' && !(urgencia === 'hoje' || urgencia === 'agora' || urgencia === 'atrasada')) return false;

    if (busca) {
      const alvo = `${lead.nome} ${lead.email || ''}`.toLowerCase();
      const telefone = (lead.telefone || '').replace(/\D/g, '');
      const bateNome = alvo.includes(busca);
      const bateTel = soDigitos.length >= 3 && telefone.includes(soDigitos);
      if (!bateNome && !bateTel) return false;
    }
    return true;
  });
}

// ── formatação ────────────────────────────────────────────────────────────────
const FMT_HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const FMT_DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

export function horaCurta(iso: string): string {
  return FMT_HORA.format(new Date(iso));
}

/** "hoje 15:30", "amanhã 09:00", "12/03 14:00" — o formato que o briefing pede. */
export function quandoCurto(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const diaAlvo = inicioDoDia(d).getTime();
  const diaHoje = inicioDoDia(agora).getTime();
  const dias = Math.round((diaAlvo - diaHoje) / 86400000);
  const hora = FMT_HORA.format(d);
  if (dias === 0) return `hoje ${hora}`;
  if (dias === 1) return `amanhã ${hora}`;
  if (dias === -1) return `ontem ${hora}`;
  return `${FMT_DATA.format(d)} ${hora}`;
}

export function dataHoraLonga(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** Separa a lista de eventos em dias, para a timeline agrupar por data. */
export function agruparPorDia<T extends { ocorridoEm: string }>(itens: T[]): { dia: string; itens: T[] }[] {
  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const chave = new Date(item.ocorridoEm).toLocaleDateString('pt-BR');
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(item);
  }
  return [...grupos.entries()].map(([dia, itens]) => ({ dia, itens }));
}

/** Converte os campos separados de data e hora do formulário num ISO. */
export function combinarDataHora(data: string, hora: string): string {
  return new Date(`${data}T${hora || '09:00'}:00`).toISOString();
}

export function partirDataHora(iso: string): { data: string; hora: string } {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    data: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}
