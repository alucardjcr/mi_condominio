// A pedido explicito del usuario: el nombre del guardia se pide separado
// (Nombres / Apellido paterno / Apellido materno), igual que los residentes
// (ronda 77). El apellido materno es opcional. usuario.nombre_usuario sigue
// guardando el nombre completo ya armado para listados y bitacora; los
// guardias cargados antes de esto quedan con estas columnas en NULL.
exports.up = async function (knex) {
  await knex.schema.alterTable("guardia_perfil", (table) => {
    table.string("nombres", 150).nullable();
    table.string("apellido_paterno", 100).nullable();
    table.string("apellido_materno", 100).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("guardia_perfil", (table) => {
    table.dropColumn("nombres");
    table.dropColumn("apellido_paterno");
    table.dropColumn("apellido_materno");
  });
};
