const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('consultar y vaciar el carrito acepta JSON null y respuestas vacías', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/api.ts'), 'utf8')
    .replace('import.meta.env.VITE_API_URL', 'undefined');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  for (const cuerpo of ['', 'null']) {
    const exports = {};
    vm.runInNewContext(compiled, { exports, URLSearchParams, fetch: async () => new Response(cuerpo, { status: 200 }) });
    assert.equal(await exports.api.obtenerCarrito('token'), null);
    assert.equal(await exports.api.guardarCarrito([], 'token'), null);
  }
});
