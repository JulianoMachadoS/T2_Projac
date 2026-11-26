import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaudeModule } from './saude/saude.module.js';
import { VinculosModule } from './vinculos/vinculos.module.js';

@Module({
  imports: [
    // banco proprio do servico sincronizacao
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: true,
    }),
    VinculosModule,
    SaudeModule,
  ],
})
export class AppModule {}
