/**
 * Diagnóstico do estado da autenticação Supabase.
 * Uso: $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."; node scripts/diagnose-auth.mjs
 */

const SUPABASE_URL = 'https://quyoeoftqackmrjxpreb.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY não definida'); process.exit(1); }

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${KEY}`,
  'apikey': KEY,
};

async function rpc(fn, params = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(params),
  });
  return { status: res.status, body: await res.json().catch(() => res.text()) };
}

async function sql(query) {
  // Usa a função pg_execute via PostgREST se disponível; senão documenta
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ query }),
  });
  return { status: res.status, body: await res.json().catch(() => res.text()) };
}

async function fetchTable(table, select = '*', filters = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}${filters}`, {
    headers: HEADERS,
  });
  return { status: res.status, body: await res.json().catch(() => res.text()) };
}

async function main() {
  console.log('\n=== DIAGNÓSTICO DE AUTENTICAÇÃO ===\n');

  // 1. Verificar se users_profile está acessível
  console.log('1. Tabela users_profile:');
  const profiles = await fetchTable('users_profile', 'id,name,email,role');
  if (profiles.status === 200) {
    console.log(`   ✓ ${profiles.body.length} perfis encontrados`);
    for (const p of profiles.body) {
      console.log(`     - ${p.email} (${p.id})`);
    }
  } else {
    console.log(`   ✗ ERRO ${profiles.status}: ${JSON.stringify(profiles.body)}`);
  }

  // 2. Verificar Admin API - listagem de usuários
  console.log('\n2. Admin API - listagem de auth.users:');
  const list = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=20`, { headers: HEADERS });
  const listBody = await list.json().catch(() => ({}));
  console.log(`   Status: ${list.status}`);
  if (list.status === 200) {
    const users = listBody.users || [];
    console.log(`   Usuários em auth.users: ${users.length}`);
    for (const u of users) {
      console.log(`     - ${u.email} | id: ${u.id} | confirmed: ${!!u.email_confirmed_at}`);
    }
  } else {
    console.log(`   Resposta: ${JSON.stringify(listBody)}`);
  }

  // 3. Tentar criar usuário de teste temporário para capturar erro real
  console.log('\n3. Teste de criação (usuário temporário):');
  const testRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      email: 'teste-diagnostico-temp@example.com',
      password: 'Teste123!',
      email_confirm: true,
    }),
  });
  const testBody = await testRes.json().catch(() => ({}));
  console.log(`   Status: ${testRes.status}`);
  console.log(`   Resposta: ${JSON.stringify(testBody)}`);

  if (testRes.status === 200) {
    // Limpar usuário de teste
    const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${testBody.id}`, {
      method: 'DELETE',
      headers: HEADERS,
    });
    console.log(`   Limpeza do teste: ${delRes.status}`);
  }

  // 4. Verificar se há coluna password ainda na tabela
  console.log('\n4. Verificando colunas de users_profile:');
  const colRes = await fetch(`${SUPABASE_URL}/rest/v1/users_profile?select=*&limit=1`, {
    headers: HEADERS,
  });
  const colBody = await colRes.json().catch(() => ({}));
  if (Array.isArray(colBody) && colBody.length > 0) {
    console.log(`   Colunas: ${Object.keys(colBody[0]).join(', ')}`);
  } else {
    console.log(`   ${JSON.stringify(colBody)}`);
  }

  console.log('\n=== FIM DO DIAGNÓSTICO ===\n');
  console.log('Cole os resultados acima para análise.\n');
}

main().catch(console.error);
