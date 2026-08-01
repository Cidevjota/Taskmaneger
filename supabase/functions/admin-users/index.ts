// Gestão de usuários do Orbit (criar / editar / remover contas).
//
// Precisa viver numa Edge Function porque `auth.admin` exige a service role,
// que jamais pode ir para o bundle do frontend. Todo acesso é validado contra
// o JWT de quem chamou: só `preferences.permissionLevel === 1` passa.

// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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

/** Normaliza o telefone para E.164 sem símbolos (espelha src/lib/phone.ts). */
function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (!digits.startsWith('55')) digits = `55${digits}`;
  return digits.length >= 12 && digits.length <= 13 ? digits : null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ── Autorização: quem está chamando é admin? ──
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: 'Unauthorized' }, 401);

    const { data: callerProfile } = await admin
      .from('users_profile')
      .select('preferences')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (Number(callerProfile?.preferences?.permissionLevel) !== 1) {
      return json({ error: 'Acesso restrito a administradores.' }, 403);
    }

    const { action, payload } = await req.json();

    switch (action) {
      case 'list': {
        const { data, error } = await admin
          .from('users_profile')
          .select('id, name, email, role, phone, avatar_url, preferences')
          .order('name');
        if (error) throw error;
        return json({ users: data });
      }

      case 'create': {
        const { email, password, name, role, phone, permissionLevel } = payload || {};
        if (!email || !password || !name) {
          return json({ error: 'Nome, e-mail e senha são obrigatórios.' }, 400);
        }

        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email: String(email).trim().toLowerCase(),
          password,
          email_confirm: true,
          user_metadata: { name },
        });
        if (createError) throw createError;

        // O trigger `on_auth_user_created` já criou a linha em users_profile;
        // aqui só completamos os campos que ele não conhece.
        const { error: profileError } = await admin
          .from('users_profile')
          .update({
            name,
            role: role || 'Membro',
            phone: normalizePhone(phone),
            preferences: { permissionLevel: Number(permissionLevel) || 2 },
          })
          .eq('id', created.user.id);
        if (profileError) throw profileError;

        return json({ success: true, id: created.user.id });
      }

      case 'update': {
        const { id, name, role, phone, permissionLevel, password } = payload || {};
        if (!id) return json({ error: 'id é obrigatório.' }, 400);

        if (password) {
          const { error } = await admin.auth.admin.updateUserById(id, { password });
          if (error) throw error;
        }

        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (role !== undefined) updates.role = role;
        if (phone !== undefined) updates.phone = normalizePhone(phone);
        if (permissionLevel !== undefined) {
          const { data: current } = await admin
            .from('users_profile')
            .select('preferences')
            .eq('id', id)
            .maybeSingle();
          // Preserva as demais preferências do usuário (ex.: filtros de notificação).
          updates.preferences = {
            ...(current?.preferences || {}),
            permissionLevel: Number(permissionLevel) || 2,
          };
        }

        if (Object.keys(updates).length > 0) {
          const { error } = await admin.from('users_profile').update(updates).eq('id', id);
          if (error) throw error;
        }

        return json({ success: true });
      }

      case 'delete': {
        const { id } = payload || {};
        if (!id) return json({ error: 'id é obrigatório.' }, 400);
        if (id === userData.user.id) {
          return json({ error: 'Você não pode remover a própria conta.' }, 400);
        }

        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw error;

        // users_profile não tem FK para auth.users neste schema, então a linha
        // ficaria órfã se não fosse removida aqui.
        await admin.from('users_profile').delete().eq('id', id);

        return json({ success: true });
      }

      default:
        return json({ error: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (error: any) {
    console.error('[admin-users] erro:', error);
    return json({ error: error.message || 'Erro interno' }, 500);
  }
});
