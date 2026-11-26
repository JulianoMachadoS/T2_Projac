import { Controller, Get, Header } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import {
  HealthCheck,
  HealthCheckService,
  MicroserviceHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { register } from '../comum/metricas.js';
import { IeducarService } from '../ieducar/ieducar.service.js';

@Controller()
export class SaudeController {
  constructor(
    private readonly saude: HealthCheckService,
    private readonly banco: TypeOrmHealthIndicator,
    private readonly microsservico: MicroserviceHealthIndicator,
    private readonly ieducar: IeducarService,
  ) {}

  // i-Educar fora nao deixa o servico doente: ele continua vivo e tenta de novo
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
      // so informa: disjuntor aberto nao derruba o servico
      () => ({ ieducar: { status: 'up', circuitBreaker: this.ieducar.estadoDisjuntor } }),
    ]);
  }

  @Get('metrics')
  @Header('Content-Type', register.contentType)
  metricas() {
    return register.metrics();
  }
}
