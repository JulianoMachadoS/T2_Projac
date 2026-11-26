import { Counter, Histogram, collectDefaultMetrics, register } from 'prom-client';

// metricas lidas em GET /metrics (formato do Prometheus)
collectDefaultMetrics();

export const mensagensProcessadas = new Counter({
  name: 'mensagens_processadas_total',
  help: 'Mensagens processadas por evento e resultado',
  labelNames: ['evento', 'resultado'],
});

export const falhas = new Counter({
  name: 'falhas_total',
  help: 'Falhas ao chamar sistemas externos ou processar mensagens',
  labelNames: ['origem'],
});

export const duracaoSincronizacao = new Histogram({
  name: 'sincronizacao_duracao_segundos',
  help: 'Tempo entre a turma ser detectada e o curso ser criado',
  buckets: [1, 5, 15, 30, 60, 120, 300],
});

export { register };
