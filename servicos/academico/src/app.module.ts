import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeteccaoModule } from './deteccao/deteccao.module.js';
import { SaudeModule } from './saude/saude.module.js';

@Module({
  imports: [
    // banco proprio do servico academico
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: true, // cria as tabelas sozinho (ok pro trabalho)
    }),
    ScheduleModule.forRoot(),
    DeteccaoModule,
    SaudeModule,
  ],
})
export class AppModule {}
