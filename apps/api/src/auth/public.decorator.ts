import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca uma rota como acessível sem JWT. O guard é global, então a
 * exceção é declarada onde ela vale, e não repetida em cada controller
 * protegido.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
