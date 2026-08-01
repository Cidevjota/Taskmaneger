// Telefones são gravados em E.164 sem símbolos (ex.: 5511999999999) porque é
// o formato que o WAHA espera no chatId. A máscara existe só na exibição.

/**
 * Converte o que o usuário digitou em E.164 sem símbolos, assumindo Brasil
 * quando o DDI não vem. Retorna null se não parecer um número válido.
 */
export function normalizePhoneBR(input?: string | null): string | null {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, '');
  if (!digits) return null;
  if (!digits.startsWith('55')) digits = `55${digits}`;
  // 55 + DDD (2) + 8 dígitos (fixo) ou 9 (celular).
  return digits.length >= 12 && digits.length <= 13 ? digits : null;
}

/** Formata para leitura: `+55 (11) 99999-9999`. */
export function formatPhoneDisplay(stored?: string | null): string {
  const digits = (stored || '').replace(/\D/g, '');
  if (digits.length < 12) return stored || '';
  const ddd = digits.slice(2, 4);
  const rest = digits.slice(4);
  const middle = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
  const end = rest.length === 9 ? rest.slice(5) : rest.slice(4);
  return `+55 (${ddd}) ${middle}-${end}`;
}

/** Máscara progressiva usada enquanto o usuário digita no input. */
export function maskPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^55/, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const split = rest.length > 8 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}
