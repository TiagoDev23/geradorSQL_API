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

export class CreateDatabaseConnectionDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsString()
  @Length(1, 255)
  host!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsString()
  @Length(1, 120)
  databaseName!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  defaultSchema?: string;

  @IsString()
  @Length(1, 120)
  username!: string;

  /**
   * Recebida em texto puro e cifrada antes de persistir. Nunca é
   * gravada nem retornada nesse formato.
   */
  @IsString()
  @Length(1, 255)
  password!: string;

  @IsOptional()
  @IsEnum(DatabaseSslMode)
  sslMode?: DatabaseSslMode;
}
