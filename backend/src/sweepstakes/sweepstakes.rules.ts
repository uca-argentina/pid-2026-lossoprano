/**
 * Reglas puras del sorteo: períodos de catorce días, comisión, fondo, peso y
 * selección ponderada.
 * Los importes y pesos usan enteros bigint para conservar centavos sin pérdida de
 * precisión.
 * Cada venta financia el premio una vez, pero genera peso tanto para su comprador como
 * para su vendedor.
 */

import { randomBytes } from 'node:crypto';
import { EstadoSuborden, Suborden } from '../products/order.entity';

// Configuración de la demo: 15% de comisión; 2/15 de esa comisión financia el premio.
export const REGLAS_SORTEO = {
  comisionBps: 1500,
  premioNumerador: 2,
  premioDenominador: 15,
  dias: 14,
} as const;
export const BLOQUEO_SORTEOS = 20261102;
const DURACION = REGLAS_SORTEO.dias * 86400000;
// Lunes 5 de enero de 2026, 00:00 de Argentina. Períodos consecutivos, no quincenas calendario.
const ORIGEN = Date.parse('2026-01-05T00:00:00-03:00');

/**
 * Convierte un decimal no negativo a centavos enteros. Acepta cero, uno o dos
 * decimales sin pasar por Number.
 */
export const aCentavos = (valor: string) => {
  if (!/^\d+(\.\d{1,2})?$/.test(valor)) throw new Error('Importe inválido.');
  const [entero, decimal = ''] = valor.split('.');
  return BigInt(entero) * 100n + BigInt(decimal.padEnd(2, '0'));
};
/**
 * Convierte centavos bigint no negativos en el string decimal de dos posiciones usado
 * por la API.
 */
export const aImporte = (valor: bigint) =>
  `${valor / 100n}.${(valor % 100n).toString().padStart(2, '0')}`;
const redondear = (valor: bigint, divisor: bigint) => (valor + divisor / 2n) / divisor;

/**
 * Ubica una fecha en un intervalo de catorce días desde el lunes de referencia. El
 * inicio se incluye y el fin pertenece al período siguiente.
 */
export function periodoDe(fecha: Date) {
  const inicio = new Date(
    ORIGEN + Math.floor((fecha.getTime() - ORIGEN) / DURACION) * DURACION,
  );
  return { inicio, fin: new Date(inicio.getTime() + DURACION) };
}

export type ParticipanteSorteo = {
  idNegocio: number;
  nombre: string;
  compras: string;
  ventas: string;
  peso: string;
};

export type MovimientoSorteo = Pick<
  Suborden,
  | 'estado'
  | 'actualizadoEn'
  | 'total'
  | 'idNegocioComprador'
  | 'nombreComprador'
  | 'idNegocioVendedor'
  | 'nombreVendedor'
>;

/**
 * Suma solo entregas dentro del período. Calcula comisión y aporte por suborden; el
 * peso se acumula por negocio existente y combina compras y ventas.
 */
export function calcularSorteo(
  subordenes: MovimientoSorteo[],
  inicio: Date,
  activos: Set<number>,
) {
  const { fin } = periodoDe(inicio);
  const participantes = new Map<number, ParticipanteSorteo>();
  let volumen = 0n;
  let comisiones = 0n;
  let premio = 0n;
  for (const orden of subordenes) {
    if (
      orden.estado !== EstadoSuborden.ENTREGADA ||
      orden.actualizadoEn < inicio ||
      orden.actualizadoEn >= fin
    )
      continue;
    const monto = aCentavos(orden.total);
    if (monto === 0n) continue;
    const comision = redondear(monto * BigInt(REGLAS_SORTEO.comisionBps), 10000n);
    volumen += monto;
    comisiones += comision;
    premio += redondear(
      comision * BigInt(REGLAS_SORTEO.premioNumerador),
      BigInt(REGLAS_SORTEO.premioDenominador),
    );
    for (const [id, nombre, tipo] of [
      [orden.idNegocioComprador, orden.nombreComprador, 'compras'],
      [orden.idNegocioVendedor, orden.nombreVendedor, 'ventas'],
    ] as const) {
      if (!activos.has(id)) continue;
      const participante = participantes.get(id) ?? {
        idNegocio: id,
        nombre,
        compras: '0.00',
        ventas: '0.00',
        peso: '0',
      };
      participante[tipo] = aImporte(aCentavos(participante[tipo]) + monto);
      participante.peso = (BigInt(participante.peso) + monto).toString();
      participantes.set(id, participante);
    }
  }
  const lista = [...participantes.values()].sort((a, b) => a.idNegocio - b.idNegocio);
  return {
    inicio,
    fin,
    volumen: aImporte(volumen),
    comisiones: aImporte(comisiones),
    premio: aImporte(premio),
    ingresoPlataforma: aImporte(comisiones - premio),
    participantes: lista,
    pesoTotal: lista.reduce((suma, p) => suma + BigInt(p.peso), 0n).toString(),
  };
}

// Rechazo de muestras fuera del rango: sin sesgo ni conversión a Number.
/**
 * Genera un entero uniforme en [0, limite). Descarta muestras sobrantes antes del
 * módulo para no favorecer algunos números.
 */
export function aleatorioMenor(limite: bigint): bigint {
  if (limite <= 0n) throw new Error('El límite debe ser positivo.');
  const bytes = Math.ceil(limite.toString(2).length / 8);
  const rango = 1n << BigInt(bytes * 8);
  const techo = rango - (rango % limite);
  for (;;) {
    const muestra = BigInt(`0x${randomBytes(bytes).toString('hex')}`);
    if (muestra < techo) return muestra % limite;
  }
}

/**
 * Interpreta cada peso como una porción consecutiva del rango total. La porción que
 * contiene el número aleatorio determina al ganador; acepta un generador inyectado
 * para probar límites.
 */
export function elegirGanador(
  participantes: ParticipanteSorteo[],
  sortear = aleatorioMenor,
) {
  const total = participantes.reduce((suma, p) => suma + BigInt(p.peso), 0n);
  if (!total) return null;
  let posicion = sortear(total);
  if (posicion < 0n || posicion >= total)
    throw new Error('Resultado aleatorio fuera de rango.');
  for (const participante of participantes) {
    if (posicion < BigInt(participante.peso)) return participante;
    posicion -= BigInt(participante.peso);
  }
  return null;
}

/**
 * Devuelve montos y porcentaje del negocio solicitado. Mantiene el peso exacto como
 * string y limita la precisión del porcentaje de presentación.
 */
export function participacionPropia(
  participantes: ParticipanteSorteo[],
  idNegocio: number,
) {
  const propia = participantes.find((p) => p.idNegocio === idNegocio);
  const total = participantes.reduce((suma, p) => suma + BigInt(p.peso), 0n);
  const peso = BigInt(propia?.peso ?? '0');
  return {
    compras: propia?.compras ?? '0.00',
    ventas: propia?.ventas ?? '0.00',
    monto: aImporte(peso),
    peso: peso.toString(),
    probabilidad: total ? Number((peso * 100000000n) / total) / 1000000 : 0,
  };
}
