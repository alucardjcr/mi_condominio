// Ronda 79, a pedido explícito del usuario: "Poodle / Caniche" pasa a ser
// dos razas separadas en el catálogo (Poodle y Caniche), id 1 = Perro.
// Las mascotas ya guardadas con el texto antiguo no se tocan (mascota.raza
// guarda el nombre como texto), solo cambia lo que se ofrece al elegir.
exports.up = async function (knex) {
  const perro = await knex("especie_mascota").where({ gls_especie: "Perro" }).first();
  if (!perro) return;
  const id = perro.id_especiemascota;
  await knex("raza_mascota").where({ fk_idespeciemascota: id, gls_raza: "Poodle / Caniche" }).update({ gls_raza: "Poodle" });
  const existe = await knex("raza_mascota").where({ fk_idespeciemascota: id, gls_raza: "Caniche" }).first();
  if (!existe) await knex("raza_mascota").insert({ fk_idespeciemascota: id, gls_raza: "Caniche" });
};

exports.down = async function (knex) {
  const perro = await knex("especie_mascota").where({ gls_especie: "Perro" }).first();
  if (!perro) return;
  const id = perro.id_especiemascota;
  await knex("raza_mascota").where({ fk_idespeciemascota: id, gls_raza: "Caniche" }).del();
  await knex("raza_mascota").where({ fk_idespeciemascota: id, gls_raza: "Poodle" }).update({ gls_raza: "Poodle / Caniche" });
};
