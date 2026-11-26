import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { publicarEm } from '../comum/rabbitmq.js';
import { IeducarService } from '../ieducar/ieducar.service.js';
import { DeteccaoController } from './deteccao.controller.js';
import { DeteccaoService } from './deteccao.service.js';
import { TurmaDetectada } from './turma-detectada.entity.js';

@Module({
  imports: [
    HttpModule.register({ timeout: 5000 }), // timeout: nao espera o i-Educar para sempre
    TypeOrmModule.forFeature([TurmaDetectada]),
    ClientsModule.register([{ name: 'RABBITMQ', ...publicarEm('turmas') }]),
  ],
  controllers: [DeteccaoController],
  providers: [DeteccaoService, IeducarService],
  exports: [IeducarService], // o /health mostra o estado do circuit breaker
})
export class DeteccaoModule {}
