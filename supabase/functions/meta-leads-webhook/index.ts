// Webhook de leadgen da Meta — cada lead preenchido num formulário de anúncio
// entra no CRM já na etapa "novo".
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
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
  const t = norm(texto);
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(mil|milh)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return m[2] === 'mil' ? n * 1000 : n * 1_000_000;
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

  const raw = await req.text();
  if (!await assinaturaValida(raw, req.headers.get('x-hub-signature-256'))) {
    return new Response('invalid signature', { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Responder 200 mesmo em falha de um lead: a Meta reentrega o lote inteiro e o
  // que já entrou seria reprocessado à toa. Falhas ficam no log da função.
  try {
    const body = JSON.parse(raw);

    const { data: origem } = await supabase
      .from('crm_origens').select('id').ilike('nome', ORIGEM_META_ADS).maybeSingle();
    const { data: projects } = await supabase.from('projects').select('id, name');
    const { data: faixas } = await supabase
      .from('crm_faixas_investimento')
      .select('id, valor_min, valor_max').eq('ativo', true).order('ordem');

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue;
        const leadgenId = change.value?.leadgen_id;
        if (!leadgenId) continue;

        const resp = await fetch(
          `${GRAPH}/${leadgenId}?fields=created_time,field_data,form_id,ad_name&access_token=${PAGE_TOKEN}`
        );
        const lead = await resp.json();
        if (lead.error) { console.error('graph', leadgenId, lead.error); continue; }

        const fields = lead.field_data || [];
        const nome = [campo(fields, ['full_name', 'first_name', 'nome']),
                      campo(fields, ['last_name', 'sobrenome'])].filter(Boolean).join(' ').trim();
        const empreendimento = campo(fields, ['empreendimento', 'imovel', 'produto']);
        const faixaTexto = campo(fields, ['faixa', 'investir', 'investimento', 'orcamento']);
        const objetivoTexto = norm(campo(fields, ['objetivo', 'finalidade']));

        const project = (projects || []).find(
          (p: any) => empreendimento && norm(p.name) === norm(empreendimento)
        );

        const min = valorMinimo(faixaTexto);
        const faixa = min === null ? null : (faixas || []).find((f: any) =>
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
          ...fields.map((f: any) => `${f.name}: ${(f.values || []).join(', ')}`),
        ].join('\n');

        const { error } = await supabase.from('crm_leads').insert({
          nome: nome || 'Lead sem nome',
          telefone: campo(fields, ['whatsapp', 'phone', 'telefone']) || null,
          email: campo(fields, ['email']) || null,
          project_id: project?.id ?? null,
          origem_id: origem?.id ?? null,
          etapa: 'novo',
          objetivo,
          faixa_id: faixa?.id ?? null,
          entrada_em: lead.created_time,
          observacoes,
          meta_lead_id: String(leadgenId),
        });
        // 23505 = já ingerido numa entrega anterior do mesmo evento.
        if (error && error.code !== '23505') console.error('insert', leadgenId, error);
      }
    }
  } catch (e) {
    console.error('webhook', e);
  }

  return new Response('ok', { status: 200 });
});
