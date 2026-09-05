// Ronda 70, a pedido explícito del usuario: "en la pantalla principal de
// residente se vea su foto, su rut, su edad" — residente_perfil ya tenía
// rut y fecha_nacimiento (para calcular la edad), pero nunca se guardó
// ninguna foto de un residente (a diferencia de mascotas/vetados/
// administradores, que sí tienen foto desde antes).
exports.up = async function (knex) {
  await knex.schema.alterTable("residente_perfil", (table) => {
    table.string("foto_url", 500).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("residente_perfil", (table) => {
    table.dropColumn("foto_url");
  });
};
