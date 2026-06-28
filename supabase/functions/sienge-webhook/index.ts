// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
// @ts-ignore
const SIENGE_WEBHOOK_TOKEN = Deno.env.get('SIENGE_WEBHOOK_TOKEN') || 'sienge-taskmanager-secret-token';

serve(async (req: Request) => {
  // CORS setup if needed
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    // 1. Authenticate Request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${SIENGE_WEBHOOK_TOKEN}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Parse Payload
    const payload = await req.json();
    
    // We can infer event type from headers or the payload if it exists.
    // Sometimes Sienge sends the event type in a header like `X-Sienge-Event`.
    const eventType = req.headers.get('X-Sienge-Event') || payload.event || 'UNKNOWN_EVENT';

    // 3. Store in Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { error } = await supabase
      .from('sienge_webhook_events')
      .insert([
        { 
          event_type: eventType, 
          payload: payload 
        }
      ]);

    if (error) {
      console.error('Database Error:', error);
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
