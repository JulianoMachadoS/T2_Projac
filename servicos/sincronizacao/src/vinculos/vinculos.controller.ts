import { Controller, Get, Logger, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Evento } from '../comum/evento.js';
import { falhas } from '../comum/metricas.js';
import { VinculosService } from './vinculos.service.js';

@Controller('vinculos')
export class VinculosController {
  private readonly logger = new Logger(VinculosController.name);

  constructor(private readonly vinculos: VinculosService) {}

  // ---- HTTP (pelo gateway) ----

  @Get()
  listar() {
    return this.vinculos.listar();
  }

  @Post(':turmaId/reprocessar')
  reprocessar(@Param('turmaId', ParseIntPipe) turmaId: number) {
    return this.vinculos.reprocessar(turmaId);
  }

  // ---- mensagens (RabbitMQ) ----

  @EventPattern<string>('academico.turma.detectada.v1')
  turmaDetectada(@Payload() evento: Evento<any>, @Ctx() ctx: RmqContext) {
    return this.processar(ctx, evento, () => this.vinculos.turmaDetectada(evento));
  }

  @EventPattern<string>('plataforma.curso.criado.v1')
  cursoCriado(@Payload() evento: Evento<any>, @Ctx() ctx: RmqContext) {
    return this.processar(ctx, evento, () => this.vinculos.cursoCriado(evento));
  }

  @EventPattern<string>('plataforma.curso.falhou.v1')
  cursoFalhou(@Payload() evento: Evento<any>, @Ctx() ctx: RmqContext) {
    return this.processar(ctx, evento, () => this.vinculos.cursoFalhou(evento));
  }

  // ack so depois de terminar; se der erro devolve pra fila (o x-delivery-limit da fila manda pra DLQ depois de 20 entregas)
  private async processar(ctx: RmqContext, evento: Evento<any>, trabalho: () => Promise<void>) {
    const canal = ctx.getChannelRef();
    const mensagem = ctx.getMessage();
    try {
      await trabalho();
      canal.ack(mensagem);
    } catch (erro) {
      falhas.inc({ origem: evento.tipo });
      this.logger.error({ msg: 'erro ao processar', correlationId: evento.correlationId, erro: String(erro) });
      canal.nack(mensagem, false, true);
    }
  }
}
