import { Controller, Headers, Post } from '@nestjs/common';
import { DeteccaoService } from './deteccao.service.js';

@Controller('deteccoes')
export class DeteccaoController {
  constructor(private readonly deteccao: DeteccaoService) {}

  // dispara a deteccao na hora, sem esperar o agendamento
  @Post()
  detectar(@Headers('x-correlation-id') correlationId?: string) {
    return this.deteccao.detectar(correlationId);
  }
}
