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

/**
 * Uploads a `data:` URL (e.g. a pasted screenshot) to Storage and returns the
 * public URL. Creative images used to be persisted as base64 inside the
 * design_briefing JSON column, which made that column several MB and delayed
 * the approval screen by seconds — this keeps the DB holding only a link.
 */
export async function uploadDataUrl(
  bucket: 'avatars' | 'attachments',
  path: string,
  dataUrl: string,
  maxBytes: number
): Promise<string> {
  const match = /^data:([^;,]+)[^,]*,/.exec(dataUrl);
  if (!match) throw new Error('Conteúdo de imagem inválido.');

  const mime = match[1];
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const file = new File([bytes], path.split('/').pop() || 'image', { type: mime });
  return uploadToStorage(bucket, path, file, maxBytes);
}

export function extensionForDataUrl(dataUrl: string): string {
  const mime = /^data:image\/([a-z0-9+.-]+)/i.exec(dataUrl)?.[1]?.toLowerCase();
  if (!mime) return 'png';
  if (mime === 'jpeg') return 'jpg';
  if (mime === 'svg+xml') return 'svg';
  return mime;
}

export async function removeFromStorage(
  bucket: 'avatars' | 'attachments',
  path: string
): Promise<void> {
  await supabase.storage.from(bucket).remove([path]);
}
