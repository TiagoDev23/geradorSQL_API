import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { QueryParameterDto } from './create-saved-query.dto';

export class UpdateSavedQueryDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20000)
  sql?: string;

  /**
   * Quando informado, substitui integralmente o conjunto de parâmetros.
   * Quando omitido, os parâmetros atuais são preservados.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QueryParameterDto)
  parameters?: QueryParameterDto[];
}
