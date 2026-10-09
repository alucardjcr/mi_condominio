// A pedido explícito del usuario: el perfil del guardia pasa a tener fecha de
// nacimiento, si tiene el curso OS10 vigente (sí / no / sin definir) y foto.
//
// La foto la cargan SOLO el Administrador o el Comité (ruta /admin/guardias):
// el guardia no puede cambiarla por la de otra persona. os10_vigente es
// nullable a propósito (NULL = sin definir, 1 = vigente, 0 = no vigente):
// los guardias ya cargados no lo tienen contestado todavía.
exports.up = async function (knex) {
  await knex.schema.alterTable("guardia_perfil", (table) => {
    table.date("fecha_nacimiento").nullable();
    table.tinyint("os10_vigente").nullable();
    table.string("foto_url", 500).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("guardia_perfil", (table) => {
    table.dropColumn("fecha_nacimiento");
    table.dropColumn("os10_vigente");
    table.dropColumn("foto_url");
  });
};
