import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // credentials:true requis pour que le cookie refresh HttpOnly circule (SPEC §5.2).
  // origin:true reflète l'origine appelante (à restreindre à l'origine SSR en prod).
  app.enableCors({ origin: true, credentials: true });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
