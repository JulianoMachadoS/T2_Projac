import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { SaudeController } from './saude.controller.js';

@Module({
  imports: [TerminusModule],
  controllers: [SaudeController],
})
export class SaudeModule {}
