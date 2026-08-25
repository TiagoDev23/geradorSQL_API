import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { QueryParameterType } from '../../generated/prisma/enums';

export class QueryParameterDto {
  /** Nome recebido na requisição e associado a uma posição no SQL. */
  @IsString()
  @Length(1, 60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(QueryParameterType)
  type!: QueryParameterType;

  /** Posição do marcador: 1 corresponde a `$1`. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  position!: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  defaultValue?: string;
}

export class CreateSavedQueryDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /**
   * Consulta de leitura usando marcadores posicionais do PostgreSQL.
   * Exemplo: `SELECT ... WHERE estacao_id = $1`.
   */
  @IsString()
  @Length(1, 20000)
  sql!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QueryParameterDto)
  parameters?: QueryParameterDto[];
}
