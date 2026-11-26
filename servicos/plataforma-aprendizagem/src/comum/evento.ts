import { randomUUID } from 'node:crypto';

// envelope igual para todos os eventos (catalogo em docs/architecture.md)
export interface Evento<T> {
  id: string;
  tipo: string;
  versao: number;
  ocorridoEm: string;
  correlationId: string;
  dados: T;
}

export function criarEvento<T>(tipo: string, dados: T, correlationId: string): Evento<T> {
  return { id: randomUUID(), tipo, versao: 1, ocorridoEm: new Date().toISOString(), correlationId, dados };
}
