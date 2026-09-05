// Ronda 65, a pedido explícito del usuario ("nada de tablas satélite que
// no necesitamos"): consolida condominio_detalle (comuna),
// condominio_region (region) y condominio_direccion (direccion,
// codigo_postal) en columnas reales de la tabla `condominio` — el primer
// uso real de ALTER TABLE del proyecto, ahora que Knex lo hace seguro
// (ver la migración baseline, 20260905000001). Estas 3 tablas existían
// solo porque, antes de Knex, no había forma segura de agregarle una
// columna a `condominio` si ya existía en producción.
exports.up = async function (knex) {
  await knex.schema.alterTable("condominio", (table) => {
    table.string("comuna", 100).nullable();
    table.string("region", 100).nullable();
    table.string("direccion", 255).nullable();
    table.string("codigo_postal", 20).nullable();
  });

  // Migrar los datos que ya existan en las tablas satélite hacia las
  // columnas nuevas, antes de borrarlas.
  await knex.raw(`
    UPDATE condominio c
    LEFT JOIN condominio_detalle cd ON cd.condominio_id_condominio = c.id_condominio
    LEFT JOIN condominio_region cr ON cr.condominio_id_condominio = c.id_condominio
    LEFT JOIN condominio_direccion cdir ON cdir.condominio_id_condominio = c.id_condominio
    SET c.comuna = cd.comuna,
        c.region = cr.region,
        c.direccion = cdir.direccion,
        c.codigo_postal = cdir.codigo_postal
  `);

  await knex.schema.dropTableIfExists("condominio_detalle");
  await knex.schema.dropTableIfExists("condominio_region");
  await knex.schema.dropTableIfExists("condominio_direccion");
};

exports.down = async function (knex) {
  await knex.schema.createTable("condominio_detalle", (table) => {
    table.integer("condominio_id_condominio").primary();
    table.string("comuna", 100).nullable();
    table.foreign("condominio_id_condominio").references("condominio.id_condominio");
  });
  await knex.schema.createTable("condominio_region", (table) => {
    table.integer("condominio_id_condominio").primary();
    table.string("region", 100).nullable();
    table.foreign("condominio_id_condominio").references("condominio.id_condominio");
  });
  await knex.schema.createTable("condominio_direccion", (table) => {
    table.integer("condominio_id_condominio").primary();
    table.string("direccion", 255).notNullable();
    table.string("codigo_postal", 20).nullable();
    table.foreign("condominio_id_condominio").references("condominio.id_condominio");
  });

  await knex.raw(`
    INSERT INTO condominio_detalle (condominio_id_condominio, comuna)
    SELECT id_condominio, comuna FROM condominio WHERE comuna IS NOT NULL
  `);
  await knex.raw(`
    INSERT INTO condominio_region (condominio_id_condominio, region)
    SELECT id_condominio, region FROM condominio WHERE region IS NOT NULL
  `);
  await knex.raw(`
    INSERT INTO condominio_direccion (condominio_id_condominio, direccion, codigo_postal)
    SELECT id_condominio, direccion, codigo_postal FROM condominio WHERE direccion IS NOT NULL
  `);

  await knex.schema.alterTable("condominio", (table) => {
    table.dropColumn("comuna");
    table.dropColumn("region");
    table.dropColumn("direccion");
    table.dropColumn("codigo_postal");
  });
};
