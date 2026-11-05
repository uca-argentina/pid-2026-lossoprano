/**
 * Reloj de pruebas local con un desfase persistido respecto de Date.now.
 * Lo consultan sorteos y entregas para usar la misma fecha. En producción/Vercel se
 * ignora el desfase y se usa siempre la hora real.
 */

import { Column, Entity, PrimaryColumn, EntityManager } from 'typeorm';

export const relojPruebaHabilitado = () =>
  process.env.NODE_ENV !== 'production' && !process.env.VERCEL;

// Desfase persistente y compartido por las cuentas de esta base local.
@Entity('sorteo_reloj')
export class RelojSorteos {
  @PrimaryColumn({ type: 'integer' })
  id: number;
  @Column({ name: 'desfase_ms', type: 'bigint', default: '0' })
  desfaseMs: string;
}

// Acepta un EntityManager o el DataSource: los dos tienen getRepository.
export async function ahoraSorteos(
  manager: Pick<EntityManager, 'getRepository'>,
): Promise<Date> {
  if (!relojPruebaHabilitado()) return new Date();
  const reloj = await manager.getRepository(RelojSorteos).findOneBy({ id: 1 });
  return new Date(Date.now() + Number(reloj?.desfaseMs ?? '0'));
}
