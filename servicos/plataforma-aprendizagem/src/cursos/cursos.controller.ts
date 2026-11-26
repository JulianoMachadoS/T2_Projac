import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Evento } from '../comum/evento.js';
import { falhas } from '../comum/metricas.js';
import { CriarCurso, CursosService } from './cursos.service.js';

// quantas vezes a mesma mensagem e tentada antes de ir para a DLQ
const MAX_TENTATIVAS = Number(process.env.MAX_TENTATIVAS ?? 5);

@Controller()
export class CursosController {
  private readonly logger = new Logger(CursosController.name);

  constructor(private readonly cursos: CursosService) {}

  @EventPattern<string>('plataforma.curso.criar.v1')
  async criar(@Payload() comando: Evento<CriarCurso>, @Ctx() ctx: RmqContext) {
    const canal = ctx.getChannelRef();
    const mensagem = ctx.getMessage();
    // fila quorum: o RabbitMQ conta as entregas no cabecalho x-delivery-count
    const tentativa = Number(mensagem.properties.headers?.['x-delivery-count'] ?? 0) + 1;

    try {
      await this.cursos.criar(comando);
      canal.ack(mensagem); // ack so no fim: se o servico cair antes, a mensagem volta
    } catch (erro) {
      falhas.inc({ origem: 'moodle' });
      this.logger.warn({ msg: 'falha ao criar curso', correlationId: comando.correlationId, tentativa, erro: String(erro) });

      if (tentativa >= MAX_TENTATIVAS) {
        await this.cursos.avisarFalha(comando, String(erro), tentativa);
        canal.nack(mensagem, false, false); // sem requeue: vai para a cursos.dlq
      } else {
        canal.nack(mensagem, false, true); // volta para a fila e tenta de novo
      }
    }
  }
}
