// Ronda 72, a pedido explícito del usuario: cada vez que el SuperAdmin crea
// un Administrador, esa cuenta debe cambiar su contraseña obligatoriamente
// la primera vez que inicia sesión — sin importar qué tan fuerte haya sido
// la clave inicial que le puso el SuperAdmin. Mismo patrón ya usado para el
// onboarding de residentes (ver residente_onboarding_pendiente): una tabla
// "marcador" en vez de una columna booleana en `usuario` — mientras exista
// una fila acá para ese usuario, login() lo manda a completar el cambio de
// clave antes de dejarlo entrar a cualquier otra parte de la app.
exports.up = async function (knex) {
  await knex.schema.createTable("usuario_cambio_password_pendiente", (table) => {
    table.integer("usuario_id_usuario").notNullable().primary();
    table.dateTime("fecha_generado").notNullable().defaultTo(knex.fn.now());
    table.foreign("usuario_id_usuario").references("usuario.id_usuario");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("usuario_cambio_password_pendiente");
};
