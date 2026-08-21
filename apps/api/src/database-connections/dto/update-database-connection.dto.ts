import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

import { DatabaseSslMode } from '../../generated/prisma/enums';

export class UpdateDatabaseConnectionDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  host?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  databaseName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  defaultSchema?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  username?: string;

  /**
   * Quando informada, substitui a credencial armazenada e é cifrada
   * antes de persistir. Quando omitida, a credencial atual é mantida.
   */
  @IsOptional()
  @IsString()
  @Length(1, 255)
  password?: string;

  @IsOptional()
  @IsEnum(DatabaseSslMode)
  sslMode?: DatabaseSslMode;
}
