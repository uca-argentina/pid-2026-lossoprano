/**
 * Pruebas de regresión del frontend con node:test.
 * Los helpers transpilan TypeScript y sustituyen módulos/efectos para ejercitar lógica
 * sin un navegador real.
 * Estas pruebas no reemplazan una revisión visual: para estilos, foco o desplazamiento
 * también hay que abrir la interfaz.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');

function pantalla() {
  const estados = [];
  let indice = 0;
  let efecto;
  let respuesta;
  let fallo = false;
  let falloReloj = false;
  let llamadasReloj = 0;
  const exports = {};
  const react = {
    useRef(inicial) {
      const i = indice++;
      if (!(i in estados)) estados[i] = { current: inicial };
      return estados[i];
    },
    useState(inicial) {
      const i = indice++;
      if (!(i in estados)) estados[i] = inicial;
      return [
        estados[i],
        (valor) => {
          estados[i] = typeof valor === 'function' ? valor(estados[i]) : valor;
        },
      ];
    },
    useEffect(callback) {
      efecto = callback;
    },
  };
  const api = {
    cambiarFechaSorteos: async (fecha, token) => {
      assert.equal(token, 'token');
      assert.equal(fecha, '2026-11-09T03:00:00.000Z');
      llamadasReloj++;
      if (falloReloj) throw new Error('El reloj de prueba solo puede avanzar');
      const propia = {
        compras: '0.00',
        ventas: '0.00',
        monto: '0.00',
        peso: '0',
        probabilidad: 0,
      };
      respuesta = {
        ...respuesta,
        ahora: fecha,
        relojPrueba: { habilitado: true, adelantado: true },
        actual: {
          ...respuesta.actual,
          inicio: fecha,
          fin: '2026-11-23T03:00:00Z',
          premio: '0.00',
          volumen: '0.00',
          comisiones: '0.00',
          ingresoPlataforma: '0.00',
          participantes: 0,
          propia,
        },
        historial: [
          {
            ...respuesta.actual,
            ganador: { idNegocio: 2, nombre: 'Marca ganadora' },
            esGanador: false,
          },
        ],
      };
      return respuesta;
    },
    actualizarSorteos: async (token) => {
      assert.equal(token, 'token');
      if (fallo) throw new Error('Sin conexión');
      return respuesta;
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/Sorteos.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    Intl,
    Date,
    Number,
    Error,
    require: (nombre) => ({ react, 'react/jsx-runtime': jsx, './api': { api } })[nombre],
  });
  const propia = {
    compras: '5000.00',
    ventas: '0.00',
    monto: '5000.00',
    peso: '500000',
    probabilidad: 50,
  };
  respuesta = {
    ahora: '2026-11-03T15:00:00Z',
    relojPrueba: { habilitado: true, adelantado: false },
    reglas: { comisionBps: 1500, premioNumerador: 2, premioDenominador: 15, dias: 14 },
    actual: {
      inicio: '2026-10-26T03:00:00Z',
      fin: '2026-11-09T03:00:00Z',
      premio: '100.00',
      volumen: '5000.00',
      comisiones: '750.00',
      ingresoPlataforma: '650.00',
      participantes: 2,
      propia,
    },
    historial: [],
  };
  const render = () => {
    indice = 0;
    return exports.default({ token: 'token' });
  };
  function buscar(nodo, predicado) {
    if (!nodo || typeof nodo !== 'object') return;
    if (predicado(nodo)) return nodo;
    for (const hijo of [nodo.props?.children].flat(Infinity)) {
      const encontrado = buscar(hijo, predicado);
      if (encontrado) return encontrado;
    }
  }
  return {
    render,
    html: () => renderToStaticMarkup(render()),
    datos: respuesta,
    fallo: (valor) => {
      fallo = valor;
    },
    falloReloj: (valor) => {
      falloReloj = valor;
    },
    llamadasReloj: () => llamadasReloj,
    enviar: () => {
      const form = buscar(render(), (n) => n.type === 'form');
      assert.ok(form);
      return form.props.onSubmit({ preventDefault() {} });
    },
    inputFecha: () =>
      buscar(render(), (n) => n.type === 'input' && n.props.type === 'datetime-local'),
    cargar: async () => {
      render();
      efecto();
      await new Promise((resolve) => setImmediate(resolve));
    },
    probabilidad: exports.probabilidad,
  };
}

test('muestra odds, pesos argentinos, fondo y reglas de demo; no presenta cargos reales', async () => {
  const p = pantalla();
  await p.cargar();
  const html = p.html();
  assert.match(html, /50%/);
  assert.match(html, /100,00/);
  assert.match(html, /750,00/);
  assert.match(html, /650,00/);
  assert.match(html, /15% de cada venta: 13% para la plataforma y 2% para el premio/);
  assert.match(html, /no cobra comisiones ni entrega dinero real/);
  assert.match(html, /9 de noviembre de 2026/);
  assert.doesNotMatch(html, /NaN|Infinity|USD/);
});

test('sin actividad ofrece explicación, historial conserva ganador y distingue premio propio', async () => {
  const p = pantalla();
  p.datos.actual.propia = {
    compras: '0.00',
    ventas: '0.00',
    monto: '0.00',
    peso: '0',
    probabilidad: 0,
  };
  p.datos.historial = [
    { ...p.datos.actual, ganador: { nombre: 'Negocio ganador' }, esGanador: false },
  ];
  await p.cargar();
  assert.match(p.html(), /Todavía no sumaste chances/);
  assert.match(p.html(), /Ganador: Negocio ganador/);
  p.datos.historial[0].esGanador = true;
  assert.match(p.html(), /Tu negocio ganó este premio simulado/);
  assert.equal(p.probabilidad({ peso: '1', probabilidad: 0 }), '<0,000001%');
  assert.equal(p.probabilidad({ peso: '0', probabilidad: 0 }), '0%');
});

test('carga y errores no muestran cifras anteriores como actuales; actualizar permite reintentar', async () => {
  const p = pantalla();
  await p.cargar();
  p.fallo(true);
  await p.cargar();
  assert.match(p.html(), /Sin conexión/);
  assert.doesNotMatch(p.html(), /PREMIO EN FORMACIÓN/);
  p.fallo(false);
  await p.cargar();
  assert.doesNotMatch(p.html(), /Sin conexión/);
  assert.match(p.html(), /PREMIO EN FORMACIÓN/);
});

test('fecha en Argentina se envía con zona explícita; cierre guarda ganador en historial y reinicia el período visible', async () => {
  const p = pantalla();
  await p.cargar();
  assert.equal(p.inputFecha().props.value, '2026-11-09T00:00:00');
  await p.enviar();
  const html = p.html();
  assert.match(html, /ganador quedó guardado en Resultados anteriores/);
  assert.match(html, /Ganador: Marca ganadora/);
  assert.match(html, /23 de noviembre de 2026/);
  assert.match(html, /Reloj de prueba activo/);
  assert.match(html, /0 negocios participando/);
  assert.match(html, /Todavía no sumaste chances/);
  assert.equal(p.inputFecha().props.value, '2026-11-23T00:00:00');
  assert.doesNotMatch(html, /RESULTADO DE PRUEBA|Simular cierre/);
});

test('solo ofrece reloj fuera de producción; un error conserva fecha y premio y permite reintentar', async () => {
  const p = pantalla();
  p.datos.relojPrueba.habilitado = false;
  await p.cargar();
  assert.doesNotMatch(p.html(), /Aplicar fecha de prueba/);
  p.datos.relojPrueba.habilitado = true;
  p.falloReloj(true);
  await p.cargar();
  await p.enviar();
  assert.match(p.html(), /El reloj de prueba solo puede avanzar/);
  assert.equal(p.inputFecha().props.value, '2026-11-09T00:00:00');
  assert.match(p.html(), /100,00/);
  p.falloReloj(false);
  await p.enviar();
  assert.doesNotMatch(p.html(), /El reloj de prueba solo puede avanzar/);
  assert.match(p.html(), /Ganador: Marca ganadora/);
});

test('doble envío no adelanta el reloj dos veces y actualizar conserva el resultado guardado', async () => {
  const p = pantalla();
  await p.cargar();
  const promesa = p.enviar();
  await p.enviar();
  await promesa;
  assert.equal(p.llamadasReloj(), 1);
  await p.cargar();
  assert.match(p.html(), /Ganador: Marca ganadora/);
  assert.match(p.html(), /Reloj de prueba activo/);
});
