import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { firstValueFrom, retry, timer } from 'rxjs';

// turma no formato da integracao, sem os nomes de campo do i-Educar
export interface Turma {
  id: number;
  nome: string;
  ano: number;
  escolaId: number;
}

// so os campos que usamos da resposta de /api/school-class
interface TurmaIEducar {
  cod_turma: number;
  nm_turma: string;
  ano: number;
  ref_ref_cod_escola: number;
}

interface PaginaIEducar {
  data: TurmaIEducar[];
  meta: { last_page: number };
}

// adaptador do i-Educar (ACL): o resto do servico so ve Turma
@Injectable()
export class IeducarService {
  private readonly logger = new Logger(IeducarService.name);

  // circuit breaker: depois de 3 falhas em 2 min para de chamar o i-Educar por 30 s
  // (falha na hora em vez de esperar timeout + retry a cada ciclo)
  private readonly disjuntor = new CircuitBreaker(() => this.buscarTurmas(), {
    timeout: false, // o timeout ja e do HttpModule
    volumeThreshold: 3,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    // janela de 2 min para contar as falhas: cada chamada leva ~7 s por causa do retry,
    // com a janela padrao (10 s) nunca cabiam 3 falhas e o circuito nao abria
    rollingCountTimeout: 120000,
  });

  constructor(private readonly http: HttpService) {
    this.disjuntor.on('open', () => this.logger.warn({ msg: 'circuit breaker ABERTO: i-Educar fora do ar' }));
    this.disjuntor.on('halfOpen', () => this.logger.log({ msg: 'circuit breaker MEIO ABERTO: testando o i-Educar' }));
    this.disjuntor.on('close', () => this.logger.log({ msg: 'circuit breaker FECHADO: i-Educar voltou' }));
  }

  // estado mostrado no /health
  get estadoDisjuntor() {
    return this.disjuntor.opened ? 'aberto' : this.disjuntor.halfOpen ? 'meio-aberto' : 'fechado';
  }

  listarTurmasAtivas(): Promise<Turma[]> {
    return this.disjuntor.fire();
  }

  private async buscarTurmas(): Promise<Turma[]> {
    const url = `${process.env.IEDUCAR_URL}/api/school-class`;
    const anoAtual = new Date().getFullYear();
    const turmas: Turma[] = [];

    // a API devolve 15 por pagina, entao segue ate a ultima
    let pagina = 1;
    let ultimaPagina = 1;
    while (pagina <= ultimaPagina) {
      const resposta = await firstValueFrom(
        this.http
          .get<PaginaIEducar>(url, {
            headers: {
              Authorization: `Bearer ${process.env.IEDUCAR_TOKEN}`,
              Accept: 'application/json',
            },
            params: {
              active: 1,
              year_eq: anoAtual,
              only: 'cod_turma,nm_turma,ano,ref_ref_cod_escola',
              page: pagina,
            },
          })
          // retry com backoff: espera 1 s, 2 s e 4 s antes de desistir
          .pipe(retry({ count: 3, delay: (_erro, tentativa) => timer(1000 * 2 ** (tentativa - 1)) })),
      );
      for (const t of resposta.data.data) {
        turmas.push({ id: t.cod_turma, nome: t.nm_turma, ano: t.ano, escolaId: t.ref_ref_cod_escola });
      }
      ultimaPagina = resposta.data.meta.last_page;
      pagina++;
    }
    return turmas;
  }
}
