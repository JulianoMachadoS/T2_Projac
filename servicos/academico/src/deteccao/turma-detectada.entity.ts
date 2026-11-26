import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// turmas que ja foram publicadas, pra nao publicar de novo a cada ciclo
@Entity('turma_detectada')
export class TurmaDetectada {
  @PrimaryColumn({ name: 'turma_id' })
  turmaId: number;

  @CreateDateColumn({ name: 'detectada_em', type: 'timestamptz' })
  detectadaEm: Date;
}
