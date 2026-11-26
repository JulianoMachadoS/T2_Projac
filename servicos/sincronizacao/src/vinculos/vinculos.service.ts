import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { lastValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { Evento, criarEvento } from '../comum/evento.js';
import { duracaoSincronizacao, mensagensProcessadas } from '../comum/metricas.js';
import { Vinculo } from './vinculo.entity.js';

interface TurmaDetectada {
  id: number;
  nome: string;
}

interface CursoCriado {
  turmaId: number;
  cursoId: number;
  jaExistia: boolean;
}

interface CursoFalhou {
  turmaId: number;
  erro: string;
  tentativas: number;
}

@Injectable()
export class VinculosService {
  private readonly logger = new Logger(VinculosService.name);

  constructor(
    @InjectRepository(Vinculo) private readonly vinculos: Repository<Vinculo>,
    @Inject('RABBITMQ') private readonly rabbitmq: ClientProxy,
  ) {}

  async turmaDetectada(evento: Evento<TurmaDetectada>) {
    const turma = evento.dados;
    const existente = await this.vinculos.findOneBy({ turmaId: turma.id });

    // idempotencia: turma que ja tem curso nao gera outro pedido
    if (existente?.status === 'CRIADO') {
      mensagensProcessadas.inc({ evento: evento.tipo, resultado: 'ignorado' });
      this.logger.log({ msg: 'turma ja tem curso, ignorada', correlationId: evento.correlationId, turmaId: turma.id });
      return;
    }

    // PENDENTE repetido pede de novo: o plataforma-aprendizagem nao duplica (busca pelo idnumber)
    await this.vinculos.save({
      turmaId: turma.id,
      nomeTurma: turma.nome,
      status: 'PENDENTE',
      erro: null,
      correlationId: evento.correlationId,
    });
    await this.pedirCurso(turma.id, turma.nome, evento.correlationId);
    mensagensProcessadas.inc({ evento: evento.tipo, resultado: 'ok' });
  }

  async cursoCriado(evento: Evento<CursoCriado>) {
    const { turmaId, cursoId } = evento.dados;
    const vinculo = await this.vinculos.findOneBy({ turmaId });
    if (!vinculo) return;

    await this.vinculos.update({ turmaId }, { status: 'CRIADO', cursoId, erro: null });
    // atualizadoEm = quando virou PENDENTE (deteccao ou reprocessamento)
    duracaoSincronizacao.observe((Date.now() - vinculo.atualizadoEm.getTime()) / 1000);
    mensagensProcessadas.inc({ evento: evento.tipo, resultado: 'ok' });
    this.logger.log({ msg: 'vinculo criado', correlationId: evento.correlationId, turmaId, cursoId });
  }

  async cursoFalhou(evento: Evento<CursoFalhou>) {
    const { turmaId, erro } = evento.dados;
    await this.vinculos.update({ turmaId }, { status: 'FALHOU', erro });
    mensagensProcessadas.inc({ evento: evento.tipo, resultado: 'ok' });
    this.logger.warn({ msg: 'curso nao foi criado', correlationId: evento.correlationId, turmaId, erro });
  }

  listar() {
    return this.vinculos.find({ order: { turmaId: 'ASC' } });
  }

  // tira da falha e pede o curso de novo
  async reprocessar(turmaId: number) {
    const vinculo = await this.vinculos.findOneBy({ turmaId });
    if (!vinculo) throw new NotFoundException(`turma ${turmaId} sem vinculo`);

    await this.vinculos.update({ turmaId }, { status: 'PENDENTE', erro: null });
    await this.pedirCurso(turmaId, vinculo.nomeTurma, vinculo.correlationId);
    return { turmaId, status: 'PENDENTE' };
  }

  // regra de negocio: como uma turma do i-Educar vira um curso
  private async pedirCurso(turmaId: number, nome: string, correlationId: string) {
    const comando = criarEvento(
      'plataforma.curso.criar',
      {
        turmaId,
        nomeCompleto: nome,
        nomeCurto: `turma-${turmaId}`, // nome da turma se repete entre escolas, o id nao
        codigoExterno: `ieducar-turma-${turmaId}`,
      },
      correlationId,
    );
    await lastValueFrom(this.rabbitmq.emit('plataforma.curso.criar.v1', comando));
  }
}
