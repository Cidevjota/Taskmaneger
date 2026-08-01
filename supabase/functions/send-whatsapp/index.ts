// Envia as mensagens pendentes da fila `whatsapp_outbox` para o WAHA
// (WhatsApp HTTP API self-hosted na VPS).
//
// Dois modos de uso:
//  - { outbox_id }  -> envia uma linha específica (chamado pelo trigger via pg_net)
//  - {}             -> varre a fila e reprocessa o que ficou para trás (cron)
//
// verify_jwt fica desligado de propósito: quem chama é o pg_net (do banco) e o
// cron, que não têm JWT. A autenticação é feita aqui via WHATSAPP_DISPATCH_TOKEN.

// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
// @ts-ignore
const WAHA_BASE_URL = Deno.env.get('WAHA_BASE_URL') || '';
// @ts-ignore
const WAHA_API_KEY = Deno.env.get('WAHA_API_KEY') || '';
// @ts-ignore
const WAHA_SESSION = Deno.env.get('WAHA_SESSION') || 'default';
// @ts-ignore
const DISPATCH_TOKEN = Deno.env.get('WHATSAPP_DISPATCH_TOKEN') || '';
// @ts-ignore
const APP_URL = Deno.env.get('APP_URL') || '';

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 20;

/**
 * Converte um telefone brasileiro em chatId do WhatsApp.
 * Aceita o que o usuário digitou (com máscara, com ou sem DDI) e devolve
 * `55DDDNNNNNNNNN@c.us`, ou null se não parecer um número válido.
 */
function toChatId(raw: string): string | null {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  // Sem DDI: assume Brasil.
  if (!digits.startsWith('55')) digits = `55${digits}`;
  // 55 + DDD(2) + 8 ou 9 dígitos.
  if (digits.length < 12 || digits.length > 13) return null;
  return `${digits}@c.us`;
}

function buildText(message: string): string {
  const parts = ['🔔 *Orbit — Aprovação pendente*', '', message.trim()];
  if (APP_URL) parts.push('', `Acesse: ${APP_URL}`);
  return parts.join('\n');
}

async function sendToWaha(chatId: string, text: string): Promise<void> {
  const res = await fetch(`${WAHA_BASE_URL.replace(/\/$/, '')}/api/sendText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': WAHA_API_KEY,
    },
    body: JSON.stringify({ session: WAHA_SESSION, chatId, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`WAHA ${res.status}: ${body.slice(0, 300)}`);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const authHeader = req.headers.get('Authorization');
  if (!DISPATCH_TOKEN || authHeader !== `Bearer ${DISPATCH_TOKEN}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!WAHA_BASE_URL) {
    return new Response(JSON.stringify({ error: 'WAHA_BASE_URL não configurada' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const payload = await req.json().catch(() => ({}));
    const outboxId: string | undefined = payload?.outbox_id;

    let query = supabase
      .from('whatsapp_outbox')
      .select('id, phone, message, attempts')
      .neq('status', 'sent')
      .lt('attempts', MAX_ATTEMPTS);

    query = outboxId
      ? query.eq('id', outboxId)
      : query.order('created_at', { ascending: true }).limit(BATCH_SIZE);

    const { data: rows, error } = await query;
    if (error) throw error;

    let sent = 0;
    let failed = 0;

    for (const row of rows || []) {
      const attempts = (row.attempts || 0) + 1;
      const chatId = toChatId(row.phone);

      if (!chatId) {
        // Telefone inválido não melhora com retentativa: encerra a linha.
        await supabase
          .from('whatsapp_outbox')
          .update({ status: 'failed', attempts: MAX_ATTEMPTS, last_error: 'Telefone inválido' })
          .eq('id', row.id);
        failed++;
        continue;
      }

      try {
        await sendToWaha(chatId, buildText(row.message));
        await supabase
          .from('whatsapp_outbox')
          .update({ status: 'sent', attempts, last_error: null, sent_at: new Date().toISOString() })
          .eq('id', row.id);
        sent++;
      } catch (e: any) {
        const msg = String(e?.message || e).slice(0, 500);
        console.error(`[send-whatsapp] falha no envio ${row.id}:`, msg);
        await supabase
          .from('whatsapp_outbox')
          // Só marca `failed` no fim das tentativas; até lá segue `pending`
          // para o cron pegar de novo.
          .update({
            status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
            attempts,
            last_error: msg,
          })
          .eq('id', row.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ success: true, sent, failed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[send-whatsapp] erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
