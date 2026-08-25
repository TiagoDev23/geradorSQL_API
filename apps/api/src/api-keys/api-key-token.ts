import { createHash, randomBytes } from 'crypto';

/**
 * Geração e verificação de API Keys.
 *
 * Diferente da senha de uma conexão externa, a chave nunca precisa ser
 * recuperada: a plataforma só precisa reconhecer uma chave apresentada.
 * Por isso é guardada como hash, e não cifrada.
 */

const TOKEN_PREFIX = 'gapi_';
const TOKEN_BYTES = 32;

/** Comprimento do trecho guardado para identificação visual. */
const PREFIX_LENGTH = TOKEN_PREFIX.length + 8;

export interface GeneratedApiKey {
  /** Valor completo. Exibido uma única vez, nunca persistido. */
  token: string;
  keyPrefix: string;
  keyHash: string;
}

export function generateApiKey(): GeneratedApiKey {
  const token = TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString('base64url');

  return {
    token,
    keyPrefix: token.slice(0, PREFIX_LENGTH),
    keyHash: hashApiKey(token),
  };
}

/**
 * SHA-256 é adequado aqui: a chave tem 32 bytes de entropia vinda de
 * fonte criptográfica, então não há espaço de busca a proteger como
 * haveria numa senha escolhida por pessoa.
 */
export function hashApiKey(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
