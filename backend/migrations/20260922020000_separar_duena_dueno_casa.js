// Ronda 75, a pedido explícito del usuario: separar "Dueña/o de Casa" (una
// sola fila, para cubrir ambos géneros) en dos filas independientes —
// "Dueña de Casa" y "Dueño de Casa" — para que cada quien elija la que le
// corresponde en el combobox de profesión, en vez de una combinada.
//
// La fila vieja "Dueña/o de Casa" se desactiva (flg_vigencia = 0) en vez de
// borrarse — si algún residente ya la tenía elegida, ese texto sigue
// guardado tal cual en residente_perfil.profesion (es solo un VARCHAR, no
// una FK a esta tabla), así que no se rompe nada; simplemente deja de
// aparecer como opción nueva en el selector.
exports.up = async function (knex) {
  await knex("profesion").where({ gls_profesion: "Dueña/o de Casa" }).update({ flg_vigencia: 0 });

  await knex("profesion").insert([
    { codigo: "135", gls_profesion: "Dueña de Casa" },
    { codigo: "136", gls_profesion: "Dueño de Casa" },
  ]);
};

exports.down = async function (knex) {
  await knex("profesion").whereIn("gls_profesion", ["Dueña de Casa", "Dueño de Casa"]).del();
  await knex("profesion").where({ gls_profesion: "Dueña/o de Casa" }).update({ flg_vigencia: 1 });
};
