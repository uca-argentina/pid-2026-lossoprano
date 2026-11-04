/**
 * Pruebas de regresión del backend con node:test.
 * Se importan archivos compilados de dist: ejecutar mediante npm test o compilar
 * antes.
 * Las pruebas de integración PostgreSQL usan tablas temporales y una transacción que
 * se revierte, según el montaje de esta suite.
 */

require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  calcularSorteo,
  periodoDe,
  elegirGanador,
  participacionPropia,
  aleatorioMenor,
  aCentavos,
} = require('../dist/sweepstakes/sweepstakes.rules');
const { SorteosService } = require('../dist/sweepstakes/sweepstakes.service');
const inicio = new Date('2026-10-26T03:00:00Z');
const activos = new Set([1, 2, 3]);
const orden = (datos = {}) => ({
  idSuborden: 1,
  estado: 'ENTREGADA',
  total: '5000.00',
  actualizadoEn: inicio,
  idNegocioComprador: 1,
  nombreComprador: 'Comprador',
  idNegocioVendedor: 2,
  nombreVendedor: 'Vendedor',
  ...datos,
});

test('períodos consecutivos de 14 días respetan medianoche argentina, año y límite exclusivo', () => {
  assert.equal(
    periodoDe(new Date('2026-10-26T02:59:59.999Z')).fin.toISOString(),
    inicio.toISOString(),
  );
  assert.equal(periodoDe(inicio).inicio.toISOString(), inicio.toISOString());
  assert.equal(periodoDe(inicio).fin.toISOString(), '2026-11-09T03:00:00.000Z');
  for (const fecha of ['2027-01-01T12:00:00Z', '2024-02-29T03:00:00Z']) {
    const { inicio, fin } = periodoDe(new Date(fecha));
    assert.equal(fin - inicio, 14 * 86400000);
    assert.ok(inicio <= new Date(fecha) && new Date(fecha) < fin);
  }
});

test('5000 contra 2500 da exactamente doble peso; comprador y vendedor comparten sorteo y el fondo no se duplica', () => {
  const r = calcularSorteo(
    [orden(), orden({ idNegocioComprador: 3, total: '2500.00' })],
    inicio,
    activos,
  );
  assert.equal(r.volumen, '7500.00');
  assert.equal(r.comisiones, '1125.00');
  assert.equal(r.premio, '150.00');
  assert.equal(r.ingresoPlataforma, '975.00');
  assert.equal(BigInt(r.participantes[0].peso), 2n * BigInt(r.participantes[2].peso));
  assert.equal(r.pesoTotal, '1500000');
  assert.equal(participacionPropia(r.participantes, 2).probabilidad, 50);
  assert.equal(participacionPropia(r.participantes, 99).probabilidad, 0);
});

test('solo entregas del período suman y no hay mínimo ni redondeo del peso', () => {
  const r = calcularSorteo(
    [
      orden({ total: '0.01' }),
      ...['PENDIENTE', 'CONFIRMADA', 'ENVIADA', 'RECHAZADA', 'CANCELADA'].map((estado) =>
        orden({ estado }),
      ),
      orden({ actualizadoEn: new Date(inicio.getTime() - 1) }),
      orden({ actualizadoEn: periodoDe(inicio).fin }),
    ],
    inicio,
    activos,
  );
  assert.equal(r.volumen, '0.01');
  assert.equal(r.participantes[0].peso, '1');
  assert.equal(r.pesoTotal, '2');
  assert.equal(r.premio, '0.00');
  assert.equal(participacionPropia(r.participantes, 1).probabilidad, 50);
});

test('compras y ventas se acumulan por negocio y la baja excluye sus chances sin borrar comisiones', () => {
  const r = calcularSorteo(
    [orden(), orden({ idNegocioComprador: 2, idNegocioVendedor: 3, total: '1.23' })],
    inicio,
    new Set([2, 3]),
  );
  assert.equal(r.participantes.length, 2);
  const propia = participacionPropia(r.participantes, 2);
  assert.equal(propia.compras, '1.23');
  assert.equal(propia.ventas, '5000.00');
  assert.equal(propia.monto, '5001.23');
  assert.equal(r.volumen, '5001.23');
  assert.equal(
    aCentavos(r.comisiones),
    aCentavos(r.premio) + aCentavos(r.ingresoPlataforma),
  );
});

