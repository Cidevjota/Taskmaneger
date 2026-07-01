/**
 * Cria/recria os 7 usuários do sistema via Supabase Admin API.
 * Não modifica diretamente as tabelas auth.users ou auth.identities via SQL.
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."; node scripts/create-auth-users.mjs
 */

const SUPABASE_URL = 'https://quyoeoftqackmrjxpreb.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('\n[ERRO] Defina a variável SUPABASE_SERVICE_ROLE_KEY antes de executar.');
  console.error('  PowerShell: $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ...sua_chave..."');
  console.error('  Onde encontrar: Supabase Dashboard → Settings → API → service_role (secret)\n');
  process.exit(1);
}

const USERS = [
  { id: 'f1ae073d-4e48-4fba-a7c2-460452252547', email: 'cidnei@uchoaempreendimentos.com.br',  password: 'Uchoa2026@'  },
  { id: '8b7653f6-95d0-4f5e-93f1-3472193a575e', email: 'kariny@uchoaempreendimentos.com.br',  password: 'Uchoa2026@1' },
  { id: '94d9a300-2a2c-4bdb-ae0f-c72e64e84e49', email: 'eri@uchoaempreendimentos.com.br',     password: 'Uchoa2026@2' },
  { id: 'd90d517a-b85a-4354-95a5-ad66625a5057', email: 'karen@uchoaempreendimentos.com.br',   password: 'Uchoa2026@3' },
  { id: '6a068894-40e0-45ff-8bd0-a3c4b8135c3a', email: 'davi@uchoaempreendimentos.com.br',    password: 'Uchoa2026@4' },
  { id: '2cae6b58-b422-4d4d-93b5-48e3f25b7b62', email: 'pedro@uchoaempreendimentos.com.br',   password: 'Uchoa2026@5' },
  { id: '59109a65-715f-4f0d-95c1-60718720593a', email: 'junior@uchoaempreendimentos.com.br',  password: 'Uchoa2026@6' },
];

const BASE = `${SUPABASE_URL}/auth/v1/admin`;
const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'apikey': SERVICE_ROLE_KEY,
};

async function adminFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...HEADERS, ...(options.headers || {}) },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

async function listAuthUsers() {
  const { ok, body } = await adminFetch('/users?per_page=100');
  return ok ? (body.users || []) : [];
}

async function deleteAuthUser(id) {
  return adminFetch(`/users/${id}`, { method: 'DELETE' });
}

async function createAuthUser({ id, email, password }) {
  return adminFetch('/users', {
    method: 'POST',
    body: JSON.stringify({ id, email, password, email_confirm: true }),
  });
}

async function main() {
  console.log('\n=== Supabase Auth — Criação de Usuários via Admin API ===\n');

  const existing = await listAuthUsers();
  const byEmail = new Map(existing.map(u => [u.email, u]));

  console.log(`Usuários visíveis via Admin API: ${existing.length}`);
  console.log('Limpando entradas órfãs (auth.users sem identity) via DELETE...\n');

  // Força delete por UUID conhecido — limpa rows inseridas por SQL direto que
  // o GoTrue não reconhece (causando "Database error checking email")
  for (const user of USERS) {
    const del = await deleteAuthUser(user.id);
    if (del.ok || del.status === 404) {
      // 404 = não existia, tudo bem
    } else {
      console.log(`  Aviso ao deletar ${user.id}: ${del.status} ${JSON.stringify(del.body)}`);
    }
  }
  // Também deleta por email caso UUID seja diferente
  for (const user of USERS) {
    const byMailUser = byEmail.get(user.email);
    if (byMailUser && byMailUser.id !== user.id) {
      await deleteAuthUser(byMailUser.id);
    }
  }

  console.log('Recriando usuários via Admin API...\n');

  for (const user of USERS) {
    process.stdout.write(`→ ${user.email} ... `);

    const { ok, status, body } = await createAuthUser(user);
    if (ok) {
      console.log(`✓ criado (email confirmado)`);
    } else {
      console.log(`✗ ERRO ${status}: ${JSON.stringify(body)}`);
    }
  }

  console.log('\n=== Verificação Final ===\n');
  const final = await listAuthUsers();
  const finalById = new Map(final.map(u => [u.id, u]));

  let allOk = true;
  for (const user of USERS) {
    const found = finalById.get(user.id);
    if (found) {
      const confirmed = !!found.email_confirmed_at;
      console.log(`${confirmed ? '✓' : '⚠'} ${user.email} — confirmado: ${confirmed}`);
      if (!confirmed) allOk = false;
    } else {
      console.log(`✗ ${user.email} — NÃO ENCONTRADO`);
      allOk = false;
    }
  }

  console.log(allOk
    ? '\n✅ Todos os usuários criados e confirmados. Login deve funcionar.\n'
    : '\n⚠ Alguns usuários com problemas. Verifique os erros acima.\n'
  );
}

main().catch(err => {
  console.error('\n[EXCEÇÃO]', err.message);
  process.exit(1);
});
