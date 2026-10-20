// Ronda 80, a pedido explícito del usuario: el residente al que visitan debe
// AUTORIZAR o RECHAZAR la visita desde la app. Si no responde en 5 minutos,
// el guardia ve la opción de llamarlo por teléfono (y puede dejar pasar).
//
// Tabla aparte (1 a 1 con visita, mismo criterio de siempre: no se toca la
// tabla `visita`). Sin fila = visita sin autorización requerida (la visita
// no tenía un residente concreto marcado, o es anterior a esta ronda).
// Las fechas son VARCHAR ISO, igual que en `visita`.
//
// También agrega `telefono` a residente_perfil: hasta hoy no existía ningún
// teléfono de residente y el guardia lo necesita para llamar.
exports.up = async function (knex) {
  await knex.schema.createTable("visita_autorizacion", (table) => {
    table.increments("id_autorizacion").primary();
    table.integer("visita_id_visita").notNullable().unique();
    table.string("estado", 20).notNullable().defaultTo("Pendiente"); // Pendiente | Autorizada | Rechazada
    table.string("fecha_solicitud", 35).notNullable();
    table.string("fecha_respuesta", 35).nullable();
    table.string("respondida_por", 20).nullable(); // Residente | Guardia
    table.integer("usuario_id_respondio").nullable();
  });

  await knex.schema.alterTable("residente_perfil", (table) => {
    table.string("telefono", 20).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("residente_perfil", (table) => {
    table.dropColumn("telefono");
  });
  await knex.schema.dropTableIfExists("visita_autorizacion");
};
