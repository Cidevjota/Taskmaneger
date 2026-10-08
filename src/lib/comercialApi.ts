// Lançamentos do menu Comercial (venda, distrato, reserva). A escrita passa
// sempre pela RPC: é ela que muda a situação da unidade na Tabela de Vendas no
// mesmo passo em que grava o lançamento.
import { supabase } from './supabase';
import { SiengeVendaSituacao } from '../types';

export type ComercialMovimentoTipo = 'venda' | 'distrato' | 'reserva';
export type ComercialReservaStatus = 'ativa' | 'convertida' | 'expirada' | 'cancelada';

export interface ComercialMovimento {
  id: string;
  tipo: ComercialMovimentoTipo;
  projectId: string;
  unidadeId: string | null;
  unidade: string;
  cliente: string;
  corretor: string;
  dataAssinatura: string | null;
  dataDistrato: string | null;
  diasParaCair: number | null;
  reservaExpiraEm: string | null;
  reservaStatus: ComercialReservaStatus | null;
  situacaoAnterior: SiengeVendaSituacao;
  situacaoNova: SiengeVendaSituacao;
  createdAt: string;
}

// Espelha as transições validadas em registrar_movimento_comercial: de quais
// situações cada lançamento pode partir e para qual ele leva a unidade.
export const COMERCIAL_TRANSICOES: Record<ComercialMovimentoTipo, { de: SiengeVendaSituacao[]; para: SiengeVendaSituacao }> = {
  venda:    { de: ['disponivel', 'reservado'], para: 'vendida' },
  reserva:  { de: ['disponivel'],              para: 'reservado' },
  distrato: { de: ['vendida'],                 para: 'disponivel' },
};

function toMovimento(r: any): ComercialMovimento {
  return {
    id: r.id,
    tipo: r.tipo,
    projectId: r.project_id,
    unidadeId: r.unidade_id ?? null,
    unidade: r.unidade,
    cliente: r.cliente,
    corretor: r.corretor,
    dataAssinatura: r.data_assinatura ?? null,
    dataDistrato: r.data_distrato ?? null,
    diasParaCair: r.dias_para_cair ?? null,
    reservaExpiraEm: r.reserva_expira_em ?? null,
    reservaStatus: r.reserva_status ?? null,
    situacaoAnterior: r.situacao_anterior,
    situacaoNova: r.situacao_nova,
    createdAt: r.created_at,
  };
}

export async function fetchComercialMovimentos(): Promise<ComercialMovimento[]> {
  const { data, error } = await supabase
    .from('comercial_movimentos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(toMovimento);
}

export async function registrarMovimentoComercial(params: {
  tipo: ComercialMovimentoTipo;
  unidadeId: string;
  cliente: string;
  corretor: string;
  /** yyyy-mm-dd — assinatura do contrato (venda) ou data do distrato. */
  data?: string | null;
  diasParaCair?: number | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('registrar_movimento_comercial', {
    p_tipo: params.tipo,
    p_unidade_id: params.unidadeId,
    p_cliente: params.cliente,
    p_corretor: params.corretor,
    p_data: params.data ?? null,
    p_dias_para_cair: params.diasParaCair ?? null,
  });
  if (error) throw error;
  return String(data);
}
