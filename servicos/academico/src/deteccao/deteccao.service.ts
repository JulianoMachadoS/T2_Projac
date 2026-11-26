import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { lastValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { criarEvento } from '../comum/evento.js';
import { falhas, mensagensProcessadas } from '../comum/metricas.js';
import { IeducarService, Turma } from '../ieducar/ieducar.service.js';
import { TurmaDetectada } from './turma-detectada.entity.js';

@Injectable()
export class DeteccaoService {
  private readonly logger = new Logger(DeteccaoService.name);

  constructor(
    private readonly ieducar: IeducarService,
    @InjectRepository(TurmaDetectada)
    private readonly detectadas: Repository<TurmaDetectada>,
    @Inject('RABBITMQ') private readonly rabbitmq: ClientProxy,
  ) {}

  // polling: o i-Educar nao avisa quando uma turma e criada
  @Cron(CronExpression.EVERY_30_SECONDS)
  async agendado() {
    await this.detectar();
  }

  async detectar(correlationId?: string) {
    let turmas: Turma[];
    try {
      turmas = await this.ieducar.listarTurmasAtivas();
    } catch (erro) {
      // i-Educar fora do ar: nao publica nada, o proximo ciclo tenta de novo
      falhas.inc({ origem: 'ieducar' });
      this.logger.error({ msg: 'i-Educar indisponivel', erro: String(erro) });
      return { erro: 'i-Educar indisponivel' };
    }

    let novas = 0;
    for (const turma of turmas) {
      if (await this.detectadas.existsBy({ turmaId: turma.id })) continue;

      const evento = criarEvento('academico.turma.detectada', turma, correlationId ?? randomUUID());
      // publica antes de gravar: se cair entre os dois, publica de novo no proximo ciclo
      // e o consumidor ignora a repetida (idempotente)
      await lastValueFrom(this.rabbitmq.emit('academico.turma.detectada.v1', evento));
      await this.detectadas.save({ turmaId: turma.id });

      novas++;
      mensagensProcessadas.inc({ evento: 'academico.turma.detectada.v1', resultado: 'publicado' });
      this.logger.log({ msg: 'turma detectada', correlationId: evento.correlationId, turmaId: turma.id });
    }
    return { totalTurmas: turmas.length, novas };
  }
}
