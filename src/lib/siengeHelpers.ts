import { SiengeStatus } from '../types';

export function siengeDaysOverdue(vencimento?: string): number {
  if (!vencimento) return 0;
  const start = new Date(vencimento + 'T00:00:00').getTime();
  const today = new Date(new Date().toDateString()).getTime();
  const diff = Math.floor((today - start) / 86400000);
  return diff > 0 ? diff : 0;
}

// Captures the due date the first time a title enters 'aguardando_pagamento',
// so later rejections/resolutions that push the deadline forward don't reset
// how many days the title has truly been overdue.
export function withVencimentoOriginal<T extends { status: SiengeStatus; vencimento?: string; vencimentoOriginal?: string }>(title: T): T {
  if (title.status === 'aguardando_pagamento' && !title.vencimentoOriginal && title.vencimento) {
    return { ...title, vencimentoOriginal: title.vencimento };
  }
  return title;
}
