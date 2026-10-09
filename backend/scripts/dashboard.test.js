const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

async function run({ search = '', noSubscription = false, queryError = false } = {}) {
  const queries = [];
  const quota = { getStorageMetrics: async id => {
    assert.equal(id, 5);
    if (noSubscription) throw Object.assign(new Error('Sin suscripción'), { code: 'NO_ACTIVE_SUBSCRIPTION' });
    return { usedBytes: 1024, maxBytes: 2048 };
  } };
  const controller = { exports: {} };
  const db = { from(table) {
    const query = { table, filters: [] };
    queries.push(query);
    const chain = {
      select(_columns, options) { query.head = options.head; return chain; },
      eq(field, value) { query.filters.push([field, value]); return chain; },
      ilike(_field, value) { query.search = value; return chain; },
      order(field) { query.order = field; return chain; },
      limit(value) { query.limit = value; return chain; },
      then(resolve, reject) { return Promise.resolve({
        data: query.head ? null : [{ id: 1, nombre: 'Archivo.pdf' }],
        count: table === 'carpeta' ? 2 : 3,
        error: queryError ? new Error('Database error') : null,
      }).then(resolve, reject); },
    };
    return chain;
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/dashboardController.js'), 'utf8'), {
    exports: controller.exports,
    require: name => name.includes('quota.service') ? quota : db,
  });
  let response;
  let failure;
  await controller.exports.getSummary({ user: { id: 5 }, supabase: db, query: { search } },
    { json: value => { response = value; } }, error => { failure = error; });
  assert.equal(queries.length, 3);
  for (const query of queries) {
    assert.ok(query.filters.some(([field, value]) => field === 'id_usuario' && value === 5));
    assert.ok(query.filters.some(([field, value]) => field === 'id_estado' && value === 1));
    assert.ok(!query.filters.some(([field]) => field === 'id_carpeta' || field === 'id_padre'));
  }
  if (queryError) { assert.equal(failure.message, 'Database error'); return; }
  assert.equal(failure, undefined);
  assert.equal(response.data.fileCount, 3);
  assert.equal(response.data.folderCount, 2);
  assert.equal(queries[0].limit, 5);
  assert.equal(queries[0].order, 'fecha_subida');
  if (search) assert.equal(queries[0].search, '%a\\%\\_%');
  if (noSubscription) assert.equal(response.data.storage, null);
}

(async () => {
  await run();
  await run({ search: 'a%_' });
  await run({ noSubscription: true });
  await run({ queryError: true });
  console.log('OK: aislamiento por usuario, conteos globales, búsqueda y errores.');
})().catch(error => { console.error(error); process.exitCode = 1; });
