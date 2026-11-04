/**
 * Orquesta los sorteos: lee entregas, calcula el período vigente y guarda una
 * instantánea por período cerrado.
 * El bloqueo transaccional compartido con entregas y reloj evita resultados duplicados
 * o entregas asignadas a un corte ya cerrado.
 * Las respuestas incluyen las chances del negocio autenticado, no los montos
 * particulares de los demás.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager, LessThan } from 'typeorm';
import { Negocio } from '../business/business.entity';
import { EstadoSuborden, Suborden } from '../products/order.entity';
import { Sorteo } from './sweepstakes.entity';
import { ahoraSorteos, relojPruebaHabilitado, RelojSorteos } from './sweepstakes-clock';
import {
  aCentavos,
  BLOQUEO_SORTEOS,
  calcularSorteo,
  elegirGanador,
  participacionPropia,
  periodoDe,
  REGLAS_SORTEO,
} from './sweepstakes.rules';

@Injectable()
export class SorteosService {
  constructor(private readonly db: DataSource) {}

  /**
   * Obtiene negocios que todavía existen y subórdenes entregadas. Rechaza tokens de un
   * negocio dado de baja antes de consultar o modificar su participación.
   */
  private async datos(manager: EntityManager, idNegocio: number) {
    const negocios = await manager
      .getRepository(Negocio)
      .find({ select: { idNegocio: true } });
    const activos = new Set(negocios.map((n) => n.idNegocio));
    if (!activos.has(idNegocio))
      throw new UnauthorizedException('El negocio ya no existe.');
    const subordenes = await manager.getRepository(Suborden).find({
      where: { estado: EstadoSuborden.ENTREGADA },
      order: { idSuborden: 'ASC' },
    });
    return { activos, subordenes };
  }

  /**
   * Construye el resumen vigente y los últimos doce resultados, ocultando las
   * participaciones individuales de terceros.
   */
  private async respuesta(
    manager: EntityManager,
    idNegocio: number,
    ahora: Date,
    datos: Awaited<ReturnType<SorteosService['datos']>>,
  ) {
    const { inicio } = periodoDe(ahora);
    const actual = calcularSorteo(datos.subordenes, inicio, datos.activos);
    const historial = await manager.getRepository(Sorteo).find({
      where: { fin: LessThan(new Date(ahora.getTime() + 1)) },
      order: { inicio: 'DESC' },
      take: 12,
    });
    const { participantes, ...periodo } = actual;
    return {
      demo: true,
      relojPrueba: {
        habilitado: relojPruebaHabilitado(),
        adelantado: ahora.getTime() > Date.now() + 1000,
      },
      reglas: REGLAS_SORTEO,
      ahora,
      actual: {
        ...periodo,
        participantes: participantes.length,
        propia: participacionPropia(participantes, idNegocio),
      },
      historial: historial.map(({ participantes, ...sorteo }) => ({
        ...sorteo,
        participantes: participantes.length,
        propia: participacionPropia(participantes, idNegocio),
        esGanador: sorteo.ganador?.idNegocio === idNegocio,
      })),
    };
  }

  /**
   * Consulta el reloj efectivo y devuelve una lectura; a diferencia de actualizar, no
   * ejecuta cierres.
   */
  async resumen(idNegocio: number) {
    const ahora = await ahoraSorteos(this.db.manager);
    /**
     * Obtiene negocios que todavía existen y subórdenes entregadas. Rechaza tokens de un
     * negocio dado de baja antes de consultar o modificar su participación.
     */
    const datos = await this.datos(this.db.manager, idNegocio);
    return this.respuesta(this.db.manager, idNegocio, ahora, datos);
  }

  /**
   * Agrupa entregas por períodos que ya terminaron. Si el inicio ya está guardado,
   * conserva su resultado; de lo contrario elige ganador y guarda la instantánea con las
   * reglas usadas.
   */
  private async cerrarVencidos(
    manager: EntityManager,
    idNegocio: number,
    ahora: Date,
    datos: Awaited<ReturnType<SorteosService['datos']>>,
  ) {
    const repo = manager.getRepository(Sorteo);
    const periodos = new Map<string, Date>();
    for (const suborden of datos.subordenes) {
      const { inicio, fin } = periodoDe(suborden.actualizadoEn);
      if (fin <= ahora) periodos.set(inicio.toISOString(), inicio);
    }
    for (const inicio of [...periodos.values()].sort(
      (a, b) => a.getTime() - b.getTime(),
    )) {
      // La identidad del período es su inicio, no el momento de esta solicitud.
      // Conservar la fila anterior impide volver a elegir ganador al recargar.
      if (await repo.findOneBy({ inicio })) continue;
      const calculo = calcularSorteo(datos.subordenes, inicio, datos.activos);
      const elegido =
        aCentavos(calculo.premio) > 0n ? elegirGanador(calculo.participantes) : null;
      await repo.save(
        repo.create({
          ...calculo,
          reglas: { ...REGLAS_SORTEO },
          sorteadoEn: ahora,
          ganador: elegido
            ? { idNegocio: elegido.idNegocio, nombre: elegido.nombre }
            : null,
        }),
      );
    }
    return this.respuesta(manager, idNegocio, ahora, datos);
  }

  /**
   * Toma el bloqueo compartido con las entregas antes de leer la fecha y procesar
   * cierres. Todos los pasos se confirman o revierten juntos.
   */
  actualizar(idNegocio: number) {
    return this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [BLOQUEO_SORTEOS]);
      const ahora = await ahoraSorteos(manager);
      /**
       * Obtiene negocios que todavía existen y subórdenes entregadas. Rechaza tokens de un
       * negocio dado de baja antes de consultar o modificar su participación.
       */
      const datos = await this.datos(manager, idNegocio);
      return this.cerrarVencidos(manager, idNegocio, ahora, datos);
    });
  }

  /**
   * Solo en desarrollo: valida avance monotónico y guarda reloj y resultados en una
   * transacción. Un fallo al guardar un ganador también revierte el avance del reloj.
   */
  cambiarFecha(idNegocio: number, fecha: string) {
    if (!relojPruebaHabilitado()) throw new NotFoundException();
    const elegida = new Date(fecha);
    if (!Number.isFinite(elegida.getTime()))
      throw new BadRequestException('Indicá una fecha válida.');
    return this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [BLOQUEO_SORTEOS]);
      /**
       * Obtiene negocios que todavía existen y subórdenes entregadas. Rechaza tokens de un
       * negocio dado de baja antes de consultar o modificar su participación.
       */
      const datos = await this.datos(manager, idNegocio);
      const actual = await ahoraSorteos(manager);
      if (elegida < actual)
        throw new ConflictException(
          'El reloj de prueba solo puede avanzar. No se pueden reabrir períodos cerrados ni cambiar ganadores.',
        );
      const relojes = manager.getRepository(RelojSorteos);
      // Guardar el desfase (en vez de una fecha congelada) permite que el reloj siga corriendo.
      // La misma transacción incluye los cierres: un error no deja un reloj adelantado sin resultado.
      await relojes.save(
        relojes.create({ id: 1, desfaseMs: String(elegida.getTime() - Date.now()) }),
      );
      return this.cerrarVencidos(manager, idNegocio, elegida, datos);
    });
  }
}
