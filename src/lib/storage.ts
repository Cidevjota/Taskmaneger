import { supabase } from './supabase';

const MB = 1024 * 1024;

export const UPLOAD_LIMITS = {
  avatar:   5 * MB,
  task:    15 * MB,
  sienge:   2 * MB,
  proposal: 2 * MB,
} as const;

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);
}

export async function uploadToStorage(
  bucket: 'avatars' | 'attachments',
  path: string,
  file: File,
  maxBytes: number
): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(`Arquivo muito grande. Limite: ${Math.round(maxBytes / MB)}MB`);
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });

  if (error) throw new Error(`Erro ao enviar arquivo: ${error.message}`);

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function removeFromStorage(
  bucket: 'avatars' | 'attachments',
  path: string
): Promise<void> {
  await supabase.storage.from(bucket).remove([path]);
}
