// Leads do Meta Ads — cada lead preenchido num formulário de anúncio entra no
// CRM já na etapa "novo". Dois caminhos alimentam a mesma gravação:
//
//  1. Webhook de leadgen (POST assinado pela Meta): entrega na hora.
//  2. Varredura (POST com X-Cron-Trigger, chamada pelo pg_cron a cada minuto):
//     lê os leads recentes de todos os formulários ativos da página. É a rede de
//     segurança — a Meta deixa de entregar o webhook sem avisar (app fora do modo
//     Live, assinatura desativada após falhas), e o lead ficaria parado no
//     Gerenciador de Anúncios.
//
// A Meta não manda os dados do lead no webhook, só o leadgen_id; os campos
// preenchidos precisam ser buscados na Graph API com o token da página. E ela
// reentrega o evento quando não recebe 200 rápido, por isso a gravação é
// idempotente por meta_lead_id (índice único parcial em crm_leads).
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

// @ts-ignore
const env = (k: string) => Deno.env.get(k) || '';

const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const VERIFY_TOKEN = env('META_WEBHOOK_VERIFY_TOKEN');
const APP_SECRET = env('META_APP_SECRET');
const PAGE_TOKEN = env('META_PAGE_ACCESS_TOKEN');

const GRAPH = 'https://graph.facebook.com/v21.0';
const ORIGEM_META_ADS = 'Meta Ads';
const CAMPOS_LEAD = 'created_time,field_data,form_id,ad_name,campaign_name';
// Janela da varredura. Bem maior que o intervalo do cron para cobrir execuções
// perdidas, e curta o bastante para não despejar lead antigo na fila da SDR.
const JANELA_VARREDURA_MIN = 60;

