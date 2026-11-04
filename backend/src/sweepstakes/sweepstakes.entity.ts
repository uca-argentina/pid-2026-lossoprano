/**
 * Instantánea persistente de un sorteo: período, reglas, fondo, participantes y
 * ganador.
 * El inicio es la clave primaria para impedir dos resultados del mismo período. Los
 * datos históricos no dependen de cascadas desde negocios.
 */

import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import type { ParticipanteSorteo } from './sweepstakes.rules';

// Un resultado inmutable por período; sin cascadas desde negocios o pedidos.
@Entity('sorteo')
export class Sorteo {
  @PrimaryColumn({ type: 'timestamptz' })
  inicio: Date;
  @Column({ type: 'timestamptz' })
  fin: Date;
  @Column({ type: 'decimal', precision: 24, scale: 2 })
  volumen: string;
  @Column({ type: 'decimal', precision: 24, scale: 2 })
  comisiones: string;
  @Column({ type: 'decimal', precision: 24, scale: 2 })
  premio: string;
  @Column({ name: 'ingreso_plataforma', type: 'decimal', precision: 24, scale: 2 })
  ingresoPlataforma: string;
  @Column('jsonb')
  participantes: ParticipanteSorteo[];
  @Column({ name: 'peso_total', type: 'text' })
  pesoTotal: string;
  @Column({ type: 'jsonb', nullable: true })
  ganador: {
    idNegocio: number;
    nombre: string;
  } | null;
  @Column('jsonb')
  reglas: {
    comisionBps: number;
    premioNumerador: number;
    premioDenominador: number;
    dias: number;
  };
  @CreateDateColumn({ name: 'sorteado_en', type: 'timestamptz' })
  sorteadoEn: Date;
}
