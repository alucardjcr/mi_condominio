// Ronda 69, a pedido explícito del usuario: "¿tenemos también si los
// guardias o conserjes y el personal de jardinería y aseo son internos?"
// — no existía ningún dato de esto. Se agrega a `usuario` en general
// (columnas nullable, solo tienen sentido para Guardia/Personal/los 3
// tipos de Jefe — para Residente/Administrador/SuperAdmin quedan NULL,
// simplemente no aplica).
exports.up = async function (knex) {
  await knex.schema.alterTable("usuario", (table) => {
    // NULL = no aplica a este rol (ej. Residente). 1 = personal propio
    // del condominio (conserje/jardinero directo). 0 = contratado a
    // través de una empresa externa (seguridad, aseo, jardinería).
    table.tinyint("flg_interno").nullable();
    // Solo tiene sentido si flg_interno = 0 — nombre de la empresa que
    // presta el servicio (ej. "Vigilancia Segura SPA", "Jardines del Sur").
    table.string("empresa_externa", 150).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("usuario", (table) => {
    table.dropColumn("flg_interno");
    table.dropColumn("empresa_externa");
  });
};