test('selector ponderado respeta todos los límites y montos mayores que Number.MAX_SAFE_INTEGER', () => {
  const participantes = calcularSorteo(
    [
      orden({ total: '999999999999999999.99' }),
      orden({ total: '0.01', idNegocioComprador: 3 }),
    ],
    inicio,
    activos,
  ).participantes;
  const total = participantes.reduce((s, p) => s + BigInt(p.peso), 0n);
  let acumulado = 0n;
  for (const participante of participantes) {
    assert.equal(
      elegirGanador(participantes, () => acumulado).idNegocio,
      participante.idNegocio,
    );
    const ultimo = acumulado + BigInt(participante.peso) - 1n;
    assert.equal(
      elegirGanador(participantes, () => ultimo).idNegocio,
      participante.idNegocio,
    );
    acumulado = ultimo + 1n;
  }
  assert.equal(elegirGanador([]), null);
  assert.throws(() => elegirGanador(participantes, () => total), /fuera de rango/);
  for (const limite of [1n, 257n, total]) {
    for (let i = 0; i < 20; i++) {
      const valor = aleatorioMenor(limite);
      assert.ok(valor >= 0n && valor < limite);
    }
  }
});

test('cierre guarda un solo resultado, no adelanta el período actual y oculta montos ajenos', async () => {
  const historico = new Date(periodoDe(new Date()).inicio.getTime() - 86400000);
  const resultados = [];
  const subordenes = [
    orden({ actualizadoEn: historico }),
    orden({ actualizadoEn: new Date(), total: '2500.00' }),
  ];
  const repo = {
    findOneBy: async ({ inicio }) =>
      resultados.find((s) => s.inicio.getTime() === inicio.getTime()),
    create: (datos) => datos,
    save: async (datos) => {
      resultados.push({ ...datos, sorteadoEn: new Date() });
    },
    find: async () => resultados,
  };
  const manager = {
    query: async () => {},
    getRepository: (entidad) =>
      ({
        Negocio: { find: async () => [...activos].map((idNegocio) => ({ idNegocio })) },
        Suborden: { find: async () => subordenes },
        Sorteo: repo,
        RelojSorteos: { findOneBy: async () => null },
      })[entidad.name],
  };
  const servicio = new SorteosService({
    manager,
    transaction: (callback) => callback(manager),
  });
  const primero = await servicio.actualizar(1);
  const ganador = primero.historial[0].ganador;
  assert.equal(resultados.length, 1);
  assert.equal(primero.actual.volumen, '2500.00');
  assert.equal(primero.historial[0].participantes, 2);
  assert.equal(Array.isArray(primero.historial[0].participantes), false);
  assert.equal('peso' in ganador, false);
  assert.equal('ventas' in ganador, false);
  assert.deepEqual((await servicio.actualizar(2)).historial[0].ganador, ganador);
  assert.equal(resultados.length, 1);
  assert.equal((await servicio.resumen(1)).historial.length, 1);
  await assert.rejects(servicio.actualizar(99), (error) => error.getStatus() === 401);
});

const { ahoraSorteos } = require('../dist/sweepstakes/sweepstakes-clock');
const { CambiarFechaSorteosDto } = require('../dist/sweepstakes/sweepstakes-clock.dto');
const { validate } = require('class-validator');

function escenarioReloj(subordenes = [orden({ actualizadoEn: new Date() })]) {
  let estado = { reloj: null, resultados: [] };
  let falla = false;
  const manager = {
    query: async () => {},
    getRepository: (entidad) =>
      ({
        Negocio: { find: async () => [...activos].map((idNegocio) => ({ idNegocio })) },
        Suborden: { find: async () => subordenes },
        RelojSorteos: {
          findOneBy: async () => estado.reloj,
          create: (datos) => datos,
          save: async (datos) => {
            estado.reloj = datos;
          },
        },
        Sorteo: {
          findOneBy: async ({ inicio }) =>
            estado.resultados.find((s) => s.inicio.getTime() === inicio.getTime()),
          create: (datos) => datos,
          save: async (datos) => {
            if (falla) throw Error('Fallo al guardar ganador');
            estado.resultados.push(datos);
          },
          find: async () => [...estado.resultados].sort((a, b) => b.inicio - a.inicio),
        },
      })[entidad.name],
  };
  const db = {
    manager,
    transaction: async (callback) => {
      const anterior = structuredClone(estado);
      try {
        return await callback(manager);
      } catch (error) {
        estado = anterior;
        throw error;
      }
    },
  };
  return {
    servicio: new SorteosService(db),
    db,
    subordenes,
    estado: () => estado,
    fallar: () => {
      falla = true;
    },
  };
}

