import { Delivery, DeliveryThreadMessage } from '../types';
import { UPLOAD_LIMITS, uploadDataUrl, extensionForDataUrl } from './storage';

// Creative images (pasted screenshots and the annotated versions produced when a
// creative is rejected) arrive as base64 `data:` URLs. Persisting those inside the
// design_briefing JSON column made it grow to megabytes, so opening a task took
// seconds before anything rendered. Everything below rewrites those data URLs into
// Storage links right before the briefing is saved.

const BUCKET = 'attachments' as const;

/** Fields on a delivery / thread message that may hold an image. */
const SINGLE_FIELDS = ['imageUrl', 'thumbnailUrl', 'annotatedImageUrl'] as const;
const LIST_FIELDS = ['imageUrls', 'annotatedImageUrls'] as const;

const isDataUrl = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('data:');

/**
 * Uploads every `data:` image found on a delivery-shaped object and swaps it for
 * its public URL. Values that are already links are returned untouched, so this
 * is safe to run on every save.
 */
async function materialize<T extends Delivery | DeliveryThreadMessage>(
  node: T,
  pathPrefix: string
): Promise<T> {
  let result = node;
  // Only clone once we actually have something to replace, so untouched
  // deliveries keep their identity and saves stay cheap.
  const ensureCopy = () => {
    if (result === node) result = { ...node };
    return result as unknown as Record<string, unknown>;
  };

  for (const field of SINGLE_FIELDS) {
    const value = (node as unknown as Record<string, unknown>)[field];
    if (!isDataUrl(value)) continue;
    const url = await uploadDataUrl(
      BUCKET,
      `${pathPrefix}/${field}-${Date.now()}.${extensionForDataUrl(value)}`,
      value,
      UPLOAD_LIMITS.task
    );
    ensureCopy()[field] = url;
  }

  for (const field of LIST_FIELDS) {
    const list = (node as unknown as Record<string, unknown>)[field];
    if (!Array.isArray(list) || !list.some(isDataUrl)) continue;
    const uploaded = await Promise.all(
      list.map(async (value, index) => {
        if (!isDataUrl(value)) return value;
        return uploadDataUrl(
          BUCKET,
          `${pathPrefix}/${field}-${index}-${Date.now()}.${extensionForDataUrl(value)}`,
          value,
          UPLOAD_LIMITS.task
        );
      })
    );
    ensureCopy()[field] = uploaded;
  }

  return result;
}

/**
 * Walks a delivery list, moving any embedded base64 image to Storage.
 * Returns the same array reference when there was nothing to upload.
 */
export async function uploadDeliveryImages(
  taskId: string,
  deliveries: Delivery[] | undefined
): Promise<Delivery[] | undefined> {
  if (!deliveries || deliveries.length === 0) return deliveries;

  let changed = false;
  const result = await Promise.all(
    deliveries.map(async (delivery) => {
      const prefix = `creatives/${taskId}/${delivery.id}`;
      const materialized = await materialize(delivery, prefix);

      let thread = materialized.thread;
      if (Array.isArray(thread) && thread.length > 0) {
        const newThread = await Promise.all(
          thread.map((msg) => materialize(msg, `${prefix}/${msg.id}`))
        );
        if (newThread.some((msg, i) => msg !== thread![i])) {
          thread = newThread;
        }
      }

      if (materialized === delivery && thread === delivery.thread) return delivery;
      changed = true;
      return { ...materialized, thread: thread as DeliveryThreadMessage[] };
    })
  );

  return changed ? result : deliveries;
}
