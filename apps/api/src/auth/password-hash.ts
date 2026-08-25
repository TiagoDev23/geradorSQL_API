import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

/**
 * Hash de senha da plataforma.
 *
 * Usa scrypt, disponível no próprio Node: é uma função de derivação
 * projetada para senhas, com custo de memória e CPU deliberado. Isso
 * evita acrescentar uma dependência nativa ao projeto sem abrir mão de
 * um algoritmo adequado — SHA-256 puro, usado nas API Keys, não serve
 * aqui, porque uma senha escolhida por pessoa tem pouca entropia.
 */

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, KEY_BYTES);

  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

/**
 * A comparação usa `timingSafeEqual` para não vazar, pelo tempo de
 * resposta, o quanto do hash coincidiu.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');

  if (!saltHex || !hashHex) {
    return false;
  }

  const expected = Buffer.from(hashHex, 'hex');

  if (expected.length !== KEY_BYTES) {
    return false;
  }

  const derived = await scryptAsync(
    password,
    Buffer.from(saltHex, 'hex'),
    KEY_BYTES,
  );

  return timingSafeEqual(derived, expected);
}
