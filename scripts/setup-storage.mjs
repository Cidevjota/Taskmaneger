/**
 * Cria os buckets do Supabase Storage e migra avatares base64 existentes.
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."; node scripts/setup-storage.mjs
 */

const SUPABASE_URL = 'https://quyoeoftqackmrjxpreb.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY não definida');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${KEY}`,
  apikey: KEY,
};

async function createBucket(id, fileSizeLimitBytes) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ id, name: id, public: true, file_size_limit: fileSizeLimitBytes }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) {
    console.log(`  ✓ Bucket "${id}" criado`);
  } else if (body.error === 'Bucket already exists') {
    console.log(`  · Bucket "${id}" já existe`);
  } else {
    console.error(`  ✗ Erro ao criar "${id}":`, body);
  }
}

async function getAllUsers() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users_profile?select=id,name,avatar_url`, {
    headers: HEADERS,
  });
  return res.ok ? await res.json() : [];
}

async function updateAvatarUrl(userId, url) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users_profile?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({ avatar_url: url }),
  });
  return res.ok;
}

async function uploadAvatarToStorage(userId, base64DataUrl) {
  // Extrai type e dados binários do data URL
  const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;

  const [, mimeType, base64Data] = match;
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const binary = Buffer.from(base64Data, 'base64');

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${userId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY,
      'Content-Type': mimeType,
      'x-upsert': 'true',
    },
    body: binary,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  // Retorna URL pública
  return `${SUPABASE_URL}/storage/v1/object/public/avatars/${userId}`;
}

async function main() {
  console.log('\n=== Supabase Storage — Setup e Migração de Avatares ===\n');

  // 1. Criar buckets
  console.log('1. Criando buckets...');
  await createBucket('avatars', 5 * 1024 * 1024);      // 5MB
  await createBucket('attachments', 15 * 1024 * 1024); // 15MB

  // 2. Migrar avatares base64
  console.log('\n2. Verificando avatares para migrar...');
  const users = await getAllUsers();
  const toMigrate = users.filter(u => u.avatar_url?.startsWith('data:'));

  if (toMigrate.length === 0) {
    console.log('  · Nenhum avatar base64 encontrado. Nada a migrar.');
  } else {
    console.log(`  Encontrados ${toMigrate.length} avatar(es) para migrar.\n`);

    for (const user of toMigrate) {
      process.stdout.write(`  → ${user.name} (${user.id}) ... `);
      try {
        const sizeMB = (user.avatar_url.length * 0.75 / 1024 / 1024).toFixed(1);
        process.stdout.write(`${sizeMB}MB → `);

        const url = await uploadAvatarToStorage(user.id, user.avatar_url);
        await updateAvatarUrl(user.id, url);
        console.log('✓ migrado');
      } catch (err) {
        console.log(`✗ ERRO: ${err.message}`);
      }
    }
  }

  // 3. Verificação final
  console.log('\n3. Verificação final...');
  const after = await getAllUsers();
  const stillBase64 = after.filter(u => u.avatar_url?.startsWith('data:'));
  const withStorage = after.filter(u => u.avatar_url?.startsWith('http'));
  const noAvatar = after.filter(u => !u.avatar_url);

  console.log(`  Storage URL : ${withStorage.length} usuário(s)`);
  console.log(`  Sem avatar  : ${noAvatar.length} usuário(s)`);
  if (stillBase64.length > 0) {
    console.log(`  ⚠ Ainda base64: ${stillBase64.map(u => u.name).join(', ')}`);
  } else {
    console.log('  ✓ Nenhum avatar base64 restante');
  }

  console.log('\n✅ Concluído. O banco não receberá mais avatares grandes.\n');
}

main().catch(console.error);
