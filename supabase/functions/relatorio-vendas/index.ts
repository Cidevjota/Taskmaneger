// Relatório semanal do Dashboard de Vendas por e-mail (Brevo).
//
// Duas entradas:
//  - pg_cron a cada 15 min (header X-Cron-Trigger, sem JWT): só envia se o
//    agendamento está ativo, hoje é o dia configurado, já passou do horário e
//    ainda não houve envio agendado hoje. Por isso a chamada sem autenticação é
//    inofensiva — repetir não gera e-mail extra.
//  - "Enviar agora" no app (JWT do usuário): envia na hora, sem mexer no
//    controle do agendamento.
//
// verify_jwt fica desligado no deploy porque o pg_cron não tem JWT; a checagem
// do usuário do "Enviar agora" é feita aqui dentro.

// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
// @ts-ignore
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || '';

const TZ = 'America/Sao_Paulo';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

type Situacao = 'bloqueada' | 'permuta' | 'reservado' | 'disponivel' | 'vendida';

// Mesma ordem e rótulos do Dashboard de Vendas no app.
const SITUACOES: Situacao[] = ['bloqueada', 'permuta', 'reservado', 'disponivel', 'vendida'];
const SITUACAO_LABEL: Record<Situacao, string> = {
  bloqueada: 'Bloqueadas',
  permuta: 'Permutadas',
  reservado: 'Reservadas',
  disponivel: 'Disponíveis',
  vendida: 'Vendidas',
};
const SITUACAO_COR: Record<Situacao, string> = {
  bloqueada: '#71717a',
  permuta: '#8b5cf6',
  reservado: '#d97706',
  disponivel: '#2563eb',
  vendida: '#059669',
};

interface Bucket { unidades: number; vgv: number }
interface Resumo { total: Bucket; porSituacao: Record<Situacao, Bucket> }
interface Linha extends Resumo { nome: string; ordem: number; anterior: Resumo | null }

const emptyBuckets = () =>
  Object.fromEntries(SITUACOES.map(s => [s, { unidades: 0, vgv: 0 }])) as Record<Situacao, Bucket>;
const emptyResumo = (): Resumo => ({ total: { unidades: 0, vgv: 0 }, porSituacao: emptyBuckets() });

const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const inteiro = (n: number) => n.toLocaleString('pt-BR');
const pct = (n: number) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Variação em dinheiro, com sinal e na escala que se lê de relance: "+R$ 1,25 mi", "−R$ 380 mil". */
function moedaDelta(n: number) {
  const a = Math.abs(n);
  const sinal = n < 0 ? '−' : '+';
  if (a >= 1e6) return `${sinal}R$ ${(a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  if (a >= 1e3) return `${sinal}R$ ${(a / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `${sinal}${moeda(a)}`;
}

/** Data/hora de agora no fuso de Brasília, em partes. */
function agoraBrasilia() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
    }).formatToParts(new Date()).map(p => [p.type, p.value]),
  );
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return {
    data: `${parts.year}-${parts.month}-${parts.day}`,
    minutos: Number(parts.hour) * 60 + Number(parts.minute),
    weekday,
  };
}

