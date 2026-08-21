import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

import { CryptoService } from './crypto.service';

function buildService(key: string): CryptoService {
  const configService = {
    getOrThrow: () => key,
  } as unknown as ConfigService;

  return new CryptoService(configService);
}

/**
 * Altera um caractere hexadecimal do componente indicado, mantendo o
 * valor sintaticamente válido. Serve para simular adulteração do dado
 * armazenado sem quebrar o formato.
 */
function tamper(encrypted: string, part: 0 | 1 | 2): string {
  const components = encrypted.split(':');
  const target = components[part];

  const lastChar = target.slice(-1);
  const replacement = lastChar === '0' ? '1' : '0';

  components[part] = target.slice(0, -1) + replacement;

  return components.join(':');
}

describe('CryptoService', () => {
  const validKey = randomBytes(32).toString('hex');

  let service: CryptoService;

  beforeEach(() => {
    service = buildService(validKey);
  });

  describe('inicialização', () => {
    it('aceita uma chave de 32 bytes em hexadecimal', () => {
      expect(() => buildService(validKey)).not.toThrow();
    });

    it('rejeita chave com menos de 32 bytes', () => {
      const shortKey = randomBytes(16).toString('hex');

      expect(() => buildService(shortKey)).toThrow(/32 bytes/);
    });

    it('rejeita chave com mais de 32 bytes', () => {
      const longKey = randomBytes(48).toString('hex');

      expect(() => buildService(longKey)).toThrow(/32 bytes/);
    });

    it('rejeita chave que não é hexadecimal', () => {
      expect(() => buildService('chave-invalida')).toThrow(/32 bytes/);
    });
  });

  describe('encrypt', () => {
    it('produz IV, authentication tag e ciphertext em hexadecimal', () => {
      const encrypted = service.encrypt('senha-do-banco');

      const components = encrypted.split(':');

      expect(components).toHaveLength(3);

      for (const component of components) {
        expect(component).toMatch(/^[0-9a-f]+$/);
      }

      // IV de 12 bytes e authentication tag de 16 bytes.
      expect(components[0]).toHaveLength(24);
      expect(components[1]).toHaveLength(32);
    });

    it('não expõe o valor original no resultado', () => {
      const plainText = 'senha-do-banco';

      const encrypted = service.encrypt(plainText);

      expect(encrypted).not.toContain(plainText);
    });

    it('gera resultados distintos para o mesmo valor', () => {
      const plainText = 'senha-do-banco';

      const first = service.encrypt(plainText);
      const second = service.encrypt(plainText);

      // O IV é aleatório por operação, portanto valores iguais não
      // devem produzir o mesmo ciphertext.
      expect(first).not.toBe(second);
      expect(service.decrypt(first)).toBe(plainText);
      expect(service.decrypt(second)).toBe(plainText);
    });
  });

  describe('decrypt', () => {
    it('recupera o valor original', () => {
      const plainText = 'senha-do-banco';

      expect(service.decrypt(service.encrypt(plainText))).toBe(plainText);
    });

    it('preserva acentuação e caracteres especiais', () => {
      const plainText = 'sênha#çÃo$2026@banco';

      expect(service.decrypt(service.encrypt(plainText))).toBe(plainText);
    });

    it('preserva string vazia', () => {
      expect(service.decrypt(service.encrypt(''))).toBe('');
    });

    it('rejeita valor sem os três componentes', () => {
      expect(() => service.decrypt('apenas-um-valor')).toThrow(/inválida/);

      expect(() => service.decrypt('aaaa:bbbb')).toThrow(/inválida/);
    });

    it('rejeita ciphertext adulterado', () => {
      const encrypted = service.encrypt('senha-do-banco');

      expect(() => service.decrypt(tamper(encrypted, 2))).toThrow();
    });

    it('rejeita authentication tag adulterado', () => {
      const encrypted = service.encrypt('senha-do-banco');

      expect(() => service.decrypt(tamper(encrypted, 1))).toThrow();
    });

    it('rejeita IV adulterado', () => {
      const encrypted = service.encrypt('senha-do-banco');

      expect(() => service.decrypt(tamper(encrypted, 0))).toThrow();
    });

    it('rejeita valor cifrado com outra chave', () => {
      const encrypted = service.encrypt('senha-do-banco');

      const outroServico = buildService(randomBytes(32).toString('hex'));

      expect(() => outroServico.decrypt(encrypted)).toThrow();
    });
  });
});
