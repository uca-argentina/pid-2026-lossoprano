const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const modulo = {};
const source = fs.readFileSync(path.join(__dirname, '../src/utils.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports: modulo, Intl, isNaN, parseFloat });
const { precioParaCantidad, siguienteTramo } = modulo;
const tramos = [{ cantidadMinima: 48, precioUnitario: '80.00' }, { cantidadMinima: 12, precioUnitario: '90.00' }];

test('el precio unitario usa el tramo más alto alcanzado', () => {
  assert.equal(precioParaCantidad('100.00', tramos, 11), '100.00');
  assert.equal(precioParaCantidad('100.00', tramos, 12), '90.00');
  assert.equal(precioParaCantidad('100.00', tramos, 60), '80.00');
  assert.equal(precioParaCantidad('100.00', [], 60), '100.00');
});

test('el próximo tramo solo se sugiere si hay stock para alcanzarlo', () => {
  assert.equal(siguienteTramo(tramos, 5, 100).cantidadMinima, 12);
  assert.equal(siguienteTramo(tramos, 12, 100).cantidadMinima, 48);
  assert.equal(siguienteTramo(tramos, 12, 40), undefined);
  assert.equal(siguienteTramo(tramos, 48, 100), undefined);
});
