// Ronda 68, a pedido explícito del usuario: el Administrador arma su
// condominio según cómo se organice — decide manualmente quién reporta a
// quién (un guardia/personal de aseo/jardinero puede reportar a un Jefe
// específico, o a ninguno si el Administrador lo supervisa directo).
//
// 1) usuario.jefe_id_usuario: a qué Jefe (JefeGuardias/JefeAseo/
//    JefeJardineria) reporta este usuario — auto-referencia a la misma
//    tabla usuario. Nullable: no todo el personal tiene por qué reportar
//    a alguien.
// 2) horario_personal: a diferencia de los guardias (que tienen un
//    patrón rotativo día/noche con fechas específicas, turno_asignado_guardia),
//    el personal de aseo/jardinería necesita un horario SEMANAL
//    RECURRENTE simple (ej. "lunes a sábado, 08:00-12:00", o "martes y
//    viernes, 09:00-14:00") — cada Jefe de área lo define según la
//    necesidad real de cada trabajador, sin patrón fijo impuesto por el
//    sistema.
exports.up = async function (knex) {
  await knex.schema.alterTable("usuario", (table) => {
    table.integer("jefe_id_usuario").nullable();
    table.foreign("jefe_id_usuario").references("usuario.id_usuario");
  });

  await knex.schema.createTable("horario_personal", (table) => {
    table.increments("id_horariopersonal").primary();
    table.integer("usuario_id_usuario").notNullable();
    // 1 = Lunes ... 7 = Domingo (ISO-8601, mismo criterio que
    // Date.getDay() ajustado — se traduce en el backend).
    table.tinyint("dia_semana").notNullable();
    table.time("hora_inicio").notNullable();
    table.time("hora_termino").notNullable();
    table.integer("condominio_id_condominio").notNullable();
    table.foreign("usuario_id_usuario").references("usuario.id_usuario");
    table.foreign("condominio_id_condominio").references("condominio.id_condominio");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("horario_personal");
  await knex.schema.alterTable("usuario", (table) => {
    table.dropForeign("jefe_id_usuario");
    table.dropColumn("jefe_id_usuario");
  });
};
