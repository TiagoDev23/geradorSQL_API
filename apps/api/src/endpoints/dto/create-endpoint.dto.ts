import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { SLUG_PATTERN, VERSION_PATTERN } from '../../common/slug';

export class CreateEndpointDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /**
   * Componente final da URL pública. Quando omitido, é derivado do nome.
   * Quando informado, precisa já estar normalizado.
   */
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(SLUG_PATTERN, {
    message:
      'O slug deve conter apenas letras minúsculas, números e hífens simples.',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @Matches(VERSION_PATTERN, {
    message: 'A versão deve seguir o formato v1, v2, v3.',
  })
  version?: string;

  /** Teto de registros retornados pelo endpoint publicado. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  maxRows?: number;

  /** Consulta que o endpoint publica. O SQL não é copiado. */
  @IsUUID()
  savedQueryId!: string;
}
