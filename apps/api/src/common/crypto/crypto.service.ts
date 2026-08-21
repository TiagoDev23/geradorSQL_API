import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const encryptionKey = configService.getOrThrow<string>(
      'CONNECTION_ENCRYPTION_KEY',
    );

    const key = Buffer.from(encryptionKey, 'hex');

    if (key.length !== 32) {
      throw new InternalServerErrorException(
        'CONNECTION_ENCRYPTION_KEY deve possuir 32 bytes.',
      );
    }

    this.key = key;
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);

    const cipher = createCipheriv(this.algorithm, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  }

  decrypt(value: string): string {
    const components = value.split(':');

    const [ivHex, authTagHex, encryptedHex] = components;

    // O ciphertext pode ser vazio quando o valor original também é,
    // portanto apenas a presença dos três componentes e do IV e do
    // authentication tag é exigida.
    if (components.length !== 3 || !ivHex || !authTagHex) {
      throw new InternalServerErrorException(
        'Credencial criptografada inválida.',
      );
    }

    const decipher = createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(ivHex, 'hex'),
    );

    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
