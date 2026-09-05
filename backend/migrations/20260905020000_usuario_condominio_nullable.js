// Ronda 66, a pedido explícito del usuario: quiere crear un Administrador
// nuevo ("franco_adm") que la PRIMERA VEZ que entra todavía no tiene
// ningún condominio — tiene que poder loguearse y crear el suyo desde
// cero. Hoy es estructuralmente imposible: `usuario.condominio_id_condominio`
// es NOT NULL, así que ni siquiera se puede INSERTAR ese usuario sin
// asignarle algún condominio ya existente. Se afloja a NULL — el resto del
// sistema ya maneja bien "sin condominio" en otros lugares (ej. SuperAdmin
// no tiene ninguno), así que esto no es un caso nuevo para el modelo,
// solo para esta columna puntual.
exports.up = async function (knex) {
  await knex.raw("ALTER TABLE usuario MODIFY condominio_id_condominio INT NULL");
};

exports.down = async function (knex) {
  const huerfanos = (await knex.raw("SELECT COUNT(*) AS n FROM usuario WHERE condominio_id_condominio IS NULL"))[0][0].n;
  if (huerfanos > 0) {
    throw new Error(
      `No se puede revertir: hay ${huerfanos} usuario(s) sin condominio asignado (creados después de esta migración). Asígnales un condominio primero.`
    );
  }
  await knex.raw("ALTER TABLE usuario MODIFY condominio_id_condominio INT NOT NULL");
};
