// Ronda 67, a pedido explícito del usuario:
// 1) Agrega 2 roles nuevos al catálogo tipo_usuario (JefeAseo,
//    JefeJardineria) — el mecanismo de "identificar el rol con un número
//    en vez de guardar el texto" YA existía (tipo_usuario.id_tipousuario,
//    usuario.tipo_usuario_id_tipousuario es una FK numérica desde el
//    principio del proyecto) — lo que faltaba eran estos 2 roles
//    puntuales en el catálogo, no la tabla en sí.
// 2) Nueva tabla administrador_perfil: datos que pidió el usuario para
//    cuando el SuperAdmin crea un Administrador — foto, RUT, fecha de
//    nacimiento, N° de registro RNAC (opcional) y teléfono. El correo
//    electrónico NO se duplica acá — ya existe `usuario.correo_usuario`
//    desde el principio del proyecto, se reutiliza ese.
exports.up = async function (knex) {
  await knex("tipo_usuario").insert([
    { gls_tipousuario: "JefeAseo" },
    { gls_tipousuario: "JefeJardineria" },
  ]);

  await knex.schema.createTable("administrador_perfil", (table) => {
    table.increments("id_administradorperfil").primary();
    table.integer("usuario_id_usuario").notNullable().unique();
    table.string("foto_url", 500).nullable();
    table.string("rut", 15).nullable();
    table.date("fecha_nacimiento").nullable();
    table.string("numero_registro_rnac", 50).nullable();
    table.string("telefono", 20).nullable();
    table.foreign("usuario_id_usuario").references("usuario.id_usuario");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("administrador_perfil");
  await knex("tipo_usuario").whereIn("gls_tipousuario", ["JefeAseo", "JefeJardineria"]).del();
};
