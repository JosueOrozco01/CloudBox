const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFolderLocations } = require('../src/services/folder-locations');
const { load, database } = require('./helpers');

test('folder paths preserve nesting and exclude orphaned or cyclic branches', () => {
  assert.deepEqual(buildFolderLocations([
    { id: 2, nombre: 'Fotos', id_padre: 1 },
    { id: 1, nombre: 'Documentos', id_padre: null },
    { id: 3, nombre: 'Personal', id_padre: null },
    { id: 4, nombre: 'Huérfana', id_padre: 99 },
    { id: 5, nombre: 'Ciclo A', id_padre: 6 },
    { id: 6, nombre: 'Ciclo B', id_padre: 5 },
  ]), [
    { id: 1, name: 'Documentos' },
    { id: 2, name: 'Documentos / Fotos' },
    { id: 3, name: 'Personal' },
  ]);
});

test('locations are scoped to the account and active folders, including more than 1000 rows', async () => {
  const folders = Array.from({ length: 1201 }, (_, id) => ({ id: id + 1, nombre: `Carpeta ${id}`, id_padre: null, id_usuario: 7, id_estado: 1 }));
  const db = database({ carpeta: [...folders,
    { id: 1300, nombre: 'Otra cuenta', id_padre: null, id_usuario: 8, id_estado: 1 },
    { id: 1301, nombre: 'Papelera', id_padre: null, id_usuario: 7, id_estado: 2 },
  ] });
  const service = load('services/folder.service.js', { '@supabase/supabase-js': { createClient: () => db } });
  const locations = await service.getFolderLocations(7);
  assert.equal(locations.length, 1201);
  assert.ok(locations.every(folder => folder.id <= 1201));
  assert.equal(db.calls.filter(call => call[1] === 'id_usuario').length, 2);
  db.fail({ message: 'unavailable' });
  await assert.rejects(service.getFolderLocations(7), /Error al obtener ubicaciones/);
});
