import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { consumir } from './comum/rabbitmq.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true }),
  });
  app.connectMicroservice(consumir('cursos'));
  await app.startAllMicroservices();
  await app.listen(3000);
}
bootstrap();
