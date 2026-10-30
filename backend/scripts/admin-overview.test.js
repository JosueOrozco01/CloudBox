const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const future = new Date(Date.now() + 30 * 86400000).toISOString();
const past = new Date(Date.now() - 30 * 86400000).toISOString();
const plan = { id: 1, nombre: "Básico", espacio_maximo_gb: 5 };
const tables = {
  usuario: [{ id: 1, auth_user_id: "auth-1" }, { id: 2 }],
  suscripcion: [
    {
      id: 1,
      id_usuario: 1,
      fecha_inicio: past,
      fecha_fin: future,
      plan,
      estado: { nombre: "Activa" },
    },
    {
      id: 2,
      id_usuario: 2,
      fecha_inicio: past,
      fecha_fin: past,
      plan,
      estado: { nombre: "Activa" },
    },
  ],
  archivo: [
    { id: 1, id_usuario: 1, tamano_bytes: 100, estado: { nombre: "Activo" } },
    {
      id: 2,
      id_usuario: 1,
      tamano_bytes: 200,
      estado: { nombre: "En papelera" },
    },
    {
      id: 3,
      id_usuario: 2,
      tamano_bytes: 900,
      estado: { nombre: "Eliminado" },
    },
  ],
  estado_usuario: [{ id: 1, nombre: "Activo" }],
  rol: [{ id: 1, nombre: "Cliente" }],
};
const db = {
  auth: {
    admin: {
      listUsers: async () => ({
        data: {
          users: [
            {
              id: "auth-1",
              user_metadata: { avatar_url: "https://example.com/avatar.png" },
            },
          ],
        },
        error: null,
      }),
    },
  },
  from(table) {
    return {
      select() {
        return this;
      },
      order() {
        return this;
      },
      async range(start, end) {
        return { data: tables[table].slice(start, end + 1), error: null };
      },
    };
  },
};
const context = {
  require: name => name === '@supabase/supabase-js' ? ({createClient:()=>db}) : require(path.resolve(__dirname,'../src/services',name)),
  process: { env: {} },
  module: { exports: {} },
  Date,
  Number,
  Map,
};
vm.runInNewContext(
  fs.readFileSync(
    path.join(__dirname, "../src/services/admin.service.js"),
    "utf8",
  ),
  context,
);
(async () => {
  const result = await context.module.exports.getOverview();
  assert.equal(result.metrics.usedBytes, 300);
  assert.equal(result.metrics.fileCount, 2);
  assert.equal(result.metrics.activeSubscriptions, 1);
  assert.equal(result.metrics.subscribedUsers, 1);
  assert.equal(result.metrics.allocatedBytes, 5 * 1024 ** 3);
  assert.equal(result.users[0].usedBytes, 300);
  assert.equal(result.users[1].usedBytes, 0);
  assert.equal(result.users[1].plan, "Sin suscripción activa");
  assert.equal(result.users[0].maxBytes, 5 * 1024 ** 3);
  assert.equal(result.users[1].maxBytes, null);
  assert.equal(result.metrics.subscriptionStatus[2].count, 1);
  assert.equal(result.metrics.planDistribution[0].count, 1);
  assert.equal(result.users[0].avatarUrl, "https://example.com/avatar.png");
  tables.suscripcion.push({ ...tables.suscripcion[0], id: 3 });
  assert.equal(
    (await context.module.exports.getOverview()).metrics.subscribedUsers,
    1,
  );
  tables.usuario = Array.from({ length: 1001 }, (_, index) => ({
    id: index + 1,
  }));
  assert.equal((await context.module.exports.getOverview()).users.length, 1001);
  console.log(
    "OK: cuotas vigentes, papelera, archivos eliminados y lectura de más de 1000 usuarios.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
