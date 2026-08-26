import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // O painel web roda em outra origem (Next.js na 3000) e envia o JWT
  // no cabecalho Authorization, nunca em cookie: nao ha credencial de
  // navegador a proteger, e as origens permitidas sao configuraveis.
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',').map((value) =>
      value.trim(),
    ) ?? ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();