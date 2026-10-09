// A pedido explicito del usuario: el Administrador puede ver y editar su propio
// perfil en "Mis datos" (foto, correo, fecha de nacimiento, telefono,
// profesion y N° de registro nacional). administrador_perfil ya tenia foto,
// rut, fecha_nacimiento, telefono y numero_registro_rnac; falta la profesion
// (texto del catalogo de profesiones, igual que residente_perfil.profesion).
exports.up = async function (knex) {
  await knex.schema.alterTable("administrador_perfil", (table) => {
    table.string("profesion", 150).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("administrador_perfil", (table) => {
    table.dropColumn("profesion");
  });
};
