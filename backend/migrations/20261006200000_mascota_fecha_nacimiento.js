// Ronda 79, a pedido explícito del usuario: fecha de nacimiento de la
// mascota, para mostrar su edad en el panel "Mascotas del hogar" (igual que
// la edad de los residentes, que sale de residente_perfil.fecha_nacimiento).
//
// DATE nullable, como residente_perfil.fecha_nacimiento: es opcional porque
// muchas veces el dueño no sabe la fecha exacta, y las mascotas ya cargadas
// antes de este cambio no la tienen. db/client.ts usa dateStrings: true, así
// que llega a la app como 'YYYY-MM-DD'.
exports.up = async function (knex) {
  await knex.schema.alterTable("mascota", (table) => {
    table.date("fecha_nacimiento").nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("mascota", (table) => {
    table.dropColumn("fecha_nacimiento");
  });
};
