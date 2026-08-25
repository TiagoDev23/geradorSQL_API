/**
 * Slugs compõem a URL pública dos endpoints, por isso são normalizados
 * e validados no servidor: assim a URL é válida independentemente do
 * cliente que chamou a API.
 */

/** Slug já normalizado: minúsculas, dígitos e hífens simples. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Versão de endpoint: a letra v seguida de um número. */
export const VERSION_PATTERN = /^v[1-9]\d*$/;

export function normalizeSlug(value: string): string {
  return (
    value
      .normalize('NFD')
      // Remove os diacríticos separados pela normalização.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}
