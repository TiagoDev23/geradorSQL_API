import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

/** Teto de segurança para a execução de teste, independente do pedido. */
export const EXECUTION_MAX_ROWS_LIMIT = 1000;
export const EXECUTION_DEFAULT_MAX_ROWS = 100;

export class ExecuteSavedQueryDto {
  /**
   * Valores dos parâmetros, indexados pelo nome declarado em
   * QueryParameter. Nunca são concatenados ao SQL.
   */
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;

  /**
   * Limite de linhas desta execução de teste. O limite definitivo de um
   * endpoint publicado é tratado na etapa de publicação.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(EXECUTION_MAX_ROWS_LIMIT)
  maxRows?: number;
}