/** Soma dias a uma data 'YYYY-MM-DD' sem passar por fuso. */
function addDias(ymd: string, n: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "19 a 25 de setembro de 2026" / "28 de setembro a 4 de outubro de 2026". */
function periodoExtenso(inicio: string, fim: string) {
  const [yi, mi, di] = inicio.split('-').map(Number);
  const [yf, mf, df] = fim.split('-').map(Number);
  if (inicio === fim) return `${df} de ${MESES[mf - 1]} de ${yf}`;
  if (yi !== yf) return `${di} de ${MESES[mi - 1]} de ${yi} a ${df} de ${MESES[mf - 1]} de ${yf}`;
  if (mi !== mf) return `${di} de ${MESES[mi - 1]} a ${df} de ${MESES[mf - 1]} de ${yf}`;
  return `${di} a ${df} de ${MESES[mf - 1]} de ${yf}`;
}

const dataCurta = (ymd: string) => ymd.split('-').reverse().join('/');

function somar(r: Resumo, situacao: string, unidades: number, vgv: number) {
  r.total.unidades += unidades;
  r.total.vgv += vgv;
  const b = r.porSituacao[situacao as Situacao];
  if (b) { b.unidades += unidades; b.vgv += vgv; }
}

/**
 * Foto usada como "semana anterior": o fechamento de 7 dias antes de hoje. Se
 * ainda não existe (histórico começou há menos de uma semana), usa a mais
 * antiga disponível antes de hoje — o período do e-mail encurta de acordo.
 */
async function buscarReferenciaAnterior(admin: any, hoje: string): Promise<string | null> {
  const alvo = addDias(hoje, -7);
  const { data: antes } = await admin.from('relatorio_vendas_snapshots')
    .select('referencia').lte('referencia', alvo).order('referencia', { ascending: false }).limit(1);
  if (antes?.length) return antes[0].referencia;
  const { data: primeira } = await admin.from('relatorio_vendas_snapshots')
    .select('referencia').lt('referencia', hoje).order('referencia', { ascending: true }).limit(1);
  return primeira?.length ? primeira[0].referencia : null;
}

async function montarResumo(admin: any, config: any) {
  const hoje = agoraBrasilia().data;
  const referencia = await buscarReferenciaAnterior(admin, hoje);

  const [{ data: atual, error }, { data: projetos }, { data: displays }, snapshot] = await Promise.all([
    admin.rpc('relatorio_vendas_resumo'),
    admin.from('projects').select('id, name'),
    admin.from('sienge_project_display').select('project_id, hidden, sort_order'),
    referencia
      ? admin.from('relatorio_vendas_snapshots').select('project_id, situacao, unidades, vgv').eq('referencia', referencia)
      : Promise.resolve({ data: [] }),
  ]);
  if (error) throw error;

  // Mesma regra de visibilidade do resumo atual, aplicada à foto antiga.
  const excluidos = new Set<string>(config.projetos_excluidos || []);
  const displayDe = new Map<string, any>((displays || []).map((d: any) => [d.project_id, d]));
  const nomeDe = new Map<string, string>((projetos || []).map((p: any) => [p.id, p.name]));
  const visivel = (id: string) => nomeDe.has(id) && !excluidos.has(id) && !displayDe.get(id)?.hidden;

  const porProjeto = new Map<string, Linha>();
  const linhaDe = (id: string) => {
    let l = porProjeto.get(id);
    if (!l) {
      l = { nome: nomeDe.get(id) || id, ordem: displayDe.get(id)?.sort_order ?? 2147483647, ...emptyResumo(), anterior: referencia ? emptyResumo() : null };
      porProjeto.set(id, l);
    }
    return l;
  };

  for (const r of atual || []) somar(linhaDe(r.project_id), r.situacao, Number(r.unidades) || 0, Number(r.vgv) || 0);
  for (const r of snapshot.data || []) {
    if (!visivel(r.project_id)) continue;
    somar(linhaDe(r.project_id).anterior!, r.situacao, Number(r.unidades) || 0, Number(r.vgv) || 0);
  }

  const linhas = [...porProjeto.values()].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
  const consolidado = emptyResumo();
  const consolidadoAnterior = referencia ? emptyResumo() : null;
  for (const l of linhas) {
    for (const s of SITUACOES) {
      somar(consolidado, s, l.porSituacao[s].unidades, l.porSituacao[s].vgv);
      if (consolidadoAnterior && l.anterior) somar(consolidadoAnterior, s, l.anterior.porSituacao[s].unidades, l.anterior.porSituacao[s].vgv);
    }
  }

  // Semana do relatório: do dia seguinte à foto de comparação até hoje (7 dias
  // quando há histórico completo). Sem foto nenhuma, mostra os 7 dias sem comparação.
  const inicio = referencia ? addDias(referencia, 1) : addDias(hoje, -6);
  return { linhas, ...consolidado, anterior: consolidadoAnterior, referencia, periodo: periodoExtenso(inicio, hoje), hoje };
}

type ResumoCompleto = Awaited<ReturnType<typeof montarResumo>>;

const COR_SOBE = '#059669';
const COR_DESCE = '#dc2626';

/** Linha de variação do cartão: "▼ 2,3% · −R$ 1,2 mi · −1 un." */
function variacaoCartao(atual: Bucket, anterior: Bucket | undefined) {
  if (!anterior) return '';
  const dv = atual.vgv - anterior.vgv;
  const du = atual.unidades - anterior.unidades;
  if (Math.abs(dv) < 0.005 && du === 0) {
    return `<div style="font-size:11px;color:#a1a1aa;margin-top:6px;">= sem variação na semana</div>`;
  }
  const sobe = dv > 0 || (Math.abs(dv) < 0.005 && du > 0);
  const p = anterior.vgv > 0 ? `${pct(Math.abs(dv / anterior.vgv) * 100)} · ` : '';
  const un = du !== 0 ? ` · ${du > 0 ? '+' : '−'}${inteiro(Math.abs(du))} un.` : '';
  return `<div style="font-size:11px;font-weight:600;color:${sobe ? COR_SOBE : COR_DESCE};margin-top:6px;">${sobe ? '&#9650;' : '&#9660;'} ${p}${moedaDelta(dv)}${un}</div>`;
}

/** Variação compacta embaixo do valor na tabela; vazia quando nada mudou. */
function variacaoCelula(atual: number, anterior: number | undefined, dinheiro: boolean) {
  if (anterior === undefined) return '';
  const d = atual - anterior;
  if (Math.abs(d) < 0.005) return '';
  const cor = d > 0 ? COR_SOBE : COR_DESCE;
  const texto = dinheiro
    ? `${moedaDelta(d)}${anterior > 0 ? ` (${d > 0 ? '+' : '−'}${pct(Math.abs(d / anterior) * 100)})` : ''}`
    : `${d > 0 ? '+' : '−'}${inteiro(Math.abs(d))}`;
  return `<div style="font-size:10px;font-weight:600;color:${cor};">${texto}</div>`;
}

function montarHtml(resumo: ResumoCompleto) {
  const { linhas, total, porSituacao, anterior, referencia, periodo } = resumo;
  const geradoEm = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(new Date()).replace(', ', ' às ');
  const pctVgv = (v: number) => (total.vgv > 0 ? (v / total.vgv) * 100 : 0);

  const th = 'padding:8px 10px;font-size:11px;font-weight:600;text-align:right;border-bottom:1px solid #e4e4e7;white-space:nowrap;';
  const td = 'padding:8px 10px;font-size:12px;text-align:right;border-bottom:1px solid #f4f4f5;white-space:nowrap;vertical-align:top;';

  const cards = [
    `<td style="padding:12px;border:1px solid #e4e4e7;border-radius:8px;background:#fafafa;vertical-align:top;">
       <div style="font-size:11px;font-weight:600;color:#52525b;text-transform:uppercase;">Total</div>
       <div style="font-size:18px;font-weight:700;color:#18181b;margin-top:4px;">${moeda(total.vgv)}</div>
       <div style="font-size:11px;color:#71717a;">${inteiro(total.unidades)} unidades</div>
       ${variacaoCartao(total, anterior?.total)}
     </td>`,
    ...SITUACOES.map(s => `<td style="padding:12px;border:1px solid #e4e4e7;border-radius:8px;vertical-align:top;">
       <div style="font-size:11px;font-weight:600;color:${SITUACAO_COR[s]};text-transform:uppercase;">${SITUACAO_LABEL[s]}</div>
       <div style="font-size:16px;font-weight:700;color:#18181b;margin-top:4px;">${moeda(porSituacao[s].vgv)}</div>
       <div style="font-size:11px;color:#71717a;">${inteiro(porSituacao[s].unidades)} un. · ${pct(pctVgv(porSituacao[s].vgv))} do VGV</div>
       ${variacaoCartao(porSituacao[s], anterior?.porSituacao[s])}
     </td>`),
  ];
  // Três cartões por linha — cabe na largura de leitura de qualquer cliente de e-mail.
  const cardRows: string[] = [];
  for (let i = 0; i < cards.length; i += 3) cardRows.push(`<tr>${cards.slice(i, i + 3).join('')}</tr>`);

  const cabecalhoGrupos = ['Total', ...SITUACOES.map(s => SITUACAO_LABEL[s])]
    .map((label, i) => {
      const cor = i === 0 ? '#18181b' : SITUACAO_COR[SITUACOES[i - 1]];
      return `<th colspan="2" style="padding:8px 10px;font-size:11px;font-weight:700;text-align:center;color:${cor};border-bottom:1px solid #e4e4e7;border-left:1px solid #e4e4e7;">${label}</th>`;
    }).join('');
  const cabecalhoSub = Array.from({ length: SITUACOES.length + 1 })
    .map(() => `<th style="${th}color:#71717a;border-left:1px solid #e4e4e7;">Un.</th><th style="${th}color:#71717a;">VGV</th>`)
    .join('');

  const celulas = (l: Resumo, ant: Resumo | null, negrito = false) =>
    [[l.total, ant?.total] as const, ...SITUACOES.map(s => [l.porSituacao[s], ant?.porSituacao[s]] as const)]
      .map(([b, a]) => {
        const cor = b.unidades === 0 && !negrito ? '#a1a1aa' : '#27272a';
        const peso = negrito ? 'font-weight:700;' : '';
        return `<td style="${td}${peso}color:${cor};border-left:1px solid #f4f4f5;">${inteiro(b.unidades)}${variacaoCelula(b.unidades, a?.unidades, false)}</td>`
          + `<td style="${td}${peso}color:${cor};">${moeda(b.vgv)}${variacaoCelula(b.vgv, a?.vgv, true)}</td>`;
      }).join('');

  const linhasHtml = linhas.length === 0
    ? `<tr><td colspan="${3 + SITUACOES.length * 2}" style="padding:20px;text-align:center;color:#71717a;font-size:12px;">Nenhum empreendimento com unidades na Tabela de Vendas.</td></tr>`
    : linhas.map(l => `<tr><td style="${td}text-align:left;font-weight:600;color:#18181b;">${esc(l.nome)}</td>${celulas(l, l.anterior)}</tr>`).join('');

  const notaComparacao = referencia
    ? `<div style="font-size:12px;color:#3b82f6;margin-top:2px;">Comparado a ${dataCurta(referencia)}</div>`
    : '';

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <div style="max-width:960px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:24px;">
    <h1 style="margin:0;font-size:18px;">Dashboard de Vendas</h1>
    <p style="margin:4px 0 16px;font-size:12px;color:#71717a;">Gerado em ${geradoEm}</p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #2563eb;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
      <div style="font-size:11px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.04em;">Semana de referência</div>
      <div style="font-size:20px;font-weight:800;color:#1e3a8a;margin-top:2px;">${periodo}</div>
      ${notaComparacao}
    </div>

    <table role="presentation" cellspacing="8" cellpadding="0" style="width:100%;border-collapse:separate;margin:0 -8px 16px;">
      ${cardRows.join('')}
    </table>

    <div style="overflow-x:auto;">
      <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #e4e4e7;">
        <thead>
          <tr style="background:#fafafa;">
            <th rowspan="2" style="${th}text-align:left;color:#52525b;">Empreendimento</th>
            ${cabecalhoGrupos}
          </tr>
          <tr style="background:#fafafa;">${cabecalhoSub}</tr>
        </thead>
        <tbody>${linhasHtml}</tbody>
        <tfoot>
          <tr style="background:#fafafa;"><td style="${td}text-align:left;font-weight:700;">Total geral</td>${celulas({ total, porSituacao }, anterior, true)}</tr>
        </tfoot>
      </table>
    </div>
  </div>
</body></html>`;
}

async function enviar(config: any, admin: any) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY não configurada na Edge Function.');
  if (!config.remetente_email) throw new Error('Remetente não configurado.');
  const emails: string[] = (config.emails || []).filter((e: string) => e && e.includes('@'));
  if (emails.length === 0) throw new Error('Nenhum destinatário cadastrado.');

  const resumo = await montarResumo(admin, config);

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: config.remetente_email, name: config.remetente_nome || 'Orbit' },
      // Cada destinatário recebe individualmente — sem expor a lista para os demais.
      messageVersions: emails.map(email => ({ to: [{ email }] })),
      subject: `Dashboard de Vendas — semana de ${resumo.periodo} · VGV ${moeda(resumo.total.vgv)}`,
      htmlContent: montarHtml(resumo),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo respondeu ${res.status}: ${body.slice(0, 300)}`);
  }
  return emails.length;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const isCron = req.headers.get('X-Cron-Trigger') === 'true';

  if (!isCron) {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: userData, error } = token ? await admin.auth.getUser(token) : { data: null, error: true };
    if (error || !userData?.user) return json({ error: 'Unauthorized' }, 401);
  }

  const { data: config, error: configError } = await admin
    .from('relatorio_vendas_config').select('*').eq('id', 'default').maybeSingle();
  if (configError || !config) return json({ error: 'Configuração do relatório não encontrada.' }, 500);

  if (isCron) {
    if (!config.ativo) return json({ skipped: 'inativo' });
    const agora = agoraBrasilia();
    const [h, m] = String(config.hora).split(':').map(Number);
    if (agora.weekday !== config.dia_semana || agora.minutos < h * 60 + m) return json({ skipped: 'fora do horário' });
    if (config.ultimo_envio_agendado) {
      const ultimoDia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(config.ultimo_envio_agendado));
      if (ultimoDia === agora.data) return json({ skipped: 'já enviado hoje' });
    }
    // Marca antes de enviar: se a chamada seguinte do cron chegar enquanto esta
    // ainda roda, ela já vê o envio de hoje e não duplica o e-mail.
    await admin.from('relatorio_vendas_config')
      .update({ ultimo_envio_agendado: new Date().toISOString() })
      .eq('id', 'default');
  }

  try {
    const enviados = await enviar(config, admin);
    await admin.from('relatorio_vendas_config').update({
      ultimo_envio_em: new Date().toISOString(),
      ultimo_envio_status: `ok · ${enviados} destinatário(s)${isCron ? '' : ' · envio manual'}`,
    }).eq('id', 'default');
    return json({ success: true, enviados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    await admin.from('relatorio_vendas_config').update({
      ultimo_envio_em: new Date().toISOString(),
      ultimo_envio_status: `erro · ${msg}`,
    }).eq('id', 'default');
    return json({ error: msg }, 500);
  }
});
