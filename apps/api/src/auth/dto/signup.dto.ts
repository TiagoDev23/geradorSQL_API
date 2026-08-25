import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class SignupDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(180)
  email!: string;

  @IsString()
  @Length(8, 128, {
    message: 'A senha deve ter entre 8 e 128 caracteres.',
  })
  password!: string;
}
