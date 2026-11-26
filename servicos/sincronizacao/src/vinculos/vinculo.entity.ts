import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type StatusVinculo = 'PENDENTE' | 'CRIADO' | 'FALHOU';

// liga a turma do i-Educar ao curso do Moodle; guarda so ids e o estado
@Entity('vinculo_turma_curso')
export class Vinculo {
  // chave primaria: cada turma tem no maximo um vinculo
  @PrimaryColumn({ name: 'turma_id' })
  turmaId: number;

  @Column({ name: 'nome_turma' })
  nomeTurma: string;

  @Column({ type: 'varchar', default: 'PENDENTE' })
  status: StatusVinculo;

  @Column({ name: 'curso_id', type: 'int', nullable: true })
  cursoId: number | null;

  @Column({ type: 'text', nullable: true })
  erro: string | null;

  @Column({ name: 'correlation_id' })
  correlationId: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