/** Confere a assinatura HMAC do corpo — sem isso qualquer um posta lead no CRM. */
async function assinaturaValida(raw: string, header: string | null): Promise<boolean> {
  if (!APP_SECRET) return false;
  if (!header?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const esperado = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  const recebido = header.slice(7);
  if (recebido.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return diff === 0;
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** A Meta devolve perguntas e respostas personalizadas com "_" no lugar do espaço. */
const legivel = (s: string) => String(s ?? '').replace(/_/g, ' ').trim();

/** Acha o valor do primeiro campo cujo nome casa com algum dos termos. */
function campo(fields: { name: string; values: string[] }[], termos: string[]): string {
  for (const t of termos) {
    const f = fields.find((x) => norm(x.name).includes(t));
    if (f?.values?.[0]) return f.values[0];
  }
  return '';
}

/** "de r$ 450 mil a r$ 550 mil" → 450000. Usa o piso declarado pelo lead. */
function valorMinimo(texto: string): number | null {
  const t = norm(legivel(texto));
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(mil|milh)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return m[2] === 'mil' ? n * 1000 : n * 1_000_000;
}

/** Projeto cujo nome aparece no texto; o nome mais longo ganha ("Green Park" antes de "Park"). */
function projetoNoTexto(projects: any[], texto: string): any | null {
  const t = norm(texto || '');
  if (!t) return null;
  return [...projects]
    .sort((a, b) => b.name.length - a.name.length)
    .find((p) => t.includes(norm(p.name))) || null;
}

const graph = async (path: string) => {
  const sep = path.includes('?') ? '&' : '?';
  const resp = await fetch(`${GRAPH}/${path}${sep}access_token=${PAGE_TOKEN}`);
  return resp.json();
};

/** Tabelas de apoio lidas uma vez por requisição. */
async function carregarContexto(supabase: any) {
  const { data: origem } = await supabase
    .from('crm_origens').select('id').ilike('nome', ORIGEM_META_ADS).maybeSingle();
  const { data: projects } = await supabase.from('projects').select('id, name');
  const { data: faixas } = await supabase
    .from('crm_faixas_investimento')
    .select('id, valor_min, valor_max').eq('ativo', true).order('ordem');
  return { origem, projects: projects || [], faixas: faixas || [] };
}

/** Grava um lead da Graph API no CRM. Devolve true quando criou um card novo. */
async function gravarLead(supabase: any, ctx: any, lead: any, formName: string): Promise<boolean> {
  const fields = lead.field_data || [];
  const nome = [campo(fields, ['full_name', 'first_name', 'nome']),
                campo(fields, ['last_name', 'sobrenome'])].filter(Boolean).join(' ').trim();
  const faixaTexto = campo(fields, ['faixa', 'investir', 'investimento', 'orcamento']);
  const objetivoTexto = norm(campo(fields, ['objetivo', 'finalidade']));

  // O campo oculto "Empreendimento:" dos formulários foi copiado de um para o
  // outro e diz "Rivage" até nos de Gênova e Flow — por isso é o último recurso.
  // Quem diz a verdade é o nome da campanha e, sem ela (lead orgânico), o do form.
  const project = projetoNoTexto(ctx.projects, lead.campaign_name) ||
    projetoNoTexto(ctx.projects, formName) ||
    projetoNoTexto(ctx.projects, campo(fields, ['empreendimento', 'imovel', 'produto']));

  const min = valorMinimo(faixaTexto);
  const faixa = min === null ? null : ctx.faixas.find((f: any) =>
    min >= Number(f.valor_min ?? 0) && (f.valor_max === null || min < Number(f.valor_max))
  );

  const objetivo = objetivoTexto.includes('aluguel') || objetivoTexto.includes('invest')
    ? 'investir'
    : objetivoTexto.includes('pessoal') || objetivoTexto.includes('morar')
      ? 'morar'
      : null;

  // Perguntas de qualificação variam por formulário e não têm coluna própria;
  // ficam na observação para a SDR ler antes do primeiro contato.
  const observacoes = [
    `Meta Ads${lead.ad_name ? ` — anúncio "${lead.ad_name}"` : ''}`,
    lead.campaign_name ? `Campanha: ${lead.campaign_name}` : '',
    formName ? `Formulário: ${formName}` : '',
    ...fields
      .filter((f: any) => !norm(f.name).includes('empreendimento'))
      .map((f: any) => `${legivel(f.name)}: ${(f.values || []).map(legivel).join(', ')}`),
  ].filter(Boolean).join('\n');

  // Marca o lead como visto antes de gravar. É este registro, e não o card, que
  // diz "já importei": assim um card excluído pela SDR não volta na varredura
  // seguinte, e webhook e varredura não gravam o mesmo lead duas vezes.
  const metaLeadId = String(lead.id);
  const { error: jaVisto } = await supabase
    .from('crm_meta_leads_vistos').insert({ meta_lead_id: metaLeadId });
  if (jaVisto) {
    if (jaVisto.code !== '23505') console.error('visto', metaLeadId, jaVisto);
    return false;
  }

  const { error } = await supabase.from('crm_leads').insert({
    nome: nome || 'Lead sem nome',
    telefone: campo(fields, ['whatsapp', 'phone', 'telefone']) || null,
    email: campo(fields, ['email']) || null,
    project_id: project?.id ?? null,
    origem_id: ctx.origem?.id ?? null,
    etapa: 'novo',
    objetivo,
    faixa_id: faixa?.id ?? null,
    entrada_em: lead.created_time,
    observacoes,
    meta_lead_id: metaLeadId,
  });
  if (error && error.code !== '23505') {
    console.error('insert', metaLeadId, error);
    // Desfaz a marca para a próxima varredura tentar de novo.
    await supabase.from('crm_meta_leads_vistos').delete().eq('meta_lead_id', metaLeadId);
  }
  return !error;
}

/** Caminho 1: eventos de leadgen entregues pela Meta. */
async function processarWebhook(supabase: any, body: any) {
  const ctx = await carregarContexto(supabase);
  const nomesDeForm = new Map<string, string>();

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'leadgen') continue;
      const leadgenId = change.value?.leadgen_id;
      if (!leadgenId) continue;

      const lead = await graph(`${leadgenId}?fields=${CAMPOS_LEAD}`);
      if (lead.error) { console.error('graph', leadgenId, lead.error); continue; }

      const formId = String(lead.form_id || change.value?.form_id || '');
      if (formId && !nomesDeForm.has(formId)) {
        const form = await graph(`${formId}?fields=name`);
        nomesDeForm.set(formId, form.name || '');
      }
      await gravarLead(supabase, ctx, { ...lead, id: leadgenId }, nomesDeForm.get(formId) || '');
    }
  }
}

