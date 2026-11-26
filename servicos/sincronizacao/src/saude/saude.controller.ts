import { Controller, Get, Header } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import {
  HealthCheck,
  HealthCheckService,
  MicroserviceHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { register } from '../comum/metricas.js';

@Controller()
export class SaudeController {
  constructor(
    private readonly saude: HealthCheckService,
    private readonly banco: TypeOrmHealthIndicator,
    private readonly microsservico: MicroserviceHealthIndicator,
  ) {}

  // so o banco e o RabbitMQ: este servico nao chama o i-Educar nem o Moodle
  @Get('health')
  @HealthCheck()
  verificar() {
    return this.saude.check([
      () => this.banco.pingCheck('banco'),
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
