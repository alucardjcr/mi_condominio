// Ronda 64, a pedido explícito del usuario: adopción de Knex para poder
// usar ALTER TABLE de verdad de acá en adelante. Antes de esto, el
// proyecto solo podía CREATE TABLE IF NOT EXISTS (ver docs/schema-mysql.sql)
// porque no había forma segura de aplicar un cambio a una tabla que quizás
// ya existía en producción — así que cada cambio de columna terminaba
// siendo una tabla satélite nueva (condominio_detalle, condominio_region,
// condominio_direccion, etc.) en vez de agregar la columna donde
// correspondía. Con Knex, las migraciones quedan registradas una por una
// (tabla `knex_migrations`) y se aplican una sola vez, en orden — así que
// ALTER TABLE ya es seguro de usar.
//
// Se carga con dotenv acá mismo porque este archivo también se usa
// standalone desde la CLI de Knex (`npx knex migrate:latest`), no solo
// dentro de la app (que ya carga dotenv por su cuenta en index.ts).
require("dotenv").config();

const DB_SSL = process.env.DB_SSL === "true";
const DB_SSL_REJECT_UNAUTHORIZED = process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false";

/** @type {import('knex').Knex.Config} */
const config = {
  client: "mysql2",
  connection: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "mi_condominio",
    ssl: DB_SSL ? { rejectUnauthorized: DB_SSL_REJECT_UNAUTHORIZED } : undefined,
    // La migración baseline corre el schema-mysql.sql histórico completo
    // como un solo bloque con muchas sentencias separadas por ";" — mysql2
    // rechaza eso por defecto a menos que se habilite explícitamente. El
    // resto de la app (ver db/client.ts) sigue sin habilitarlo en su pool
    // normal, a propósito, para no exponer esa superficie en las consultas
    // de todos los días.
    multipleStatements: true,
  },
  migrations: {
    directory: "./migrations",
    tableName: "knex_migrations",
  },
};

module.exports = config;
