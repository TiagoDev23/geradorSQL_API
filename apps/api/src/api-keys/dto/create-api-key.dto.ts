import { IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  /** Opcional: sem valor, a chave não expira por tempo. */
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
