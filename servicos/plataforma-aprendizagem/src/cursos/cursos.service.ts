import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { setTimeout as esperar } from 'node:timers/promises';
import { lastValueFrom } from 'rxjs';
import { Evento, criarEvento } from '../comum/evento.js';
import { mensagensProcessadas } from '../comum/metricas.js';
import { Curso, MoodleService } from '../moodle/moodle.service.js';

export interface CriarCurso extends Curso {
  turmaId: number;
}

@Injectable()
export class CursosService {
  private readonly logger = new Logger(CursosService.name);

  constructor(
    private readonly moodle: MoodleService,
    @Inject('RABBITMQ') private readonly rabbitmq: ClientProxy,
  ) {}

  async criar(comando: Evento<CriarCurso>) {
    const { turmaId, ...curso } = comando.dados;
    const correlationId = comando.correlationId;

    // so para demonstrar o cenario 4: segura a mensagem antes de processar
    const atraso = Number(process.env.ATRASO_PROCESSAMENTO_MS ?? 0);
    if (atraso) await esperar(atraso);

    // se ja existe (ex.: resposta perdida na tentativa anterior), usa o mesmo curso
    let cursoId = await this.moodle.buscarPorCodigoExterno(curso.codigoExterno);
    const jaExistia = cursoId !== null;

    if (cursoId === null) {
      cursoId = await this.moodle.criarCurso(curso);
      // so para demonstrar o cenario 3: o Moodle criou, mas fingimos que a resposta nao chegou
      if (process.env.SIMULAR_PERDA_RESPOSTA === 'true') {
        throw new Error('simulacao: resposta do Moodle perdida');
      }
    }

    const evento = criarEvento('plataforma.curso.criado', { turmaId, cursoId, jaExistia }, correlationId);
    await lastValueFrom(this.rabbitmq.emit('plataforma.curso.criado.v1', evento));
    mensagensProcessadas.inc({ evento: comando.tipo, resultado: jaExistia ? 'ja_existia' : 'criado' });
    this.logger.log({ msg: 'curso pronto', correlationId, turmaId, cursoId, jaExistia });
  }

  // ultima tentativa falhou: avisa o sincronizacao antes da mensagem ir pra DLQ
  async avisarFalha(comando: Evento<CriarCurso>, erro: string, tentativas: number) {
    const dados = { turmaId: comando.dados.turmaId, erro, tentativas };
    const evento = criarEvento('plataforma.curso.falhou', dados, comando.correlationId);
    await lastValueFrom(this.rabbitmq.emit('plataforma.curso.falhou.v1', evento));
    mensagensProcessadas.inc({ evento: comando.tipo, resultado: 'dlq' });
  }
}
