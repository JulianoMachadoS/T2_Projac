import { Module } from '@nestjs/common';
import { CursosModule } from './cursos/cursos.module.js';
import { SaudeModule } from './saude/saude.module.js';

@Module({
  imports: [CursosModule, SaudeModule],
})
export class AppModule {}
