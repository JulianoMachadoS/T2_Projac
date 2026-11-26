import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DeteccaoModule } from '../deteccao/deteccao.module.js';
import { SaudeController } from './saude.controller.js';

@Module({
  imports: [TerminusModule, DeteccaoModule],
  controllers: [SaudeController],
})
export class SaudeModule {}
