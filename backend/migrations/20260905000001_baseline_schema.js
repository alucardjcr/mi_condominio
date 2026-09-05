// Ronda 64: migración BASELINE — congela todo el schema tal como estaba
// antes de adoptar Knex (60+ rondas de historial, siempre agregando
// tablas nuevas en vez de ALTER TABLE, por no tener un sistema de
// migraciones de verdad). Corre exactamente el mismo docs/schema-mysql.sql
// que el backend ya venía aplicando en cada arranque (ver db/client.ts,
// versión anterior a esta ronda) — por eso es 100% seguro correrla tanto
// contra una base nueva (crea todo desde cero) como contra una base que
// YA tiene las tablas de antes (CREATE TABLE IF NOT EXISTS no hace nada
// ahí, ni rompe nada).
//
// De acá en adelante, los cambios de schema van en migraciones NUEVAS,
// con ALTER TABLE real — este archivo no se vuelve a tocar nunca más.
const fs = require("fs");
const path = require("path");

exports.up = async function (knex) {
  // Mismo criterio de rutas candidatas que usaba db/client.ts antes de
  // esta ronda (Railway con "Root Directory" = backend/ vs. correr desde
  // la raíz del repo completo).
  const candidatos = [
    path.join(__dirname, "../docs/schema-mysql.sql"),
    path.join(__dirname, "../../docs/schema-mysql.sql"),
  ];
  const rutaSchema = candidatos.find((p) => fs.existsSync(p)) ?? candidatos[0];
  const sql = fs.readFileSync(rutaSchema, "utf-8");
  await knex.raw(sql);
};

exports.down = async function () {
  throw new Error(
    "La migración baseline no se puede deshacer — borraría todas las tablas y datos del sistema. Si necesitas volver atrás, restaura desde un backup de la base de datos en vez de hacer rollback de esta migración."
  );
};
