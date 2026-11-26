import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { publicarEm } from '../comum/rabbitmq.js';
import { Vinculo } from './vinculo.entity.js';
import { VinculosController } from './vinculos.controller.js';
import { VinculosService } from './vinculos.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vinculo]),
    ClientsModule.register([{ name: 'RABBITMQ', ...publicarEm('cursos') }]),
  ],
  controllers: [VinculosController],
  providers: [VinculosService],
})
export class VinculosModule {}
