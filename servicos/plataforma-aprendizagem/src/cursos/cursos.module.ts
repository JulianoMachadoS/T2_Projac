import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { publicarEm } from '../comum/rabbitmq.js';
import { MoodleService } from '../moodle/moodle.service.js';
import { CursosController } from './cursos.controller.js';
import { CursosService } from './cursos.service.js';

@Module({
  imports: [
    HttpModule.register({ timeout: 10000 }), // timeout: nao espera o Moodle para sempre
    ClientsModule.register([{ name: 'RABBITMQ', ...publicarEm('resultados') }]),
  ],
  controllers: [CursosController],
  providers: [CursosService, MoodleService],
})
export class CursosModule {}
