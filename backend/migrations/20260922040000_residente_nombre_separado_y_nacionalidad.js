// Ronda 77, a pedido explícito del usuario: separar el nombre del
// residente en Nombres / Apellido Paterno / Apellido Materno (este último
// opcional, porque muchos extranjeros no tienen segundo apellido), para
// poder filtrar por apellido_paterno directamente en una query SQL — antes
// solo existía "usuario.nombre_usuario" como un único string compuesto.
//
// usuario.nombre_usuario NO se elimina ni deja de usarse: sigue siendo el
// "nombre para mostrar" que usan login, header, listados, etc. en TODOS
// los roles (Guardia, Administrador, Residente, etc.), así que se sigue
// completando desde el backend (se compone a partir de estos 3 campos
// cuando se crea/edita un residente), pero ahora también queda la
// información separada y consultable en residente_perfil.
//
// Igual que rut/fecha_nacimiento/profesion, estos campos son opcionales a
// nivel de columna porque residente_perfil es 1-a-1 opcional sobre
// usuario (no todos los roles tienen perfil de residente).
//
// nacionalidad_id_nacionalidad referencia el catálogo "nacionalidad"
// creado en la migración anterior (mismo patrón que profesion, aunque esa
// se guarda como texto — aquí se usa FK numérica porque no hace falta
// texto libre de respaldo para nacionalidad).
exports.up = async function (knex) {
  await knex.schema.alterTable("residente_perfil", (table) => {
    table.string("nombres", 100).nullable();
    table.string("apellido_paterno", 100).nullable();
    table.string("apellido_materno", 100).nullable();
    table
      .integer("nacionalidad_id_nacionalidad")
      .unsigned()
      .nullable()
      .references("id_nacionalidad")
      .inTable("nacionalidad");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("residente_perfil", (table) => {
    table.dropColumn("nombres");
    table.dropColumn("apellido_paterno");
    table.dropColumn("apellido_materno");
    table.dropForeign("nacionalidad_id_nacionalidad");
    table.dropColumn("nacionalidad_id_nacionalidad");
  });
};
