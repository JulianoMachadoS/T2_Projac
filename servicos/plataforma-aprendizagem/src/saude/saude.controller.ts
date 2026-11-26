import { Controller, Get, Header } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import { HealthCheck, HealthCheckService, MicroserviceHealthIndicator } from '@nestjs/terminus';
import { register } from '../comum/metricas.js';

@Controller()
export class SaudeController {
  constructor(
    private readonly saude: HealthCheckService,
    private readonly microsservico: MicroserviceHealthIndicator,
  ) {}

  // sem banco: o estado deste servico e o proprio Moodle
  // Moodle fora nao deixa o servico doente: ele continua vivo e tenta de novo
  @Get('health')
  @HealthCheck()
  verificar() {
    return this.saude.check([
      () =>
        this.microsservico.pingCheck('rabbitmq', {
          transport: Transport.RMQ,
          options: { urls: [process.env.RABBITMQ_URL!] },
        }),
    ]);
  }

  @Get('metrics')
  @Header('Content-Type', register.contentType)
  metricas() {
    return register.metrics();
  }
}
