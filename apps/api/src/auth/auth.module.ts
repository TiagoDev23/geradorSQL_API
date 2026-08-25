import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Global porque o guard registrado no módulo raiz depende do JwtService
 * configurado aqui.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Sem valor padrão: a aplicação não deve subir com um segredo
        // conhecido.
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // O tipo do jsonwebtoken restringe a string a formatos
          // conhecidos; o valor vem de configuração e é validado em
          // tempo de execução pela própria biblioteca.
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
            '1d') as `${number}d`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard],
})
export class AuthModule {}
