import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { consumir } from './comum/rabbitmq.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true }),
  });
  // consome duas filas: turmas detectadas e resultado da criacao dos cursos
  app.connectMicroservice(consumir('turmas'));
  app.connectMicroservice(consumir('resultados'));
  await app.startAllMicroservices();
  await app.listen(3000);
}
bootstrap();