/** Caminho 2: lê os leads recentes de todos os formulários ativos da página. */
async function varrerFormularios(supabase: any) {
  const desde = Math.floor(Date.now() / 1000) - JANELA_VARREDURA_MIN * 60;
  const filtro = encodeURIComponent(JSON.stringify(
    [{ field: 'time_created', operator: 'GREATER_THAN', value: desde }]
  ));

  const forms = await graph('me/leadgen_forms?fields=id,name,status&limit=200');
  if (forms.error) throw new Error(`leadgen_forms: ${JSON.stringify(forms.error)}`);
  const ativos = (forms.data || []).filter((f: any) => f.status === 'ACTIVE');

  const porForm = await Promise.all(ativos.map(async (f: any) => {
    const r = await graph(`${f.id}/leads?fields=${CAMPOS_LEAD}&filtering=${filtro}&limit=100`);
    if (r.error) { console.error('leads', f.id, r.error); return []; }
    return (r.data || []).map((lead: any) => ({ lead, formName: f.name || '' }));
  }));
  const recentes = porForm.flat();
  if (recentes.length === 0) return { formularios: ativos.length, recentes: 0, novos: 0 };

  // Tira da lista o que já entrou — sem isso cada minuto geraria uma violação de
  // unicidade por lead da janela no log do Postgres.
  const { data: existentes } = await supabase
    .from('crm_meta_leads_vistos').select('meta_lead_id')
    .in('meta_lead_id', recentes.map((x: any) => String(x.lead.id)));
  const jaTem = new Set((existentes || []).map((x: any) => x.meta_lead_id));
  const pendentes = recentes.filter((x: any) => !jaTem.has(String(x.lead.id)));

  let novos = 0;
  if (pendentes.length > 0) {
    const ctx = await carregarContexto(supabase);
    for (const { lead, formName } of pendentes) {
      if (await gravarLead(supabase, ctx, lead, formName)) novos++;
    }
  }
  return { formularios: ativos.length, recentes: recentes.length, novos };
}

serve(async (req: Request) => {
  const url = new URL(req.url);

  // Handshake de verificação da Meta ao cadastrar a URL do webhook.
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' &&
      VERIFY_TOKEN && url.searchParams.get('hub.verify_token') === VERIFY_TOKEN;
    return ok
      ? new Response(url.searchParams.get('hub.challenge') || '', { status: 200 })
      : new Response('forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Varredura do pg_cron. Não recebe dado de fora — só lê a Graph API com o token
  // da página —, então o pior que uma chamada indevida faz é antecipar a leitura.
  if (req.headers.get('X-Cron-Trigger') === 'true') {
    try {
      const resumo = await varrerFormularios(supabase);
      if (resumo.novos > 0) console.log('varredura', resumo);
      return new Response(JSON.stringify(resumo), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error('varredura', e);
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const raw = await req.text();
  if (!await assinaturaValida(raw, req.headers.get('x-hub-signature-256'))) {
    return new Response('invalid signature', { status: 401 });
  }

  // Responder 200 mesmo em falha de um lead: a Meta reentrega o lote inteiro e o
  // que já entrou seria reprocessado à toa. Falhas ficam no log da função.
  try {
    await processarWebhook(supabase, JSON.parse(raw));
  } catch (e) {
    console.error('webhook', e);
  }

  return new Response('ok', { status: 200 });
});