async function conEntorno(variables, callback) {
  const originales = Object.fromEntries(
    Object.keys(variables).map((clave) => [clave, process.env[clave]]),
  );
  try {
    for (const [clave, valor] of Object.entries(variables)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
    return await callback();
  } finally {
    for (const [clave, valor] of Object.entries(originales)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
  }
}

test('adelantar al cierre guarda ganador y comienza un período vacío; la fecha y el resultado sobreviven recarga y nueva instancia', async () => {
  await conEntorno({ NODE_ENV: 'test', VERCEL: undefined }, async () => {
    const e = escenarioReloj();
    const fin = periodoDe(new Date()).fin;
    const antes = await e.servicio.cambiarFecha(
      1,
      new Date(fin.getTime() - 60000).toISOString(),
    );
    assert.equal(antes.historial.length, 0);
    assert.equal(antes.actual.premio, '100.00');
    const resultado = await e.servicio.cambiarFecha(1, fin.toISOString());
    assert.equal(resultado.historial.length, 1);
    assert.ok([1, 2].includes(resultado.historial[0].ganador.idNegocio));
    assert.equal(resultado.historial[0].premio, '100.00');
    assert.equal(resultado.historial[0].sorteadoEn.getTime(), fin.getTime());
    assert.equal(resultado.actual.inicio.getTime(), fin.getTime());
    assert.equal(resultado.actual.premio, '0.00');
    assert.equal(resultado.actual.propia.peso, '0');
    assert.equal(resultado.actual.participantes, 0);
    assert.equal(resultado.relojPrueba.adelantado, true);
    const reiniciado = new SorteosService(e.db);
    assert.deepEqual(
      (await reiniciado.actualizar(2)).historial[0].ganador,
      resultado.historial[0].ganador,
    );
    assert.equal((await reiniciado.resumen(1)).actual.inicio.getTime(), fin.getTime());
    assert.equal(e.estado().resultados.length, 1);
    await assert.rejects(
      e.servicio.cambiarFecha(1, new Date().toISOString()),
      (error) => error.getStatus() === 409,
    );
    assert.equal(e.estado().resultados.length, 1);
  });
});

test('reloj compartido permite acumular nuevas entregas en el período siguiente sin reutilizar montos anteriores', async () => {
  await conEntorno({ NODE_ENV: 'test', VERCEL: undefined }, async () => {
    const e = escenarioReloj();
    const primero = await e.servicio.cambiarFecha(
      1,
      periodoDe(new Date()).fin.toISOString(),
    );
    const fechaEntrega = await ahoraSorteos(e.db.manager);
    e.subordenes.push(orden({ total: '2500.00', actualizadoEn: fechaEntrega }));
    const resumen = await e.servicio.resumen(2);
    assert.equal(resumen.actual.volumen, '2500.00');
    assert.equal(resumen.actual.propia.ventas, '2500.00');
    const segundo = await e.servicio.cambiarFecha(2, resumen.actual.fin.toISOString());
    assert.equal(segundo.actual.premio, '0.00');
    assert.equal(segundo.historial.length, 2);
    assert.equal(segundo.historial[0].premio, '50.00');
    assert.deepEqual(segundo.historial[1].ganador, primero.historial[0].ganador);
  });
});

test('fallar al guardar el resultado revierte también el reloj; vacío no inventa participantes', async () => {
  await conEntorno({ NODE_ENV: 'test', VERCEL: undefined }, async () => {
    const e = escenarioReloj();
    e.fallar();
    await assert.rejects(
      e.servicio.cambiarFecha(1, periodoDe(new Date()).fin.toISOString()),
      /Fallo al guardar/,
    );
    assert.equal(e.estado().reloj, null);
    assert.equal(e.estado().resultados.length, 0);
    const vacio = escenarioReloj([]);
    const respuesta = await vacio.servicio.cambiarFecha(
      1,
      periodoDe(new Date()).fin.toISOString(),
    );
    assert.equal(respuesta.historial.length, 0);
    assert.equal(respuesta.actual.participantes, 0);
    await assert.rejects(
      vacio.servicio.cambiarFecha(99, respuesta.actual.fin.toISOString()),
      (error) => error.getStatus() === 401,
    );
    await assert.rejects(
      async () => vacio.servicio.cambiarFecha(1, 'fecha inválida'),
      (error) => error.getStatus() === 400,
    );
  });
});

test('producción y Vercel rechazan cambiar la fecha e ignoran el reloj de prueba', async () => {
  for (const variables of [
    { NODE_ENV: 'production', VERCEL: undefined },
    { NODE_ENV: 'development', VERCEL: '1' },
  ]) {
    await conEntorno(variables, async () => {
      const servicio = new SorteosService({});
      await assert.rejects(
        async () => servicio.cambiarFecha(1, '2026-11-09T03:00:00Z'),
        (error) => error.getStatus() === 404,
      );
      const real = await ahoraSorteos({
        getRepository: () => {
          throw Error('No debe leer el reloj local');
        },
      });
      assert.ok(Math.abs(real.getTime() - Date.now()) < 1000);
    });
  }
});

test('fecha del reloj requiere fecha válida y zona horaria explícita', async () => {
  for (const fecha of ['2026-11-09T03:00:00Z', '2026-11-09T00:00:00-03:00']) {
    assert.equal(
      (await validate(Object.assign(new CambiarFechaSorteosDto(), { fecha }))).length,
      0,
    );
  }
  for (const fecha of [
    undefined,
    '',
    'ayer',
    '2026-02-30T03:00:00Z',
    '2026-11-09T00:00:00',
  ]) {
    assert.ok(
      (await validate(Object.assign(new CambiarFechaSorteosDto(), { fecha }))).length > 0,
    );
  }
});
