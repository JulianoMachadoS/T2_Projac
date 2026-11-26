import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Observable, firstValueFrom, retry, timer } from 'rxjs';

// curso no formato da integracao, sem os nomes de campo do Moodle
export interface Curso {
  nomeCompleto: string;
  nomeCurto: string;
  codigoExterno: string; // vira o idnumber do Moodle
}

// categoria padrao que ja vem no Moodle
const CATEGORIA_PADRAO = 1;

// adaptador do Moodle (ACL): o resto do servico so ve Curso
@Injectable()
export class MoodleService {
  constructor(private readonly http: HttpService) {}

  // idempotencia: procura o curso pelo idnumber antes de criar
  async buscarPorCodigoExterno(codigoExterno: string): Promise<number | null> {
    const resposta = await this.chamar<{ courses: { id: number }[] }>('core_course_get_courses_by_field', {
      field: 'idnumber',
      value: codigoExterno,
    });
    return resposta.courses[0]?.id ?? null;
  }

  async criarCurso(curso: Curso): Promise<number> {
    const resposta = await this.chamar<{ id: number }[]>('core_course_create_courses', {
      'courses[0][fullname]': curso.nomeCompleto,
      'courses[0][shortname]': curso.nomeCurto,
      'courses[0][idnumber]': curso.codigoExterno,
      'courses[0][categoryid]': String(CATEGORIA_PADRAO),
    });
    return resposta[0].id;
  }

  private async chamar<T>(funcao: string, parametros: Record<string, string>): Promise<T> {
    const url = `${process.env.MOODLE_URL}/webservice/rest/server.php`;
    const corpo = new URLSearchParams({
      wstoken: process.env.MOODLE_TOKEN!,
      wsfunction: funcao,
      moodlewsrestformat: 'json',
      ...parametros,
    });
    const resposta = await firstValueFrom(comRetry(this.http.post(url, corpo)));

    // o Moodle devolve erro com status 200, dentro de um objeto com "exception"
    if (resposta.data?.exception) {
      throw new Error(`Moodle: ${resposta.data.errorcode} - ${resposta.data.message}`);
    }
    return resposta.data as T;
  }
}

// retry com backoff: espera 2 s, 4 s e 8 s antes de desistir
function comRetry<T>(chamada: Observable<T>): Observable<T> {
  return chamada.pipe(retry({ count: 3, delay: (_erro, tentativa) => timer(2000 * 2 ** (tentativa - 1)) }));
}
